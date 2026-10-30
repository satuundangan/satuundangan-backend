import { AdminService } from './admin.service';

const service = Object.create(AdminService.prototype) as any;

describe('invitation list date filters', () => {
  it('reads a calendar day in WIB so it matches the dashboard period', () => {
    expect(service.wibDayBoundary('2026-10-20', 'start').toISOString()).toBe('2026-10-19T17:00:00.000Z');
    expect(service.wibDayBoundary('2026-10-20', 'end').toISOString()).toBe('2026-10-20T16:59:59.999Z');
  });

  it('keeps an invitation created at 01:00 WIB inside that WIB day', () => {
    const createdAt = new Date('2026-10-19T18:00:00Z'); // 2026-10-20 01:00 WIB
    expect(createdAt >= service.wibDayBoundary('2026-10-20', 'start')).toBe(true);
    expect(createdAt <= service.wibDayBoundary('2026-10-20', 'end')).toBe(true);
    expect(createdAt <= service.wibDayBoundary('2026-10-19', 'end')).toBe(false);
  });
});
