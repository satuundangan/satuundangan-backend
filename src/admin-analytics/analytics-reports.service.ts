import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Between, In, IsNull, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';
import { jakartaDate, resolveDashboardPeriod } from '../admin/admin-dashboard-period';
import { Invitation } from '../invitation/invitation.entity';
import { Payment } from '../payment/payment.entity';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsAnnotation, AnalyticsInsight } from './analytics-insight.entity';
import {
  GATEWAY_SOURCES,
  PaymentLike,
  attributionLabel,
  buildFunnel,
  deriveInsights,
  isVerifiedPaid,
  qualityAlerts,
  reconcilePurchases,
} from './analytics-logic';

const MP_URL = 'https://www.google-analytics.com/mp/collect';
const MP_MAX_AGE_MS = 72 * 3_600_000; // GA4 Measurement Protocol ignores older events
const MP_MAX_ATTEMPTS = 5;
const GA4_FUNNEL_EVENTS: Array<{ event: string; label: string }> = [
  { event: 'page_view', label: 'Kunjungan halaman marketing' },
  { event: 'template_previewed', label: 'Preview template' },
  { event: 'template_personalization_continue', label: 'Lanjut dari pemilihan template' },
  { event: 'create_form_submitted', label: 'Form undangan terkirim' },
  { event: 'draft_saved', label: 'Draft Studio tersimpan' },
  { event: 'checkout_started', label: 'Checkout dimulai' },
  { event: 'sign_up', label: 'Registrasi berhasil' },
  { event: 'purchase', label: 'Purchase (server, terverifikasi)' },
];

function buildGa4FunnelRows(rows: Array<{ dimensions: Record<string, string>; metrics: Record<string, number | null> }>, dimension?: string) {
  const groups = new Map<string, Map<string, Record<string, number | null>>>();
  for (const row of rows) {
    const event = row.dimensions.eventName;
    if (!GA4_FUNNEL_EVENTS.some((step) => step.event === event)) continue;
    const value = dimension ? row.dimensions[dimension] || '(not set)' : '';
    const events = groups.get(value) ?? new Map<string, Record<string, number | null>>();
    events.set(event, row.metrics);
    groups.set(value, events);
  }

  const stepsFor = (events: Map<string, Record<string, number | null>>) =>
    GA4_FUNNEL_EVENTS.map(({ event, label }) => {
      const metrics = events.get(event);
      return {
        event,
        label,
        events: metrics ? metrics.eventCount : null,
        users: metrics ? metrics.totalUsers : null,
      };
    });

  if (!dimension) return stepsFor(groups.get('') ?? new Map());
  return [...groups.entries()].map(([value, events]) => ({ value, steps: stepsFor(events) }));
}

@Injectable()
export class AnalyticsReportsService {
  private readonly logger = new Logger(AnalyticsReportsService.name);

  constructor(
    private readonly ga4: AdminAnalyticsService,
    private readonly config: ConfigService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Invitation) private readonly invitations: Repository<Invitation>,
    @InjectRepository(AnalyticsInsight) private readonly insights: Repository<AnalyticsInsight>,
    @InjectRepository(AnalyticsAnnotation) private readonly annotations: Repository<AnalyticsAnnotation>,
  ) {}

  private notConnected() {
    return { status: 'not_connected', missingConfiguration: this.ga4.connection().missing };
  }

  private ga4Ready() {
    return this.ga4.connection().missing.length === 0;
  }

  private async paymentsInRange(start: Date, end: Date, by: 'createdAt' | 'settlementTime' = 'createdAt') {
    return this.payments.find({ where: { [by]: Between(start, end) } as any, order: { id: 'ASC' } });
  }

  // ---- ADM-025: funnel -------------------------------------------------------

  async funnel(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const invitations = await this.invitations.find({
      where: { createdAt: Between(period.start, period.effectiveEnd) },
      select: { id: true, createdAt: true, isPublished: true },
    });
    const ids = invitations.map((i) => i.id);
    const payments = ids.length ? await this.payments.find({ where: { invitationId: In(ids) } }) : [];
    const funnel = buildFunnel(invitations, payments as PaymentLike[]);
    let upstream: any = this.notConnected();
    if (this.ga4Ready()) {
      try {
        const options = {
          startDate: period.startDate,
          endDate: period.endDate,
          metrics: ['eventCount', 'totalUsers'],
          filters: [{ filter: { fieldName: 'eventName', inListFilter: { values: GA4_FUNNEL_EVENTS.map((e) => e.event) } } }],
          limit: 5000,
        };
        const [overall, byTemplate, byDevice] = await Promise.all([
          this.ga4.customReport({ ...options, dimensions: ['eventName'] }),
          this.ga4.customReport({ ...options, dimensions: ['eventName', 'contentGroup'] }),
          this.ga4.customReport({ ...options, dimensions: ['eventName', 'deviceCategory'] }),
        ]);
        const steps = buildGa4FunnelRows(overall.rows);
        upstream = {
          status: overall.rows.length ? 'ready' : 'no_data',
          steps,
          byTemplate: buildGa4FunnelRows(byTemplate.rows, 'contentGroup'),
          byDevice: buildGa4FunnelRows(byDevice.rows, 'deviceCategory'),
          ...(overall.rows.length ? {} : { emptyReason: 'GA4 tidak mengembalikan baris event untuk periode ini.' }),
        };
      } catch {
        upstream = { status: 'error', message: 'Event GA4 belum dapat dimuat.' };
      }
    }
    return {
      period: { startDate: period.startDate, endDate: period.endDate, timezone: period.timezone, includesToday: period.includesToday },
      backend: funnel,
      upstreamGa4: upstream,
      definitions: {
        denominator: 'Undangan yang dibuat pada periode (WIB). Setiap undangan dihitung sekali per tahap.',
        window: `Tidak ada batas waktu konversi; kohort dianggap matang setelah ${funnel.cohort.maturityDays} hari sejak undangan dibuat.`,
        order: 'Urutan tahap tidak kaku: editor anonim dapat menyimpan draft sebelum registrasi, sehingga tahap GA4 di atas tidak dijumlahkan dengan tahap backend.',
        ga4: 'Event count dan users adalah agregat GA4 per tahap, bukan urutan konversi per orang. Users pada beberapa template dapat berasal dari orang yang sama; nilai antar-template tidak boleh dijumlahkan.',
        template: 'Template hanya ditampilkan bila event membawa content_group template/<id>. Baris (not set) berarti template tidak tersedia atau belum teratribusi.',
        paid: 'Dibayar = order Midtrans berstatus success dengan nominal > 0. Aktivasi gratis dipisah.',
      },
    };
  }

  // ---- ADM-026: purchases ----------------------------------------------------

  async purchases(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const rows = await this.paymentsInRange(period.start, period.effectiveEnd, 'createdAt');
    let ga4Daily: any = null;
    let ga4: any = this.notConnected();
    if (this.ga4Ready()) {
      try {
        const report = await this.ga4.customReport({
          startDate: period.startDate,
          endDate: period.endDate,
          dimensions: ['date'],
          metrics: ['ecommercePurchases', 'purchaseRevenue'],
          limit: 400,
        });
        ga4Daily = report.rows.map((row) => ({
          date: `${row.dimensions.date.slice(0, 4)}-${row.dimensions.date.slice(4, 6)}-${row.dimensions.date.slice(6, 8)}`,
          purchases: row.metrics.ecommercePurchases,
          revenue: row.metrics.purchaseRevenue,
        }));
        ga4 = { status: 'ready', propertyTimeZoneNote: 'Tanggal GA4 mengikuti zona waktu properti.' };
      } catch {
        ga4 = { status: 'error', message: 'Purchase GA4 belum dapat dimuat.' };
      }
    }
    return {
      period: { startDate: period.startDate, endDate: period.endDate, timezone: period.timezone },
      server: {
        measurementProtocol: this.measurementConfigured() ? 'configured' : 'not_configured',
        missing: this.measurementMissing(),
      },
      ga4,
      ...reconcilePurchases(rows as PaymentLike[], ga4Daily),
    };
  }

  measurementMissing(): string[] {
    return ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET'].filter((name) => !this.config.get<string>(name)?.trim());
  }

  measurementConfigured() {
    return this.measurementMissing().length === 0;
  }

  /**
   * Outbox: one purchase event per verified-paid order, sent after settlement so
   * the payment webhook never waits on Google. GA4 additionally de-duplicates on
   * transaction_id, so a replayed send cannot double revenue.
   */
  @Cron('*/2 * * * *', { name: 'ga4_purchase_dispatch', timeZone: 'Asia/Jakarta' })
  async dispatchPending() {
    if (!this.measurementConfigured()) return { sent: 0, skipped: 0, failed: 0 };
    const pending = await this.payments.find({
      where: [
        { status: 'success', ga4PurchaseStatus: IsNull() },
        { status: 'success', ga4PurchaseStatus: 'failed', ga4PurchaseAttempts: LessThan(MP_MAX_ATTEMPTS) },
      ] as any,
      order: { id: 'ASC' },
      take: 25,
    });
    const result = { sent: 0, skipped: 0, failed: 0 };
    for (const payment of pending) {
      if (!isVerifiedPaid(payment as PaymentLike)) {
        // Free activations and simulations are never purchases; mark so they stop being picked up.
        await this.payments.update({ id: payment.id }, { ga4PurchaseStatus: 'skipped', ga4PurchaseError: 'Bukan pembayaran gateway' });
        result.skipped++;
        continue;
      }
      const settled = new Date(payment.settlementTime ?? payment.createdAt).getTime();
      if (!payment.gaClientId || Date.now() - settled > MP_MAX_AGE_MS) {
        await this.payments.update(
          { id: payment.id },
          { ga4PurchaseStatus: 'skipped', ga4PurchaseError: payment.gaClientId ? 'Lebih dari 72 jam' : 'Tidak ada GA client id' },
        );
        result.skipped++;
        continue;
      }
      try {
        await this.sendPurchase(payment);
        await this.payments.update({ id: payment.id }, { ga4PurchaseStatus: 'sent', ga4PurchaseSentAt: new Date(), ga4PurchaseError: null, ga4PurchaseAttempts: payment.ga4PurchaseAttempts + 1 });
        result.sent++;
      } catch (error) {
        await this.payments.update(
          { id: payment.id },
          { ga4PurchaseStatus: 'failed', ga4PurchaseAttempts: payment.ga4PurchaseAttempts + 1, ga4PurchaseError: String((error as Error).message).slice(0, 190) },
        );
        result.failed++;
      }
    }
    if (pending.length) this.logger.log(`GA4 purchase dispatch ${JSON.stringify(result)}`);
    return result;
  }

  async sendPurchase(payment: Payment) {
    const params = new URLSearchParams({
      measurement_id: this.config.get<string>('GA4_MEASUREMENT_ID')!.trim(),
      api_secret: this.config.get<string>('GA4_API_SECRET')!.trim(),
    });
    const amount = Number(payment.amount);
    const item = payment.purpose === 'ai_credits' ? { item_id: 'ai_credits', item_name: 'Kredit AI' } : { item_id: payment.package ?? 'invitation', item_name: `Paket ${payment.package ?? 'undangan'}` };
    const response = await axios.post(
      `${MP_URL}?${params.toString()}`,
      {
        client_id: payment.gaClientId,
        events: [{
          name: 'purchase',
          params: {
            transaction_id: payment.orderId, // GA4 de-duplicates purchase events on this id
            value: amount,
            currency: 'IDR',
            payment_purpose: payment.purpose,
            ...(payment.purpose === 'invitation' && Number.isInteger(payment.templateDesignIdSnapshot) && payment.templateDesignIdSnapshot! > 0
              ? { content_group: `template/${payment.templateDesignIdSnapshot}` }
              : {}),
            items: [{ ...item, price: amount, quantity: 1 }],
            engagement_time_msec: 1,
          },
        }],
      },
      { timeout: 10_000, maxRedirects: 0, validateStatus: (status) => status >= 200 && status < 300 },
    );
    return response.status;
  }

  // ---- ADM-027: attribution --------------------------------------------------

  async attribution(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const paid = (await this.paymentsInRange(period.start, period.effectiveEnd, 'createdAt')).filter((p) => isVerifiedPaid(p as PaymentLike));
    const orders = new Map<string, { label: string; orders: number; revenue: number }>();
    for (const payment of paid) {
      const label = attributionLabel(payment as PaymentLike);
      const row = orders.get(label) ?? { label, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(payment.amount);
      orders.set(label, row);
    }
    let sessions: any = this.notConnected();
    if (this.ga4Ready()) {
      try {
        const [bySession, byFirstUser] = await Promise.all([
          this.ga4.customReport({ startDate: period.startDate, endDate: period.endDate, dimensions: ['sessionSource', 'sessionMedium', 'sessionCampaignName'], metrics: ['sessions', 'activeUsers'], limit: 50, orderMetric: 'sessions' }),
          this.ga4.customReport({ startDate: period.startDate, endDate: period.endDate, dimensions: ['firstUserSource', 'firstUserMedium'], metrics: ['newUsers'], limit: 50, orderMetric: 'newUsers' }),
        ]);
        const gateways = bySession.rows.filter((row) => GATEWAY_SOURCES.includes(String(row.dimensions.sessionSource).toLowerCase()));
        sessions = {
          status: 'ready',
          sessionSource: bySession.rows,
          firstUserSource: byFirstUser.rows,
          gatewayReferrals: gateways,
          warnings: gateways.length
            ? ['Sebagian sesi berasal dari domain login/pembayaran (mis. accounts.google.com, midtrans). Daftarkan sebagai referral exclusion di GA4 agar tidak mengambil kredit kanal.']
            : [],
        };
      } catch {
        sessions = { status: 'error', message: 'Sumber trafik GA4 belum dapat dimuat.' };
      }
    }
    return {
      period: { startDate: period.startDate, endDate: period.endDate, timezone: period.timezone },
      paidOrders: { total: paid.length, bySource: [...orders.values()].sort((a, b) => b.orders - a.orders) },
      ga4: sessions,
      definitions: {
        paidOrders: 'Sumber dicatat browser saat checkout dari parameter UTM/referrer pertama. Order tanpa data ditulis "unknown" dan tidak ditebak.',
        sessionSource: 'Sumber sesi berlaku untuk satu kunjungan; first-user source adalah sumber kunjungan pertama pengguna. Keduanya berbeda dan tidak dijumlahkan.',
        gateways: 'Domain login dan gateway pembayaran tidak dianggap sumber akuisisi.',
      },
    };
  }

  // ---- ADM-028: data quality -------------------------------------------------

  async quality() {
    const now = new Date();
    const today = jakartaDate(now);
    const since = new Date(now.getTime() - 30 * 24 * 3_600_000);
    const payments = await this.payments.find({ where: { createdAt: MoreThanOrEqual(since), status: 'success' } as any });
    let ga4: any = null;
    if (this.ga4Ready()) {
      try {
        const start = jakartaDate(new Date(now.getTime() - 3 * 24 * 3_600_000));
        const monthStart = jakartaDate(since);
        const [recent, sources, duplicates] = await Promise.all([
          this.ga4.customReport({ startDate: start, endDate: today, dimensions: ['date'], metrics: ['eventCount'], limit: 10 }),
          this.ga4.customReport({ startDate: monthStart, endDate: today, dimensions: ['sessionSource'], metrics: ['sessions'], limit: 200, orderMetric: 'sessions' }),
          this.ga4.customReport({ startDate: monthStart, endDate: today, dimensions: ['transactionId'], metrics: ['ecommercePurchases'], limit: 100, orderMetric: 'ecommercePurchases' }),
        ]);
        const dates = recent.rows.filter((r) => (r.metrics.eventCount ?? 0) > 0).map((r) => r.dimensions.date).sort();
        const last = dates[dates.length - 1];
        const total = sources.rows.reduce((sum, r) => sum + (r.metrics.sessions ?? 0), 0);
        const unknown = sources.rows
          .filter((r) => ['(direct)', '(not set)', '(none)'].includes(String(r.dimensions.sessionSource)))
          .reduce((sum, r) => sum + (r.metrics.sessions ?? 0), 0);
        ga4 = {
          lastEventDate: last ? `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}` : null,
          sessions: total,
          unknownSourceSessions: unknown,
          duplicatePurchaseIds: duplicates.rows.filter((r) => (r.metrics.ecommercePurchases ?? 0) > 1 && r.dimensions.transactionId !== '(not set)').length,
        };
      } catch {
        return { status: 'error', message: 'Pemeriksaan GA4 gagal; kualitas data belum dapat dinilai.', checkedAt: now.toISOString() };
      }
    }
    const trackingValidFrom = this.config.get<string>('GA4_TRACKING_VALID_FROM') || '2026-10-29';
    return {
      status: ga4 ? 'ready' : 'not_connected',
      checkedAt: now.toISOString(),
      expectedEventSchemaVersion: '2',
      trackingValidFrom,
      ...qualityAlerts({ today, trackingValidFrom, ga4, payments: payments as PaymentLike[] }),
    };
  }

  // ---- ADM-029: scheduled insights & annotations ------------------------------

  @Cron('15 9 * * *', { name: 'analytics_insights_daily', timeZone: 'Asia/Jakarta' })
  async scheduledInsights() {
    try {
      await this.refreshInsights({ days: 30 });
    } catch (error) {
      this.logger.error(`Insight harian gagal: ${(error as Error).message}`);
    }
  }

  async refreshInsights(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const funnel = await this.funnel(query);
    const attribution = await this.attribution(query);
    let channels: any[] = [];
    let devices: any[] = [];
    let landingPages: any[] = [];
    if (this.ga4Ready()) {
      try {
        const range = { startDate: period.startDate, endDate: period.endDate };
        const [ch, dev, land] = await Promise.all([
          this.ga4.customReport({ ...range, dimensions: ['sessionSource'], metrics: ['sessions'], limit: 30, orderMetric: 'sessions' }),
          this.ga4.customReport({ ...range, dimensions: ['deviceCategory'], metrics: ['sessions', 'engagementRate'], limit: 10 }),
          this.ga4.customReport({ ...range, dimensions: ['landingPage'], metrics: ['sessions', 'engagementRate'], limit: 30, orderMetric: 'sessions' }),
        ]);
        const ordersBySource = new Map<string, number>();
        for (const row of attribution.paidOrders.bySource) ordersBySource.set(row.label.split(' / ')[0], row.orders);
        channels = ch.rows.map((r) => ({ channel: String(r.dimensions.sessionSource).toLowerCase(), sessions: r.metrics.sessions ?? 0, paidOrders: ordersBySource.get(String(r.dimensions.sessionSource).toLowerCase()) ?? 0 }));
        devices = dev.rows.map((r) => ({ device: r.dimensions.deviceCategory, sessions: r.metrics.sessions ?? 0, engagementRate: r.metrics.engagementRate }));
        landingPages = land.rows.map((r) => ({ page: r.dimensions.landingPage, sessions: r.metrics.sessions ?? 0, engagementRate: r.metrics.engagementRate }));
      } catch {
        // GA4-based rules are skipped; funnel rule below still runs on backend data.
      }
    }
    const candidates = deriveInsights({ channels, devices, landingPages, funnel: funnel.backend });
    await this.insights.delete({ periodStart: period.startDate, periodEnd: period.endDate });
    const saved = candidates.length
      ? await this.insights.save(candidates.map((c) => this.insights.create({ ...c, periodStart: period.startDate, periodEnd: period.endDate })))
      : [];
    return { generated: saved.length, period: { startDate: period.startDate, endDate: period.endDate } };
  }

  async listInsights(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const items = await this.insights.find({ where: { periodEnd: MoreThanOrEqual(period.startDate) as any }, order: { generatedAt: 'DESC' }, take: 30 });
    const annotations = await this.annotations.find({ where: { date: Between(period.startDate, period.endDate) as any }, order: { date: 'DESC' }, take: 50 });
    const latest = items[0]?.generatedAt ?? null;
    return {
      items,
      annotations,
      generatedAt: latest,
      note: items.length
        ? 'Insight dihitung terjadwal tiap pagi dari data situs sendiri. Penyebab selalu berupa dugaan; sampel kecil tidak dibuatkan insight.'
        : 'Belum ada insight. Insight muncul setelah sampel cukup (minimal 50 sesi per kelompok) dan data terhubung.',
    };
  }

  async addAnnotation(input: { date: string; kind: 'release' | 'campaign' | 'note'; label: string }, actorId: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw new BadRequestException('Tanggal tidak valid.');
    return this.annotations.save(this.annotations.create({ ...input, label: input.label.trim().slice(0, 200), createdById: actorId }));
  }

  async removeAnnotation(id: number) {
    await this.annotations.delete({ id });
    return { removed: id };
  }
}
