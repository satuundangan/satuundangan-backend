import axios from 'axios';
import { AnalyticsReportsService } from './analytics-reports.service';

jest.mock('axios');
const post = axios.post as jest.Mock;

function build(payments: any[], env: Record<string, string> = { GA4_MEASUREMENT_ID: 'G-TEST', GA4_API_SECRET: 'secret' }) {
  const rows = payments.map((p) => ({ ...p }));
  const paymentRepo: any = {
    find: jest.fn(async () => rows.filter((p) => p.status === 'success' && (p.ga4PurchaseStatus == null || (p.ga4PurchaseStatus === 'failed' && p.ga4PurchaseAttempts < 5)))),
    update: jest.fn(async (criteria: any, patch: any) => { Object.assign(rows.find((p) => p.id === criteria.id), patch); }),
  };
  const ga4: any = { connection: () => ({ missing: ['GA4_PROPERTY_ID'] }) };
  const svc = new AnalyticsReportsService(ga4, { get: (k: string) => env[k] } as any, paymentRepo, {} as any, {} as any, {} as any);
  return { svc, rows, paymentRepo };
}
const paid = (over: Record<string, any> = {}) => ({
  id: 1, orderId: 'INV-1-1', amount: 150000, status: 'success', purpose: 'invitation', package: 'premium',
  paymentMethod: 'midtrans', paymentType: 'qris', settlementTime: new Date(), createdAt: new Date(),
  gaClientId: '1234567890.1234567890', ga4PurchaseStatus: null, ga4PurchaseAttempts: 0, ...over,
});

describe('GA4 purchase outbox', () => {
  beforeEach(() => { jest.clearAllMocks(); post.mockResolvedValue({ status: 204 }); });

  it('sends one purchase per verified order with the order id as transaction id', async () => {
    const { svc, rows } = build([paid()]);
    expect(await svc.dispatchPending()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    const [url, body] = post.mock.calls[0];
    expect(url).toContain('measurement_id=G-TEST');
    expect(body.events[0]).toMatchObject({ name: 'purchase', params: { transaction_id: 'INV-1-1', value: 150000, currency: 'IDR' } });
    expect(rows[0].ga4PurchaseStatus).toBe('sent');
  });

  it('does not resend after a successful dispatch, so a replay cannot double revenue', async () => {
    const { svc } = build([paid()]);
    await svc.dispatchPending();
    await svc.dispatchPending();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('never sends free, simulated or client-less orders as purchases', async () => {
    const { svc, rows } = build([
      paid({ id: 1, paymentType: 'simulation' }),
      paid({ id: 2, orderId: 'FREE-2-1', paymentType: 'free', paymentMethod: 'FREE_ACTIVATION', amount: 0 }),
      paid({ id: 3, orderId: 'INV-3-1', gaClientId: null }),
    ]);
    expect(await svc.dispatchPending()).toEqual({ sent: 0, skipped: 3, failed: 0 });
    expect(post).not.toHaveBeenCalled();
    expect(rows.map((r) => r.ga4PurchaseStatus)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(rows[2].ga4PurchaseError).toContain('GA client id');
  });

  it('skips orders too old for Measurement Protocol instead of pretending they were sent', async () => {
    const old = new Date(Date.now() - 80 * 3_600_000);
    const { svc, rows } = build([paid({ settlementTime: old, createdAt: old })]);
    await svc.dispatchPending();
    expect(rows[0].ga4PurchaseStatus).toBe('skipped');
    expect(post).not.toHaveBeenCalled();
  });

  it('records a failure and retries up to a limit', async () => {
    post.mockRejectedValue(new Error('boom'));
    const { svc, rows } = build([paid()]);
    expect(await svc.dispatchPending()).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(rows[0]).toMatchObject({ ga4PurchaseStatus: 'failed', ga4PurchaseAttempts: 1 });
    rows[0].ga4PurchaseAttempts = 5;
    expect(await svc.dispatchPending()).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('does nothing until Measurement Protocol credentials exist', async () => {
    const { svc, paymentRepo } = build([paid()], {});
    expect(await svc.dispatchPending()).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(paymentRepo.find).not.toHaveBeenCalled();
    expect(svc.measurementMissing()).toEqual(['GA4_MEASUREMENT_ID', 'GA4_API_SECRET']);
  });
});
