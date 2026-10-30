import { AdminHealthService } from './admin-health.service';

const config = (values: Record<string, string>): any => ({ get: (key: string) => values[key] });
const dataSource = (query: jest.Mock): any => ({ query });

describe('AdminHealthService', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('does not call a service healthy just because credentials exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false }) as any;
    const svc = new AdminHealthService(
      config({ MIDTRANS_SERVER_KEY: 'SB-Mid-server-xxx', CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' }),
      dataSource(jest.fn().mockResolvedValue([])),
    );
    const { services, worst } = await svc.check(true);
    const by = Object.fromEntries(services.map((s) => [s.key, s]));
    expect(by.payment.status).toBe('error');
    expect(by.email.status).toBe('error');
    expect(by.database.status).toBe('available');
    expect(worst).toBe('error');
  });

  it('reports a missing required credential as error and an unconfigured optional one as unknown', async () => {
    global.fetch = jest.fn() as any;
    const svc = new AdminHealthService(config({}), dataSource(jest.fn().mockResolvedValue([])));
    const { services } = await svc.check(true);
    const by = Object.fromEntries(services.map((s) => [s.key, s]));
    expect(by.payment).toMatchObject({ status: 'error', required: true });
    expect(by.analytics).toMatchObject({ status: 'unknown', required: false });
    expect(by.storage.status).toBe('degraded');
  });

  it('marks a reachable gateway that accepts the key as available and records how it was checked', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 404, ok: false }) as any;
    const svc = new AdminHealthService(config({ MIDTRANS_SERVER_KEY: 'k' }), dataSource(jest.fn().mockResolvedValue([])));
    const payment = (await svc.check(true)).services.find((s) => s.key === 'payment')!;
    expect(payment.status).toBe('available');
    expect(payment.method).toContain('status order uji');
    expect(payment.latencyMs).not.toBeNull();
    expect(payment.checkedAt).toBeTruthy();
  });

  it('surfaces a failing database probe instead of hiding it, without echoing secrets', async () => {
    global.fetch = jest.fn() as any;
    const svc = new AdminHealthService(config({}), dataSource(jest.fn().mockRejectedValue(new Error('connect failed token=abc123'))));
    const db = (await svc.check(true)).services.find((s) => s.key === 'database')!;
    expect(db.status).toBe('error');
    expect(db.message).not.toContain('abc123');
  });

  it('caches results briefly so the page does not hammer providers', async () => {
    global.fetch = jest.fn() as any;
    const query = jest.fn().mockResolvedValue([]);
    const svc = new AdminHealthService(config({}), dataSource(query));
    await svc.check(true);
    await svc.check();
    expect(query).toHaveBeenCalledTimes(1);
    await svc.check(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
