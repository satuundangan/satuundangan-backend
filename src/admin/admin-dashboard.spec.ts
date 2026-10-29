import { resolveDashboardPeriod } from './admin-dashboard-period';
import {
  aggregateDashboardPeriod,
  compareMetric,
} from './admin-dashboard-metrics';
import { AdminDashboardService } from './admin-dashboard.service';

describe('dashboard reporting periods', () => {
  const now = new Date('2026-10-29T01:00:00Z');

  it('uses Jakarta midnight and an equally elapsed previous period', () => {
    const p = resolveDashboardPeriod({ days: 7 }, now);
    expect(p.startDate).toBe('2026-10-23');
    expect(p.endDate).toBe('2026-10-29');
    expect(p.start.toISOString()).toBe('2026-10-22T17:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-10-29T17:00:00.000Z');
    expect(p.previousStartDate).toBe('2026-10-16');
    expect(p.previousEndDate).toBe('2026-10-22');
    expect(p.previousEffectiveEnd.getTime() - p.previousStart.getTime()).toBe(
      p.effectiveEnd.getTime() - p.start.getTime(),
    );
    expect(p.includesToday).toBe(true);
  });

  it('validates paired real dates, future dates, range limits and order', () => {
    for (const q of [
      { days: 8 },
      { startDate: '2026-10-01' },
      { startDate: '2026-02-30', endDate: '2026-03-01' },
      { startDate: '2026-10-29', endDate: '2026-10-28' },
      { startDate: '2026-10-28', endDate: '2026-10-30' },
      { startDate: '2025-01-01', endDate: '2026-10-01' },
    ])
      expect(() => resolveDashboardPeriod(q, now)).toThrow();
  });

  it('handles a one-day historical custom range without a partial-day flag', () => {
    const p = resolveDashboardPeriod(
      { startDate: '2026-10-20', endDate: '2026-10-20' },
      now,
    );
    expect(p.days).toBe(1);
    expect(p.effectiveEnd).toEqual(p.end);
    expect(p.includesToday).toBe(false);
  });
});

describe('dashboard overview sources', () => {
  function repository(rows: unknown[] = [], total: number | Error = 0) {
    const qb: any = { getRawMany: jest.fn().mockResolvedValue(rows) };
    for (const method of [
      'select',
      'addSelect',
      'leftJoin',
      'where',
      'andWhere',
    ])
      qb[method] = jest.fn().mockReturnValue(qb);
    return {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      count:
        total instanceof Error
          ? jest.fn().mockRejectedValue(total)
          : jest.fn().mockResolvedValue(total),
      qb,
    };
  }

  it('keeps an unavailable source unknown and counts active resellers specifically', async () => {
    const invitations = repository([], 3);
    const payments = repository([]);
    const users = repository([], 2);
    const guests = repository([], new Error('unavailable'));
    const templates = repository([], 5);
    const affiliates = repository([], 1);
    const withdrawals = repository([], 0);
    const service = new AdminDashboardService(
      invitations as any,
      payments as any,
      users as any,
      guests as any,
      templates as any,
      affiliates as any,
      withdrawals as any,
      {} as any,
    );
    const result = await service.getOverview({ days: 7 });
    expect(result.totals.guests).toBeNull();
    expect(result.sourceWarnings).toContain('guests');
    expect(result.totals.users).toBe(2);
    expect(affiliates.count).toHaveBeenCalledWith({
      where: { status: 'active' },
    });
    expect(withdrawals.count).toHaveBeenCalledWith({
      where: { status: 'pending' },
    });
    expect(result.period.timezone).toBe('Asia/Jakarta');
    expect(result.sources.visitors).toBe('not_connected');
  });

  it('propagates failure of the financial source instead of returning false zeros', async () => {
    const invitations = repository();
    const payments = repository();
    payments.qb.getRawMany.mockRejectedValue(new Error('payments offline'));
    const other = repository();
    const service = new AdminDashboardService(
      invitations as any,
      payments as any,
      other as any,
      other as any,
      other as any,
      other as any,
      other as any,
      {} as any,
    );
    await expect(service.getOverview({ days: 7 })).rejects.toThrow(
      'payments offline',
    );
  });
});

describe('dashboard financial units', () => {
  const p = resolveDashboardPeriod(
    { startDate: '2026-10-20', endDate: '2026-10-20' },
    new Date('2026-10-29T01:00:00Z'),
  );
  const occurred = new Date('2026-10-20T01:00:00Z');
  const paid = {
    id: 1,
    invitationId: 5,
    buyerId: 7,
    amount: '79000',
    discountAmount: 10000,
    status: 'success',
    purpose: 'invitation',
    paymentMethod: 'midtrans',
    paymentType: 'qris',
    settlementTime: occurred,
    createdAt: occurred,
  };

  it('deduplicates rows and distinguishes orders, invitations, buyers, free and AI', () => {
    const result = aggregateDashboardPeriod(
      [{ id: 5, createdAt: occurred, category: 'Modern' }],
      [
        paid,
        paid,
        { ...paid, id: 2, amount: 20000 },
        {
          ...paid,
          id: 3,
          amount: 0,
          paymentMethod: 'FREE_ACTIVATION',
          paymentType: 'free',
          buyerId: 8,
          invitationId: 6,
        },
        { ...paid, id: 4, amount: 5000, purpose: 'ai_credits' },
        { ...paid, id: 5, amount: 50000, paymentType: 'simulation' },
        { ...paid, id: 6, amount: 50000, settlementTime: null },
        { ...paid, id: 7, status: 'pending', settlementTime: null },
        { ...paid, id: 8, amount: -100 },
      ],
      p,
    );
    expect(result.metrics).toMatchObject({
      invitationsCreated: 1,
      revenue: 99000,
      paidOrders: 2,
      paidInvitations: 1,
      buyers: 1,
      freeActivations: 1,
      aiRevenue: 5000,
      aiOrders: 1,
      pendingOrders: 1,
      unverifiedSuccesses: 2,
      averageOrderValue: 49500,
    });
    expect(result.trend[0]).toMatchObject({
      date: '2026-10-20',
      count: 1,
      revenue: 99000,
      paidOrders: 2,
    });
    expect(result.categories).toEqual([{ category: 'Modern', count: 1 }]);
  });

  it('uses settlement time for money, half-open boundaries and retains archived order revenue', () => {
    const result = aggregateDashboardPeriod(
      [],
      [
        { ...paid, createdAt: new Date('2026-09-01'), invitationId: null },
        { ...paid, id: 2, settlementTime: p.end },
        { ...paid, id: 3, settlementTime: new Date(p.start.getTime() - 1) },
      ],
      p,
    );
    expect(result.metrics.revenue).toBe(79000);
    expect(result.metrics.paidInvitations).toBe(0);
    expect(result.metrics.paidOrders).toBe(1);
  });

  it('never invents growth percentages from a zero baseline', () => {
    expect(compareMetric(20, 0)).toEqual({
      value: 20,
      previous: 0,
      delta: 20,
      percent: null,
    });
    expect(compareMetric(30, 20)).toEqual({
      value: 30,
      previous: 20,
      delta: 10,
      percent: 50,
    });
    expect(compareMetric(0, 20).percent).toBe(-100);
  });

  it('flags malformed success timestamps rather than silently treating them as valid money', () => {
    const result = aggregateDashboardPeriod(
      [],
      [{ ...paid, settlementTime: 'not-a-date' }],
      p,
    );
    expect(result.metrics.revenue).toBe(0);
    expect(result.metrics.unverifiedSuccesses).toBe(1);
  });
});

import { buildActionQueue } from './admin-action-queue';

describe('action queue', () => {
  const now = new Date('2026-10-29T10:00:00Z');
  const reconciliation = {
    countsByType: { successNotPublished: 1, publishedUnpaid: 1, commissionPending: 0, pendingAging: 1 },
    items: [
      { type: 'PENDING_AGING', title: 'Menunggu Pembayaran > 24 Jam', description: 'Order A pending 30 jam', paymentId: 3, createdAt: '2026-10-28T04:00:00Z' },
      { type: 'PUBLISHED_UNPAID', title: 'Undangan Terbit Tanpa Bukti Lunas', description: 'Undangan X', invitationId: 9, createdAt: '2026-10-20T00:00:00Z' },
      { type: 'SUCCESS_NOT_PUBLISHED', title: 'Lunas Belum Terbit', description: 'Order B lunas', paymentId: 1, amount: 99000, createdAt: '2026-10-29T08:00:00Z' },
    ],
  };

  it('gives every row a reason, age, priority and a link, most urgent first', () => {
    const queue = buildActionQueue(reconciliation, { count: 0, oldestAt: null, totalAmount: 0 }, now);
    expect(queue.items.map((i) => i.type)).toEqual(['SUCCESS_NOT_PUBLISHED', 'PUBLISHED_UNPAID', 'PENDING_AGING']);
    for (const item of queue.items) {
      expect(item.reason).toBeTruthy();
      expect(item.ageHours).not.toBeNull();
      expect(item.link).toMatch(/^\/admin\//);
    }
    expect(queue.items[0]).toMatchObject({ priority: 1, priorityLabel: 'Tinggi', ageHours: 2 });
    expect(queue.items[1].link).toBe('/admin/invitations/9/edit');
  });

  it('keeps totals equal to the source page counts', () => {
    const queue = buildActionQueue(reconciliation, { count: 2, oldestAt: '2026-10-25T00:00:00Z', totalAmount: 150000 }, now);
    expect(queue.countsBySource).toEqual({ transaksi: 2, undangan: 1, payout: 2 });
    expect(queue.count).toBe(4);
  });

  it('shows pending payouts as one row without a dead link, escalating when old', () => {
    const queue = buildActionQueue({ items: [], countsByType: {} }, { count: 3, oldestAt: '2026-10-25T00:00:00Z', totalAmount: 450000 }, now);
    expect(queue.items[0]).toMatchObject({ domain: 'payout', priority: 1, link: null, amount: 450000 });
    expect(queue.items[0].linkNote).toBeTruthy();
  });

  it('says plainly which source does not exist yet instead of showing an empty one', () => {
    const queue = buildActionQueue({ items: [], countsByType: {} }, { count: 0, oldestAt: null, totalAmount: 0 }, now);
    expect(queue.unavailableSources[0].source).toBe('bantuan');
    expect(queue.items).toEqual([]);
  });
});
