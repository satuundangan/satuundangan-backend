import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { TemplateDesignRevision } from './entities/template-design-revision.entity';
import { Category } from '../category/category.entity';
import { Payment } from '../payment/payment.entity';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { UploadService } from '../modules/upload/upload.service';

function createChainableQueryBuilder(rawManyResult: any[]) {
  const qb: any = {
    getRawMany: jest.fn().mockResolvedValue(rawManyResult),
  };
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.leftJoin = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  return qb;
}

describe('AdminService - getDashboardStats', () => {
  let service: AdminService;
  let queryBuilders: any[];
  let rawResultsQueue: any[][];

  const mockInvitationRepo = {
    createQueryBuilder: jest.fn(() => {
      const rawManyResult = rawResultsQueue[queryBuilders.length] ?? [];
      const qb = createChainableQueryBuilder(rawManyResult);
      queryBuilders.push(qb);
      return qb;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilders = [];
    rawResultsQueue = [[], []];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepo,
        },
        { provide: getRepositoryToken(Guest), useValue: {} },
        { provide: getRepositoryToken(GuestMessage), useValue: {} },
        { provide: getRepositoryToken(TemplateDesign), useValue: {} },
        { provide: getRepositoryToken(TemplateDesignSection), useValue: {} },
        { provide: getRepositoryToken(TemplateDesignRevision), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: getRepositoryToken(Payment), useValue: {} },
        { provide: getRepositoryToken(Section), useValue: {} },
        { provide: getRepositoryToken(Audio), useValue: {} },
        { provide: getRepositoryToken(Bank), useValue: {} },
        { provide: getRepositoryToken(PaletteColor), useValue: {} },
        { provide: getRepositoryToken(ActivityLog), useValue: {} },
        { provide: UploadService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('builds the category query via templateDesign -> category relation joins (not inv.category)', async () => {
    await service.getDashboardStats();

    const categoryQb = queryBuilders[0];
    expect(categoryQb.leftJoin).toHaveBeenCalledWith(
      'inv.templateDesign',
      'templateDesign',
    );
    expect(categoryQb.leftJoin).toHaveBeenCalledWith(
      'templateDesign.category',
      'category',
    );
    expect(categoryQb.select).toHaveBeenCalledWith('category.name', 'category');
    expect(categoryQb.select).not.toHaveBeenCalledWith(
      'inv.category',
      'category',
    );
    expect(categoryQb.groupBy).toHaveBeenCalledWith('category.name');
  });

  it('coerces raw category rows into { category, count } with null rolled up into Lainnya', async () => {
    rawResultsQueue = [
      [
        { category: 'Romantis', count: '3' },
        { category: null, count: '2' },
      ],
      [],
    ];

    const result = await service.getDashboardStats();

    expect(result.categories).toEqual([
      { category: 'Romantis', count: 3 },
      { category: 'Lainnya', count: 2 },
    ]);
  });

  it('resolves without throwing and returns a 7-entry trend ending in Hari Ini', async () => {
    const result = await service.getDashboardStats();

    expect(result.trend).toHaveLength(7);
    expect(result.trend[6].dayLabel).toBe('Hari Ini');
  });

  it('returns structured kpi, actionRequired, and dateRange metadata', async () => {
    const result = await service.getDashboardStats({ range: '7d' });

    expect(result).toHaveProperty('kpi');
    expect(result.kpi).toHaveProperty('revenue');
    expect(result.kpi).toHaveProperty('paidOrders');
    expect(result.kpi).toHaveProperty('pendingOrders');
    expect(result.kpi).toHaveProperty('uniqueBuyers');
    expect(result.kpi).toHaveProperty('aov');
    expect(result.kpi).toHaveProperty('invitations');

    expect(result).toHaveProperty('actionRequired');
    expect(result.actionRequired).toHaveProperty('count');
    expect(Array.isArray(result.actionRequired.items)).toBe(true);

    expect(result).toHaveProperty('dateRange');
    expect(result.dateRange.key).toBe('7d');
    expect(result.dateRange.label).toBe('7 Hari Terakhir');
    expect(result.dateRange.timezone).toBe('Asia/Jakarta (WIB)');
    expect(result).toHaveProperty('lastUpdated');
  });

  it('handles 30d range and custom date boundaries without throwing', async () => {
    const res30d = await service.getDashboardStats({ range: '30d' });
    expect(res30d.trend).toHaveLength(30);
    expect(res30d.dateRange.key).toBe('30d');
    expect(res30d.dateRange.label).toBe('30 Hari Terakhir');

    const resCustom = await service.getDashboardStats({
      range: 'custom',
      startDate: '2026-10-01',
      endDate: '2026-10-10',
    });
    expect(resCustom.dateRange.key).toBe('custom');
    expect(resCustom.dateRange.label).toBe('2026-10-01 s/d 2026-10-10');
  });

  describe('transformInvitationSummary', () => {
    it('correctly categorizes paid invitation with success payment and amount > 0', () => {
      const inv: any = {
        id: 1,
        title: 'Wedding A',
        slug: 'wedding-a',
        package: 'premium',
        isPublished: true,
        payments: [
          {
            id: 10,
            orderId: 'INV-10',
            amount: 79000,
            status: 'success',
            paymentMethod: 'midtrans',
            paymentType: 'qris',
            settlementTime: new Date(),
          },
        ],
      };
      const res = service.transformInvitationSummary(inv);
      expect(res.paymentStatus.code).toBe('paid');
      expect(res.paymentStatus.label).toBe('Lunas Berbayar');
      expect(res.paymentStatus.variant).toBe('success');
      expect(res.latestTransaction?.orderId).toBe('INV-10');
    });

    it('correctly categorizes free/promo invitation with amount = 0', () => {
      const inv: any = {
        id: 2,
        title: 'Free Wedding',
        slug: 'free-wedding',
        package: 'basic',
        isPublished: true,
        payments: [
          {
            id: 11,
            orderId: 'FREE-11',
            amount: 0,
            status: 'success',
            paymentMethod: 'FREE_ACTIVATION',
          },
        ],
      };
      const res = service.transformInvitationSummary(inv);
      expect(res.paymentStatus.code).toBe('free');
      expect(res.paymentStatus.label).toBe('Gratis / Promo');
      expect(res.paymentStatus.variant).toBe('info');
    });

    it('flags reconcile when published = true but no success payment', () => {
      const inv: any = {
        id: 3,
        title: 'Suspicious Wedding',
        slug: 'suspicious-wedding',
        isPublished: true,
        payments: [],
      };
      const res = service.transformInvitationSummary(inv);
      expect(res.paymentStatus.code).toBe('reconcile');
      expect(res.paymentStatus.label).toBe('Perlu Rekonsiliasi');
      expect(res.paymentStatus.variant).toBe('danger');
    });

    it('calculates daysRemaining accurately when expiredAt is in the future', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const inv: any = {
        id: 4,
        title: 'Expiring Soon',
        slug: 'expiring-soon',
        expiredAt: future,
        payments: [],
      };
      const res = service.transformInvitationSummary(inv);
      expect(res.expiry.isExpired).toBe(false);
      expect(res.expiry.daysRemaining).toBe(5);
      expect(res.expiry.label).toBe('5 hari lagi');
    });

    it('marks Kadaluarsa when expiredAt is in the past', () => {
      const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const inv: any = {
        id: 5,
        title: 'Already Expired',
        slug: 'already-expired',
        expiredAt: past,
        payments: [],
      };
      const res = service.transformInvitationSummary(inv);
      expect(res.expiry.isExpired).toBe(true);
      expect(res.expiry.daysRemaining).toBe(0);
      expect(res.expiry.label).toBe('Kadaluarsa');
    });
  });

  describe('Payments & Reconciliation', () => {
    let mockPaymentRepo: any;
    let mockInvRepo: any;
    let mockActivityRepo: any;
    let paymentAdminService: AdminService;

    beforeEach(async () => {
      mockPaymentRepo = {
        findOne: jest.fn(),
        save: jest.fn((p) => Promise.resolve(p)),
        createQueryBuilder: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      };

      mockInvRepo = {
        save: jest.fn((i) => Promise.resolve(i)),
        createQueryBuilder: jest.fn(),
      };

      mockActivityRepo = {
        create: jest.fn((a) => a),
        save: jest.fn().mockResolvedValue(true),
        find: jest.fn().mockResolvedValue([]),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AdminService,
          { provide: getRepositoryToken(User), useValue: {} },
          { provide: getRepositoryToken(Invitation), useValue: mockInvRepo },
          { provide: getRepositoryToken(Guest), useValue: {} },
          { provide: getRepositoryToken(GuestMessage), useValue: {} },
          { provide: getRepositoryToken(TemplateDesign), useValue: {} },
          { provide: getRepositoryToken(TemplateDesignSection), useValue: {} },
          { provide: getRepositoryToken(TemplateDesignRevision), useValue: {} },
          { provide: getRepositoryToken(Category), useValue: {} },
          { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
          { provide: getRepositoryToken(Section), useValue: {} },
          { provide: getRepositoryToken(Audio), useValue: {} },
          { provide: getRepositoryToken(Bank), useValue: {} },
          { provide: getRepositoryToken(PaletteColor), useValue: {} },
          { provide: getRepositoryToken(ActivityLog), useValue: mockActivityRepo },
          { provide: UploadService, useValue: {} },
        ],
      }).compile();

      paymentAdminService = module.get<AdminService>(AdminService);
    });

    it('reconcilePaymentPublish successfully sets isPublished to true and saves invitation', async () => {
      const mockPayment = {
        id: 101,
        orderId: 'INV-101',
        status: 'success',
        package: 'premium',
        invitation: {
          id: 55,
          title: 'Wedding Test',
          slug: 'wedding-test',
          isPublished: false,
          package: 'basic',
        },
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

      const res = await paymentAdminService.reconcilePaymentPublish(101, 'Testing reason', { id: 1, email: 'admin@test.com' });

      expect(res.success).toBe(true);
      expect(mockPayment.invitation.isPublished).toBe(true);
      expect(mockPayment.invitation.package).toBe('premium');
      expect(mockInvRepo.save).toHaveBeenCalledWith(mockPayment.invitation);
      expect(mockActivityRepo.save).toHaveBeenCalled();
    });

    it('reconcilePaymentPublish throws BadRequestException if payment status is not success', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 102,
        orderId: 'INV-102',
        status: 'pending',
        invitation: { id: 56, isPublished: false },
      });

      await expect(
        paymentAdminService.reconcilePaymentPublish(102, 'test'),
      ).rejects.toThrow();
    });

    it('reconcilePaymentPublish throws BadRequestException if payment has no linked invitation', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 103,
        orderId: 'AI-CREDIT-1',
        status: 'success',
        invitation: null,
      });

      await expect(
        paymentAdminService.reconcilePaymentPublish(103, 'test'),
      ).rejects.toThrow();
    });
  });
});
