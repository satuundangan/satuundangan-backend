import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

export type HealthStatus = 'available' | 'configured' | 'degraded' | 'error' | 'unknown';

export interface ServiceHealth {
  key: string;
  label: string;
  /** A failing required service stops the product; an optional one only limits reporting. */
  required: boolean;
  status: HealthStatus;
  message: string;
  latencyMs: number | null;
  checkedAt: string;
  /** What exactly was checked, so "available" is not mistaken for a stronger claim. */
  method: string;
}

const PROBE_TIMEOUT_MS = 4_000;
const SLOW_MS = 800;
const CACHE_MS = 30_000;
const SEVERITY: Record<HealthStatus, number> = { available: 0, configured: 1, unknown: 2, degraded: 3, error: 4 };

@Injectable()
export class AdminHealthService {
  private cache: { at: number; value: ReturnType<AdminHealthService['summarize']> } | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async check(refresh = false) {
    if (!refresh && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const services = await Promise.all([
      this.probe('database', 'Database', true, () => this.checkDatabase()),
      this.probe('storage', 'Penyimpanan file (R2)', true, () => this.checkStorage()),
      this.probe('payment', 'Payment gateway (Midtrans)', true, () => this.checkMidtrans()),
      this.probe('email', 'Email (Cloudflare)', true, () => this.checkEmail()),
      this.probe('analytics', 'Laporan GA4', false, async () => this.checkGa4()),
    ]);
    const value = this.summarize(services);
    this.cache = { at: Date.now(), value };
    return value;
  }

  private summarize(services: ServiceHealth[]) {
    const worst = services.reduce<HealthStatus>(
      (acc, item) => (SEVERITY[item.status] > SEVERITY[acc] ? item.status : acc),
      'available',
    );
    return { checkedAt: new Date().toISOString(), worst, services };
  }

  private async probe(
    key: string,
    label: string,
    required: boolean,
    run: () => Promise<Pick<ServiceHealth, 'status' | 'message' | 'method'>>,
  ): Promise<ServiceHealth> {
    const started = Date.now();
    try {
      const result = await run();
      return { key, label, required, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), ...result };
    } catch (error) {
      return {
        key, label, required,
        status: 'error',
        message: `Pemeriksaan gagal: ${this.safeMessage(error)}`,
        method: 'probe',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /** Error text shown to admins must never echo a credential. */
  private safeMessage(error: unknown): string {
    const text = String((error as Error)?.message ?? error ?? 'tidak diketahui');
    return text.replace(/(key|token|secret|authorization)[=:\s]+\S+/gi, '$1=[disembunyikan]').slice(0, 160);
  }

  private async checkDatabase() {
    const started = Date.now();
    await this.dataSource.query('SELECT 1');
    const ms = Date.now() - started;
    return {
      status: (ms >= SLOW_MS ? 'degraded' : 'available') as HealthStatus,
      message: ms >= SLOW_MS ? `Terhubung tetapi lambat (${ms} ms)` : `Query uji berhasil (${ms} ms)`,
      method: 'SELECT 1',
    };
  }

  private async checkStorage() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const bucket = this.config.get<string>('R2_BUCKET_NAME');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      return {
        status: 'degraded' as HealthStatus,
        message: 'R2 belum dikonfigurasi; upload memakai disk lokal yang hilang saat container diganti.',
        method: 'env',
      };
    }
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return { status: 'available' as HealthStatus, message: `Bucket ${bucket} dapat diakses`, method: 'HeadBucket' };
    } finally {
      client.destroy();
    }
  }

  private async checkMidtrans() {
    const serverKey = this.config.get<string>('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      return { status: 'error' as HealthStatus, message: 'MIDTRANS_SERVER_KEY belum diisi.', method: 'env' };
    }
    const production = this.config.get<string>('MIDTRANS_IS_PRODUCTION') === 'true';
    const base = production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    // A status lookup for an order that cannot exist: 404 proves the key is accepted without touching real data.
    const response = await fetch(`${base}/v2/health-${randomUUID()}/status`, {
      headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const mode = production ? 'production' : 'sandbox';
    if (response.status === 404 || response.status === 200) {
      return { status: 'available' as HealthStatus, message: `Midtrans ${mode} menerima kredensial`, method: 'GET status order uji' };
    }
    if (response.status === 401) {
      return { status: 'error' as HealthStatus, message: `Midtrans ${mode} menolak server key (401)`, method: 'GET status order uji' };
    }
    return { status: 'degraded' as HealthStatus, message: `Midtrans ${mode} membalas HTTP ${response.status}`, method: 'GET status order uji' };
  }

  private async checkEmail() {
    const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.config.get<string>('CLOUDFLARE_API_TOKEN');
    if (!accountId || !token) {
      return { status: 'error' as HealthStatus, message: 'Kredensial Cloudflare email belum lengkap.', method: 'env' };
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok) {
      return { status: 'available' as HealthStatus, message: 'Token Cloudflare valid (pengiriman email tidak diuji)', method: 'token verify' };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: 'error' as HealthStatus, message: `Token Cloudflare ditolak (${response.status})`, method: 'token verify' };
    }
    return { status: 'degraded' as HealthStatus, message: `Cloudflare membalas HTTP ${response.status}`, method: 'token verify' };
  }

  private checkGa4() {
    const configured = ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_EMAIL', 'GA4_PRIVATE_KEY'].every((name) => this.config.get<string>(name));
    return configured
      ? { status: 'configured' as HealthStatus, message: 'Kredensial GA4 ada; akses properti belum diuji dari sini.', method: 'env' }
      : { status: 'unknown' as HealthStatus, message: 'Belum tersambung ke GA4; laporan visitor tidak tersedia.', method: 'env' };
  }
}
