import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService } from './maintenance.service';

function service(initial?: Record<string, any>) {
  const store: { row: any } = { row: initial ? { key: 'maintenance', value: initial, updatedAt: new Date(), updatedById: 1 } : null };
  const repo: any = {
    findOne: jest.fn(async () => store.row),
    save: jest.fn(async (row: any) => { store.row = { ...row, updatedAt: new Date() }; return store.row; }),
  };
  return { svc: new MaintenanceService(repo), repo };
}
const ctx = (method: string, url: string): any => ({
  getType: () => 'http',
  switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url }) }),
});

describe('MaintenanceService', () => {
  it('is off by default and exposes nothing to visitors', async () => {
    const { svc } = service();
    expect(await svc.isActive()).toBe(false);
    expect((await svc.publicStatus()).maintenance).toEqual({ active: false, message: null, until: null, blocks: [] });
  });

  it('requires a reason and a future end time before turning on', async () => {
    const { svc } = service();
    await expect(svc.update({ enabled: true }, 1)).rejects.toThrow(BadRequestException);
    await expect(svc.update({ enabled: true, reason: 'Migrasi', until: '2020-01-01T00:00:00Z' }, 1)).rejects.toThrow(BadRequestException);
    const ok = await svc.update({ enabled: true, reason: 'Migrasi database' }, 1);
    expect(ok.enabled).toBe(true);
    expect((await svc.publicStatus()).maintenance.blocks).toEqual(['checkout']);
  });

  it('never leaks the internal reason to the public status', async () => {
    const { svc } = service();
    await svc.update({ enabled: true, reason: 'rahasia internal', message: 'Kami kembali sebentar lagi.' }, 1);
    expect(JSON.stringify(await svc.publicStatus())).not.toContain('rahasia internal');
  });

  it('ends by itself once the planned end time passes', async () => {
    const { svc } = service({ enabled: true, message: 'm', reason: 'r', until: new Date(Date.now() + 60_000).toISOString() });
    expect(await svc.isActive()).toBe(true);
    expect(await svc.isActive(new Date(Date.now() + 120_000))).toBe(false);
  });

  it('treats a storage failure as off instead of locking visitors out', async () => {
    const repo: any = { findOne: jest.fn().mockRejectedValue(new Error('db down')) };
    expect(await new MaintenanceService(repo).isActive()).toBe(false);
  });
});

describe('MaintenanceGuard', () => {
  it('blocks only new checkout while active', async () => {
    const { svc } = service({ enabled: true, message: 'Sedang perawatan', reason: 'r', until: null });
    const guard = new MaintenanceGuard(svc);
    await expect(guard.canActivate(ctx('POST', '/payment/create'))).rejects.toThrow(ServiceUnavailableException);
    expect(await guard.canActivate(ctx('POST', '/payment/notification'))).toBe(true);
    expect(await guard.canActivate(ctx('GET', '/payment/packages'))).toBe(true);
    expect(await guard.canActivate(ctx('POST', '/auth/admin/login'))).toBe(true);
    expect(await guard.canActivate(ctx('PATCH', '/admin/maintenance'))).toBe(true);
  });

  it('allows checkout when maintenance is off', async () => {
    const guard = new MaintenanceGuard(service().svc);
    expect(await guard.canActivate(ctx('POST', '/payment/create'))).toBe(true);
  });
});
