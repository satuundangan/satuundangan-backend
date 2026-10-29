import { AdminService } from './admin.service';

describe('Admin payment dashboard drilldowns', () => {
  let service: AdminService;
  let qb: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T01:00:00Z'));
    qb = { getManyAndCount: jest.fn().mockResolvedValue([[], 0]) };
    for (const method of [
      'leftJoinAndSelect',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ])
      qb[method] = jest.fn().mockReturnValue(qb);
    service = Object.create(AdminService.prototype);
    (service as any).paymentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
  });
  afterEach(() => jest.useRealTimers());

  it('matches paid dashboard records using settlement time and WIB half-open bounds', async () => {
    await (service.listPayments as any)(
      1,
      20,
      undefined,
      'success',
      'invitation',
      undefined,
      '2026-10-20',
      '2026-10-20',
      'createdAt',
      'DESC',
      'paid',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('p.amount > 0');
    expect(qb.andWhere).toHaveBeenCalledWith("p.paymentMethod = 'midtrans'");
    expect(qb.andWhere).toHaveBeenCalledWith(
      "(p.paymentType IS NULL OR p.paymentType <> 'simulation')",
    );
    expect(qb.andWhere).toHaveBeenCalledWith('p.settlementTime IS NOT NULL');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'p.settlementTime >= :rangeStart AND p.settlementTime < :rangeEnd',
      {
        rangeStart: new Date('2026-10-19T17:00:00Z'),
        rangeEnd: new Date('2026-10-20T17:00:00Z'),
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('p.purpose = :purpose', {
      purpose: 'invitation',
    });
  });

  it('keeps free activations separate from paid orders and AI purpose explicit', async () => {
    await (service.listPayments as any)(
      1,
      20,
      undefined,
      'success',
      'invitation',
      undefined,
      '2026-10-20',
      '2026-10-20',
      'createdAt',
      'DESC',
      'free',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('p.amount = 0');
    expect(qb.andWhere).toHaveBeenCalledWith(
      "(p.paymentMethod = 'FREE_ACTIVATION' OR p.paymentType = 'free')",
    );
    qb.andWhere.mockClear();
    await (service.listPayments as any)(
      1,
      20,
      undefined,
      'success',
      'ai_credits',
      undefined,
      undefined,
      undefined,
      'createdAt',
      'DESC',
      'paid',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('p.purpose = :purpose', {
      purpose: 'ai_credits',
    });
  });

  it('uses creation time for pending records and rejects invalid kinds/dates', async () => {
    await (service.listPayments as any)(
      1,
      20,
      undefined,
      'pending',
      'invitation',
      undefined,
      '2026-10-20',
      '2026-10-20',
      'createdAt',
      'DESC',
      'pending',
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'p.createdAt >= :rangeStart AND p.createdAt < :rangeEnd',
      expect.any(Object),
    );
    await expect(
      (service.listPayments as any)(
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'createdAt',
        'DESC',
        'anything',
      ),
    ).rejects.toThrow();
    await expect(
      (service.listPayments as any)(
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        '2026-02-30',
        '2026-03-01',
        'createdAt',
        'DESC',
        'paid',
      ),
    ).rejects.toThrow();
    await expect(
      (service.listPayments as any)(
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        '2026-10-20',
        undefined,
        'createdAt',
        'DESC',
        'paid',
      ),
    ).rejects.toThrow();
  });

  it('preserves the existing no-kind list contract without introducing financial filters', async () => {
    await service.listPayments();
    expect(qb.andWhere).not.toHaveBeenCalledWith('p.amount > 0');
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('exports every matching page with the same filters instead of silently truncating', async () => {
    const first = Array.from({ length: 1000 }, (_, id) => ({
      id,
      orderId: 'ORDER-' + id,
      amount: 1,
    }));
    const list = jest
      .spyOn(service, 'listPayments')
      .mockResolvedValueOnce({
        data: first,
        total: 1001,
        page: 1,
        limit: 1000,
      } as any)
      .mockResolvedValueOnce({
        data: [{ id: 1000, orderId: 'ORDER-1000', amount: 1 }],
        total: 1001,
        page: 2,
        limit: 1000,
      } as any);
    const result = await (service.exportPayments as any)(
      'wedding',
      'success',
      'invitation',
      'premium',
      '2026-10-20',
      '2026-10-20',
      'paid',
    );
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(
      2,
      2,
      1000,
      'wedding',
      'success',
      'invitation',
      'premium',
      '2026-10-20',
      '2026-10-20',
      'createdAt',
      'DESC',
      'paid',
    );
    expect(result.total).toBe(1001);
    expect(result.csv.split('\n')).toHaveLength(1002);
    expect(result.csv).toContain('ORDER-1000');
  });
});
