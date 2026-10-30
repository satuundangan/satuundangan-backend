import { jakartaDate } from '../admin/admin-dashboard-period';

export const MATURITY_DAYS = 7;
export const MIN_SAMPLE = 50;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Domains that carry a customer through login or payment and must never be credited as an acquisition source. */
export const GATEWAY_SOURCES = [
  'accounts.google.com',
  'app.midtrans.com',
  'app.sandbox.midtrans.com',
  'simulator.sandbox.midtrans.com',
  'midtrans.com',
  'snap.midtrans.com',
];

export interface PaymentLike {
  id: number;
  orderId?: string;
  invitationId?: number | null;
  amount: number | string;
  status: string;
  purpose?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  settlementTime?: Date | string | null;
  createdAt: Date | string;
  gaClientId?: string | null;
  acquisition?: { source?: string; medium?: string; campaign?: string } | null;
  ga4PurchaseStatus?: string | null;
}

export interface InvitationLike {
  id: number;
  createdAt: Date | string;
  isPublished?: boolean;
}

/** Real money from the gateway only: free activations, simulations, pending and failed orders are not purchases. */
export function isVerifiedPaid(payment: PaymentLike): boolean {
  return (
    payment.status === 'success' &&
    payment.paymentMethod === 'midtrans' &&
    !['simulation', 'free'].includes(String(payment.paymentType ?? '')) &&
    !String(payment.orderId ?? '').startsWith('FREE-') &&
    Number(payment.amount) > 0
  );
}

export function classifyPayment(payment: PaymentLike): 'paid' | 'free' | 'simulation' | 'pending' | 'failed' {
  if (isVerifiedPaid(payment)) return 'paid';
  if (payment.paymentType === 'simulation') return 'simulation';
  if (payment.paymentType === 'free' || String(payment.orderId ?? '').startsWith('FREE-')) return 'free';
  if (payment.status === 'pending') return 'pending';
  return 'failed';
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const hours = (ms: number) => Math.round((ms / HOUR) * 10) / 10;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/**
 * Funnel on invitations created in the period. Order is created -> checkout ->
 * paid -> published; an anonymous Studio session has no row here until it is
 * saved, so earlier steps come from GA4 events instead.
 */
export function buildFunnel(
  invitations: InvitationLike[],
  payments: PaymentLike[],
  now = new Date(),
) {
  const byInvitation = new Map<number, PaymentLike[]>();
  for (const payment of payments) {
    if (payment.invitationId == null) continue;
    byInvitation.set(payment.invitationId, [...(byInvitation.get(payment.invitationId) ?? []), payment]);
  }
  const matureBefore = now.getTime() - MATURITY_DAYS * DAY;
  const build = (rows: InvitationLike[]) => {
    let checkout = 0;
    let paid = 0;
    let free = 0;
    let published = 0;
    const toCheckout: number[] = [];
    const toPaid: number[] = [];
    for (const invitation of rows) {
      const created = new Date(invitation.createdAt).getTime();
      const own = byInvitation.get(invitation.id) ?? [];
      const attempts = own.filter((p) => ['paid', 'pending', 'failed'].includes(classifyPayment(p)));
      const paidOrders = own.filter(isVerifiedPaid);
      if (attempts.length) {
        checkout++;
        toCheckout.push(Math.min(...attempts.map((p) => new Date(p.createdAt).getTime())) - created);
      }
      if (paidOrders.length) {
        paid++;
        toPaid.push(
          Math.min(...paidOrders.map((p) => new Date(p.settlementTime ?? p.createdAt).getTime())) - created,
        );
      }
      if (!paidOrders.length && own.some((p) => classifyPayment(p) === 'free')) free++;
      if (invitation.isPublished) published++;
    }
    const total = rows.length;
    return {
      stages: [
        { key: 'draft_created', label: 'Undangan dibuat', count: total, rateFromPrevious: null, rateFromStart: total ? 100 : null },
        { key: 'checkout_started', label: 'Masuk checkout', count: checkout, rateFromPrevious: pct(checkout, total), rateFromStart: pct(checkout, total) },
        { key: 'paid', label: 'Dibayar (terverifikasi)', count: paid, rateFromPrevious: pct(paid, checkout), rateFromStart: pct(paid, total) },
        { key: 'published', label: 'Dipublikasikan', count: published, rateFromPrevious: pct(published, paid + free), rateFromStart: pct(published, total) },
      ],
      freeActivated: free,
      dropoff: [
        { from: 'draft_created', to: 'checkout_started', lost: total - checkout },
        { from: 'checkout_started', to: 'paid', lost: checkout - paid },
      ],
      medianHours: { toCheckout: median(toCheckout.map(hours)), toPaid: median(toPaid.map(hours)) },
    };
  };
  const mature = invitations.filter((i) => new Date(i.createdAt).getTime() <= matureBefore);
  const immature = invitations.length - mature.length;
  return {
    all: build(invitations),
    mature: build(mature),
    cohort: {
      size: invitations.length,
      matureSize: mature.length,
      immatureSize: immature,
      maturityDays: MATURITY_DAYS,
      note: immature
        ? `${immature} undangan dibuat kurang dari ${MATURITY_DAYS} hari lalu dan masih bisa berubah; gunakan angka kohort matang untuk membandingkan.`
        : null,
    },
  };
}

export function reconcilePurchases(
  payments: PaymentLike[],
  ga4Daily: Array<{ date: string; purchases: number | null; revenue: number | null }> | null,
) {
  const days = new Map<string, { date: string; backendOrders: number; backendRevenue: number }>();
  const excluded = { free: 0, simulation: 0, pending: 0, failed: 0 };
  const dispatch = { sent: 0, failed: 0, skipped: 0, waiting: 0 };
  for (const payment of payments) {
    const kind = classifyPayment(payment);
    if (kind !== 'paid') {
      excluded[kind]++;
      continue;
    }
    const date = jakartaDate(new Date(payment.settlementTime ?? payment.createdAt));
    const row = days.get(date) ?? { date, backendOrders: 0, backendRevenue: 0 };
    row.backendOrders += 1;
    row.backendRevenue += Number(payment.amount);
    days.set(date, row);
    const state = payment.ga4PurchaseStatus;
    if (state === 'sent' || state === 'failed' || state === 'skipped') dispatch[state]++;
    else dispatch.waiting++;
  }
  const ga4ByDate = new Map((ga4Daily ?? []).map((row) => [row.date, row]));
  const rows = [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const ga = ga4ByDate.get(row.date);
      return {
        ...row,
        ga4Purchases: ga ? ga.purchases : null,
        ga4Revenue: ga ? ga.revenue : null,
        orderDifference: ga && ga.purchases != null ? ga.purchases - row.backendOrders : null,
        revenueDifference: ga && ga.revenue != null ? ga.revenue - row.backendRevenue : null,
      };
    });
  const backendOrders = rows.reduce((sum, r) => sum + r.backendOrders, 0);
  const backendRevenue = rows.reduce((sum, r) => sum + r.backendRevenue, 0);
  const explanations: string[] = [];
  if (dispatch.waiting) explanations.push(`${dispatch.waiting} order belum dikirim ke GA4 (antrean pengiriman berjalan tiap 2 menit; hanya order 72 jam terakhir dikirim).`);
  if (dispatch.skipped) explanations.push(`${dispatch.skipped} order tidak dikirim karena tidak ada GA client id (checkout tanpa consent/browser) atau terlalu lama.`);
  if (dispatch.failed) explanations.push(`${dispatch.failed} order gagal dikirim ke GA4; sistem mencoba ulang sampai batas percobaan.`);
  explanations.push('GA4 memproses purchase dengan jeda dan tanggal GA4 mengikuti zona waktu properti; selisih satu hari di batas tengah malam wajar.');
  return {
    backend: { orders: backendOrders, revenue: backendRevenue },
    excluded,
    dispatch,
    daily: rows,
    explanations,
    definition: 'Order dibayar = status success dari Midtrans dengan nominal > 0. Aktivasi gratis, simulasi, pending dan gagal tidak dihitung.',
  };
}

export function attributionLabel(payment: PaymentLike): string {
  const a = payment.acquisition;
  if (!a || (!a.source && !a.medium && !a.campaign)) return 'unknown';
  const source = (a.source || '(not set)').toLowerCase();
  if (GATEWAY_SOURCES.includes(source)) return 'unknown';
  return `${source} / ${(a.medium || '(not set)').toLowerCase()}`;
}

export interface QualityInput {
  today: string;
  trackingValidFrom: string;
  ga4: null | {
    lastEventDate: string | null;
    sessions: number;
    unknownSourceSessions: number;
    duplicatePurchaseIds: number;
  };
  payments: PaymentLike[];
}

export function qualityAlerts(input: QualityInput) {
  const alerts: Array<{ level: 'warning' | 'critical' | 'info'; code: string; message: string }> = [];
  const verified = input.payments.filter(isVerifiedPaid);
  const sent = verified.filter((p) => p.ga4PurchaseStatus === 'sent').length;
  const coverage = verified.length ? Math.round((sent / verified.length) * 1000) / 10 : null;
  if (!input.ga4) {
    alerts.push({ level: 'info', code: 'ga4_not_connected', message: 'GA4 belum tersambung; pemeriksaan event, duplikasi, dan sumber tidak dapat dilakukan.' });
  } else {
    if (!input.ga4.lastEventDate) {
      alerts.push({ level: 'critical', code: 'no_events', message: 'GA4 tidak mengembalikan event pada 3 hari terakhir. Tracking mungkin putus atau data tertunda.' });
    } else if (input.ga4.lastEventDate < input.today) {
      const lag = Math.round((Date.parse(input.today) - Date.parse(input.ga4.lastEventDate)) / DAY);
      alerts.push({ level: lag >= 2 ? 'critical' : 'warning', code: 'events_delayed', message: `Event terakhir di GA4 bertanggal ${input.ga4.lastEventDate} (${lag} hari lalu).` });
    }
    if (input.ga4.duplicatePurchaseIds > 0) {
      alerts.push({ level: 'critical', code: 'duplicate_purchase', message: `${input.ga4.duplicatePurchaseIds} transaction_id muncul lebih dari sekali di GA4; revenue berpotensi ganda.` });
    }
    const unknownShare = input.ga4.sessions ? input.ga4.unknownSourceSessions / input.ga4.sessions : 0;
    if (input.ga4.sessions >= MIN_SAMPLE && unknownShare > 0.5) {
      alerts.push({ level: 'warning', code: 'unknown_source', message: `${Math.round(unknownShare * 100)}% sesi tanpa sumber jelas (direct/not set); atribusi kanal kurang dapat diandalkan.` });
    }
  }
  if (verified.length && coverage !== null && coverage < 90) {
    alerts.push({ level: 'warning', code: 'purchase_coverage', message: `Hanya ${coverage}% order dibayar yang terkirim ke GA4 (${sent}/${verified.length}).` });
  }
  alerts.push({ level: 'info', code: 'tracking_valid_from', message: `Data sebelum ${input.trackingValidFrom} memakai skema tracking lama dan tidak dibandingkan atau diisi ulang.` });
  return { alerts, purchaseCoverage: { percent: coverage, sent, verified: verified.length } };
}

export interface InsightCandidate {
  kind: string;
  title: string;
  detail: string;
  hypothesis: string;
  sample: Record<string, number | string | null>;
  link: string;
}

/** Rules compare the site with itself; no outside benchmark is assumed. */
export function deriveInsights(input: {
  channels: Array<{ channel: string; sessions: number; paidOrders: number }>;
  devices: Array<{ device: string; sessions: number; engagementRate: number | null }>;
  landingPages: Array<{ page: string; sessions: number; engagementRate: number | null }>;
  funnel: ReturnType<typeof buildFunnel> | null;
}): InsightCandidate[] {
  const insights: InsightCandidate[] = [];
  const totalSessions = input.channels.reduce((sum, c) => sum + c.sessions, 0);
  const totalPaid = input.channels.reduce((sum, c) => sum + c.paidOrders, 0);
  const baseRate = totalSessions ? totalPaid / totalSessions : 0;
  for (const channel of input.channels) {
    if (channel.sessions < MIN_SAMPLE * 2 || channel.channel === 'unknown') continue;
    const rate = channel.paidOrders / channel.sessions;
    if (rate < baseRate * 0.5) {
      insights.push({
        kind: 'channel_low_paid',
        title: `Kanal ${channel.channel} ramai tetapi jarang menghasilkan order berbayar`,
        detail: `${channel.sessions} sesi dan ${channel.paidOrders} order berbayar (${(rate * 100).toFixed(2)}%), dibanding ${(baseRate * 100).toFixed(2)}% untuk seluruh kanal pada periode yang sama.`,
        hypothesis: 'Dugaan: audiens kanal ini belum siap membeli atau landing page-nya kurang relevan. Perlu dicek, belum terbukti.',
        sample: { sessions: channel.sessions, paidOrders: channel.paidOrders, baselinePercent: Math.round(baseRate * 10000) / 100 },
        link: '/admin?tab=analytics',
      });
    }
  }
  const mobile = input.devices.find((d) => d.device === 'mobile');
  const desktop = input.devices.find((d) => d.device === 'desktop');
  if (mobile?.engagementRate != null && desktop?.engagementRate != null && mobile.sessions >= MIN_SAMPLE && desktop.sessions >= MIN_SAMPLE && desktop.engagementRate - mobile.engagementRate >= 0.15) {
    insights.push({
      kind: 'mobile_dropoff',
      title: 'Pengunjung mobile kurang terlibat dibanding desktop',
      detail: `Engagement rate mobile ${(mobile.engagementRate * 100).toFixed(1)}% vs desktop ${(desktop.engagementRate * 100).toFixed(1)}% (${mobile.sessions} dan ${desktop.sessions} sesi).`,
      hypothesis: 'Dugaan: tampilan atau kecepatan halaman di mobile bermasalah. Perlu pengujian perangkat nyata.',
      sample: { mobileSessions: mobile.sessions, desktopSessions: desktop.sessions },
      link: '/admin?tab=analytics',
    });
  }
  const pageSessions = input.landingPages.reduce((sum, p) => sum + p.sessions, 0);
  const rated = input.landingPages.filter((p) => p.engagementRate != null);
  const avg = rated.length ? rated.reduce((s, p) => s + (p.engagementRate as number) * p.sessions, 0) / Math.max(1, rated.reduce((s, p) => s + p.sessions, 0)) : null;
  if (avg != null && pageSessions >= MIN_SAMPLE) {
    for (const page of rated) {
      if (page.sessions >= MIN_SAMPLE && (page.engagementRate as number) <= avg - 0.2) {
        insights.push({
          kind: 'landing_low_engagement',
          title: `Halaman masuk ${page.page} kurang menarik dibanding halaman lain`,
          detail: `Engagement rate ${((page.engagementRate as number) * 100).toFixed(1)}% pada ${page.sessions} sesi, rata-rata situs ${(avg * 100).toFixed(1)}%.`,
          hypothesis: 'Dugaan: isi halaman tidak sesuai ekspektasi sumber trafik. Perlu ditinjau manual.',
          sample: { sessions: page.sessions, averagePercent: Math.round(avg * 1000) / 10 },
          link: '/admin/articles',
        });
      }
    }
  }
  if (input.funnel && input.funnel.mature.stages[0].count >= 20) {
    const [created, checkout, paid] = input.funnel.mature.stages;
    const lostBeforeCheckout = created.count - checkout.count;
    const lostAtPayment = checkout.count - paid.count;
    const worst = lostBeforeCheckout >= lostAtPayment ? ['draft_created', 'checkout_started', lostBeforeCheckout] : ['checkout_started', 'paid', lostAtPayment];
    insights.push({
      kind: 'funnel_dropoff',
      title: worst[0] === 'draft_created' ? 'Kehilangan terbesar: undangan dibuat tetapi tidak masuk checkout' : 'Kehilangan terbesar: masuk checkout tetapi tidak membayar',
      detail: `Pada kohort matang (${created.count} undangan): ${created.count} dibuat, ${checkout.count} masuk checkout, ${paid.count} dibayar.`,
      hypothesis: 'Dugaan penyebab belum diketahui; telusuri alasan lewat ulasan atau sesi nyata.',
      sample: { cohort: created.count, lost: Number(worst[2]) },
      link: '/admin/payments',
    });
  }
  return insights;
}
