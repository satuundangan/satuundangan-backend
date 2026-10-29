import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
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
});
