import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createSign } from 'crypto';
import axios from 'axios';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';
import { resolveDashboardPeriod } from '../admin/admin-dashboard-period';

const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const CACHE_MS = 5 * 60 * 1000;
const MARKETING_PATH = '^(/|/blog(/.*)?|/templates|/tema(/.*)?|/tools/love-calculator|/wedding-planner|/tentang-kami|/terms|/privacy|/syarat-ketentuan|/kebijakan-privasi)$';
const METRICS = ['activeUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'engagementRate'];

interface GaRow { dimensions: Record<string, string>; metrics: Record<string, number | null> }
interface GaReport { rows: GaRow[]; rowCount: number; metadata: Record<string, any> }

@Injectable()
export class AdminAnalyticsService {
  private token: { key: string; value: string; expiresAt: number } | null = null;
  private readonly cache = new Map<string, { expiresAt: number; value: any }>();
  private readonly pending = new Map<string, Promise<any>>();

  constructor(private readonly config: ConfigService) {}

  async getReport(query: DashboardQueryDto): Promise<any> {
    const period = resolveDashboardPeriod(query);
    const propertyId = this.config.get<string>('GA4_PROPERTY_ID')?.trim() || '';
    const email = this.config.get<string>('GA4_SERVICE_ACCOUNT_EMAIL')?.trim() || '';
    const privateKey = (this.config.get<string>('GA4_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
    const missingConfiguration = [
      ...(!/^[1-9]\d{0,19}$/.test(propertyId) ? ['GA4_PROPERTY_ID'] : []),
      ...(!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email) ? ['GA4_SERVICE_ACCOUNT_EMAIL'] : []),
      ...(!privateKey.includes('PRIVATE KEY') ? ['GA4_PRIVATE_KEY'] : []),
    ];
    const base = {
      source: 'Google Analytics 4 Data API',
      period: { startDate: period.startDate, endDate: period.endDate, previousStartDate: period.previousStartDate, previousEndDate: period.previousEndDate, requestedTimeZone: 'Asia/Jakarta', includesToday: period.includesToday },
      scope: {
        name: 'Halaman marketing pada domain utama',
        hosts: ['satuundangan.id', 'www.satuundangan.id'],
        definition: 'Users dan sessions yang berinteraksi dengan halaman marketing yang dikenali. Halaman tamu, aplikasi pelanggan, demo, admin dan subdomain undangan dikecualikan.',
        pathPattern: MARKETING_PATH,
      },
    };
    if (missingConfiguration.length) return { ...base, status: 'not_connected', missingConfiguration, message: 'Akses baca laporan GA4 belum terkonfigurasi lengkap. Angka belum tersedia.' };

    const credentialKey = createHash('sha256').update(propertyId + email + privateKey).digest('hex');
    const cacheKey = credentialKey + ':' + period.startDate + ':' + period.endDate;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cache: { ...cached.value.cache, hit: true } };
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);
    const task = this.loadReport(base, propertyId, email, privateKey, credentialKey, period)
      .then((value) => {
        if (value.status === 'ready' || value.status === 'no_data') {
          if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value });
        }
        return value;
      })
      .finally(() => this.pending.delete(cacheKey));
    this.pending.set(cacheKey, task);
    return task;
  }

  private async loadReport(base: any, propertyId: string, email: string, privateKey: string, key: string, period: ReturnType<typeof resolveDashboardPeriod>) {
    try {
      const token = await this.accessToken(email, privateKey, key);
      const current = { startDate: period.startDate, endDate: period.endDate };
      const previous = { startDate: period.previousStartDate, endDate: period.previousEndDate };
      const [summary, previousSummary, daily, channels, devices, landingPages] = await Promise.all([
        this.runReport(propertyId, token, current, []),
        this.runReport(propertyId, token, previous, []),
        this.runReport(propertyId, token, current, ['date'], 366),
        this.runReport(propertyId, token, current, ['sessionDefaultChannelGroup'], 30),
        this.runReport(propertyId, token, current, ['deviceCategory'], 20),
        this.runReport(propertyId, token, current, ['landingPage'], 30),
      ]);
      const all = [summary, previousSummary, daily, channels, devices, landingPages];
      const timeZone = summary.metadata.timeZone || null;
      const warnings: string[] = [];
      if (timeZone !== 'Asia/Jakarta') warnings.push('Zona waktu properti GA4 belum sesuai atau belum diketahui. Tanggal Data API mengikuti zona properti, bukan konversi otomatis ke WIB.');
      if (period.includesToday) warnings.push('Hari ini masih parsial. Persentase pertumbuhan tidak dihitung terhadap periode sebelumnya yang sudah penuh.');
      if (all.some((report) => report.metadata.subjectToThresholding)) warnings.push('Laporan tunduk pada thresholding GA4; sebagian data dapat disembunyikan.');
      if (all.some((report) => report.metadata.dataLossFromOtherRow)) warnings.push('Sebagian kombinasi dimensi digabung Google ke kelompok lain.');
      if (all.some((report) => report.metadata.samplingMetadatas?.length)) warnings.push('Sebagian laporan menggunakan sampling dari Google.');
      if (channels.rowCount > channels.rows.length || devices.rowCount > devices.rows.length || landingPages.rowCount > landingPages.rows.length) warnings.push('Tabel dimensi menampilkan hasil teratas, bukan seluruh baris. Total users/sessions memakai laporan ringkasan, bukan penjumlahan tabel.');
      const generatedAt = new Date().toISOString();
      return {
        ...base, status: summary.rows.length ? 'ready' : 'no_data', propertyId,
        period: { ...base.period, propertyTimeZone: timeZone, comparisonComparable: !period.includesToday && timeZone === 'Asia/Jakarta' },
        generatedAt, cache: { hit: false, expiresAt: new Date(Date.now() + CACHE_MS).toISOString() },
        reports: {
          summary: { current: summary.rows[0]?.metrics || null, previous: previousSummary.rows[0]?.metrics || null },
          daily: daily.rows, channels: channels.rows, devices: devices.rows, landingPages: landingPages.rows,
        },
        warnings,
        emptyReason: summary.metadata.emptyReason || (summary.rows.length ? null : 'Tidak ada baris untuk periode dan filter ini; periksa tanggal tracking, filter, atau thresholding.'),
        definitions: {
          activeUsers: 'Active users menurut identitas dan definisi GA4, bukan jumlah manusia pasti.',
          sessions: 'Sesi yang memiliki interaksi dengan halaman marketing pada filter ini.',
          screenPageViews: 'Pageviews dapat berulang dari user yang sama.',
          engagementRate: 'Engaged sessions dibagi sessions menurut GA4.',
          acquisition: 'Channel memakai sessionDefaultChannelGroup, bukan first-user acquisition.',
          revenue: 'Nilai pembayaran tetap mengacu pada backend; laporan ini belum menyatakan purchase terverifikasi atau conversion pembelian.',
          freshness: 'Data GA4 dapat tertunda dan berubah setelah pemrosesan. generatedAt adalah waktu pengambilan laporan, bukan waktu kejadian terbaru.',
        },
      };
    } catch {
      this.token = null;
      return { ...base, status: 'error', message: 'Laporan GA4 belum dapat dimuat. Periksa akses Viewer akun layanan, aktivasi Google Analytics Data API, dan konfigurasi server. Silakan coba lagi.' };
    }
  }

  private async accessToken(email: string, privateKey: string, key: string) {
    if (this.token?.key === key && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    // Direct OAuth JWT exchange, following Google's documented service-account
    // flow. Scope is read-only; endpoints cannot be supplied by the caller.
    // https://developers.google.com/identity/protocols/oauth2/service-account
    const now = Math.floor(Date.now() / 1000);
    const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = encoded({ alg: 'RS256', typ: 'JWT' }) + '.' + encoded({ iss: email, scope: READONLY_SCOPE, aud: OAUTH_URL, iat: now, exp: now + 3600 });
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const assertion = unsigned + '.' + signer.sign(privateKey, 'base64url');
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString();
    const response = await axios.post(OAUTH_URL, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000, maxRedirects: 0 });
    if (typeof response.data.access_token !== 'string' || !response.data.access_token) throw new Error('Missing token');
    const expiresIn = Math.max(60, Math.min(Number(response.data.expires_in) || 3600, 3600));
    this.token = { key, value: response.data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return this.token.value;
  }

  private async runReport(propertyId: string, token: string, range: { startDate: string; endDate: string }, dimensions: string[], limit = 1): Promise<GaReport> {
    // pagePath has no query string; host restriction also excludes historical
    // invitation subdomains whose path used to be "/".
    const filters: any[] = [
      { filter: { fieldName: 'hostName', inListFilter: { values: ['satuundangan.id', 'www.satuundangan.id'], caseSensitive: false } } },
      { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'FULL_REGEXP', value: MARKETING_PATH, caseSensitive: true } } },
    ];
    if (dimensions.includes('landingPage')) filters.push({ filter: { fieldName: 'landingPage', stringFilter: { matchType: 'FULL_REGEXP', value: MARKETING_PATH, caseSensitive: true } } });
    const body = {
      dateRanges: [range], dimensions: dimensions.map((name) => ({ name })), metrics: METRICS.map((name) => ({ name })),
      dimensionFilter: { andGroup: { expressions: filters } }, limit,
      ...(dimensions.includes('date') ? { orderBys: [{ dimension: { dimensionName: 'date' } }] } : dimensions.length ? { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] } : {}),
    };
    const response = await axios.post('https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport', body, { headers: { Authorization: 'Bearer ' + token }, timeout: 15_000, maxRedirects: 0 });
    const report = response.data || {};
    const headers = report.dimensionHeaders || [];
    const metrics = report.metricHeaders || [];
    const rows: GaRow[] = (report.rows || []).map((row: any) => ({
      dimensions: Object.fromEntries(headers.map((header: any, index: number) => [header.name, safeDimension(row.dimensionValues?.[index]?.value)])),
      metrics: Object.fromEntries(metrics.map((header: any, index: number) => {
        const raw = row.metricValues?.[index]?.value;
        return [header.name, raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null];
      })),
    }));
    return { rows, rowCount: Number(report.rowCount) || rows.length, metadata: report.metadata || {} };
  }
}

function safeDimension(value: unknown): string {
  const text = String(value ?? '').split(/[?#]/)[0].slice(0, 180);
  return /@|%40/i.test(text) ? '[disamarkan]' : text;
}
