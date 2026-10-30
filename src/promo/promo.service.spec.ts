import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PromoService } from './promo.service';
import { PromoCode, DiscountType } from './promo-code.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Payment } from '../payment/payment.entity';

describe('PromoService', () => {
  let service: PromoService;
  let promoRepo: any;
  let invitationRepo: any;
  let paymentRepo: any;

  function createMockPaymentQb(rawMany: any[] = [], rawOne: any = null) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawMany),
      getRawOne: jest.fn().mockResolvedValue(rawOne),
    };
  }

  function createMockPromoQb(affected = 1) {
    return {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected }),
    };
  }

  beforeEach(async () => {
    promoRepo = {
      metadata: {
        findColumnWithPropertyName: jest.fn((prop: string) => ({
          databaseName:
            prop === 'usedCount'
              ? 'used_count'
              : prop === 'maxUses'
                ? 'max_uses'
                : 'is_active',
        })),
      },
      manager: {
        connection: {
          driver: {
            escape: jest.fn((name: string) => `\`${name}\``),
          },
        },
      },
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => createMockPromoQb(1)),
    };

    invitationRepo = {
      findOne: jest.fn(),
    };

    paymentRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => createMockPaymentQb([], null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoService,
        { provide: getRepositoryToken(PromoCode), useValue: promoRepo },
        { provide: getRepositoryToken(Invitation), useValue: invitationRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
      ],
    }).compile();

    service = module.get<PromoService>(PromoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computePromoStatus', () => {
    const basePromo = {
      isActive: true,
      validFrom: null,
      validUntil: null,
      maxUses: 10,
    };

    it('returns inactive if isActive is false', () => {
      const status = service.computePromoStatus(
        { ...basePromo, isActive: false },
        0,
      );
      expect(status).toBe('inactive');
    });

    it('returns scheduled if validFrom is in the future', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const status = service.computePromoStatus(
        { ...basePromo, validFrom: future },
        0,
      );
      expect(status).toBe('scheduled');
    });

    it('returns expired if validUntil is in the past', () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const status = service.computePromoStatus(
        { ...basePromo, validUntil: past },
        0,
      );
      expect(status).toBe('expired');
    });

    it('returns exhausted if maxUses is reached by redemptionsCount', () => {
      const status = service.computePromoStatus(
        { ...basePromo, maxUses: 5 },
        5,
      );
      expect(status).toBe('exhausted');
    });

    it('returns active if valid, within dates and maxUses is null', () => {
      const status = service.computePromoStatus(
        { ...basePromo, maxUses: null },
        100,
      );
      expect(status).toBe('active');
    });

    it('returns active if valid and redemptionsCount < maxUses', () => {
      const past = new Date(Date.now() - 1000 * 60);
      const future = new Date(Date.now() + 1000 * 60 * 60);
      const status = service.computePromoStatus(
        { ...basePromo, validFrom: past, validUntil: future, maxUses: 10 },
        4,
      );
      expect(status).toBe('active');
    });
  });

  describe('calculateDiscount', () => {
    it('calculates percentage discount accurately and rounds to integer', () => {
      const promo = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15,
      } as PromoCode;

      const result = service.calculateDiscount(150000, promo);
      expect(result.discountAmount).toBe(22500);
      expect(result.finalPrice).toBe(127500);
    });

    it('calculates fixed discount accurately', () => {
      const promo = {
        discountType: DiscountType.FIXED,
        discountValue: 50000,
      } as PromoCode;

      const result = service.calculateDiscount(150000, promo);
      expect(result.discountAmount).toBe(50000);
      expect(result.finalPrice).toBe(100000);
    });

    it('caps finalPrice at 0 when fixed discount exceeds original price', () => {
      const promo = {
        discountType: DiscountType.FIXED,
        discountValue: 200000,
      } as PromoCode;

      const result = service.calculateDiscount(150000, promo);
      expect(result.discountAmount).toBe(200000);
      expect(result.finalPrice).toBe(0);
    });
  });

  describe('validate', () => {
    it('returns invalid if promo code does not exist', async () => {
      promoRepo.findOne.mockResolvedValue(null);

      const res = await service.validate('UNKNOWN', 1);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('tidak valid');
    });

    it('returns invalid if promo code is inactive', async () => {
      promoRepo.findOne.mockResolvedValue({
        id: 1,
        code: 'PROMO10',
        isActive: false,
      });

      const res = await service.validate('PROMO10', 1);
      expect(res.valid).toBe(false);
    });

    it('returns invalid if promo has not started yet', async () => {
      const future = new Date(Date.now() + 86400000);
      promoRepo.findOne.mockResolvedValue({
        id: 1,
        code: 'FUTURE',
        isActive: true,
        validFrom: future,
        validUntil: null,
        maxUses: null,
      });

      const res = await service.validate('FUTURE', 1);
      expect(res.valid).toBe(false);
    });

    it('returns invalid if promo has expired', async () => {
      const past = new Date(Date.now() - 86400000);
      promoRepo.findOne.mockResolvedValue({
        id: 1,
        code: 'OLD',
        isActive: true,
        validFrom: null,
        validUntil: past,
        maxUses: null,
      });

      const res = await service.validate('OLD', 1);
      expect(res.valid).toBe(false);
    });

    it('returns invalid if usedCount reached maxUses', async () => {
      promoRepo.findOne.mockResolvedValue({
        id: 1,
        code: 'MAXED',
        isActive: true,
        validFrom: null,
        validUntil: null,
        maxUses: 5,
        usedCount: 5,
      });

      const res = await service.validate('MAXED', 1);
      expect(res.valid).toBe(false);
    });

    it('returns invalid if invitation is not found', async () => {
      promoRepo.findOne.mockResolvedValue({
        id: 1,
        code: 'VALID',
        isActive: true,
        validFrom: null,
        validUntil: null,
        maxUses: null,
        usedCount: 0,
      });
      invitationRepo.findOne.mockResolvedValue(null);

      const res = await service.validate('VALID', 999);
      expect(res.valid).toBe(false);
      expect(res.message).toBe('Undangan tidak ditemukan');
    });

    it('returns valid with baseAmount when provided', async () => {
      const promo = {
        id: 1,
        code: 'SAVE10',
        isActive: true,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        validFrom: null,
        validUntil: null,
        maxUses: null,
        usedCount: 0,
      };
      promoRepo.findOne.mockResolvedValue(promo);
      invitationRepo.findOne.mockResolvedValue({ id: 1, templateDesign: { price: 100000 } });

      const res = await service.validate('SAVE10', 1, 200000);
      expect(res.valid).toBe(true);
      expect(res.originalPrice).toBe(200000);
      expect(res.discountAmount).toBe(20000);
      expect(res.finalPrice).toBe(180000);
      expect(res.promoCode).toBe(promo);
    });

    it('falls back to templateDesign.price when baseAmount is undefined', async () => {
      const promo = {
        id: 1,
        code: 'SAVE10',
        isActive: true,
        discountType: DiscountType.FIXED,
        discountValue: 15000,
        validFrom: null,
        validUntil: null,
        maxUses: null,
        usedCount: 0,
      };
      promoRepo.findOne.mockResolvedValue(promo);
      invitationRepo.findOne.mockResolvedValue({ id: 1, templateDesign: { price: 75000 } });

      const res = await service.validate('SAVE10', 1);
      expect(res.valid).toBe(true);
      expect(res.originalPrice).toBe(75000);
      expect(res.discountAmount).toBe(15000);
      expect(res.finalPrice).toBe(60000);
    });
  });

  describe('tryReserve and release', () => {
    it('tryReserve returns true if affected rows > 0', async () => {
      promoRepo.createQueryBuilder = jest.fn(() => createMockPromoQb(1));
      const reserved = await service.tryReserve(1);
      expect(reserved).toBe(true);
    });

    it('tryReserve returns false if slot cannot be reserved', async () => {
      promoRepo.createQueryBuilder = jest.fn(() => createMockPromoQb(0));
      const reserved = await service.tryReserve(1);
      expect(reserved).toBe(false);
    });

    it('release executes compensating decrement query', async () => {
      const qb = createMockPromoQb(1);
      promoRepo.createQueryBuilder = jest.fn(() => qb);

      await service.release(1);
      expect(qb.update).toHaveBeenCalledWith(PromoCode);
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 1 });
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    const mockPromos: PromoCode[] = [
      {
        id: 1,
        code: 'PROMO_ACTIVE',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        maxUses: 100,
        usedCount: 2,
        validFrom: null,
        validUntil: null,
        isActive: true,
        isExitIntentActive: true,
        exitIntentText: 'Dapatkan diskon 10%!',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as PromoCode,
      {
        id: 2,
        code: 'PROMO_EXHAUSTED',
        discountType: DiscountType.FIXED,
        discountValue: 20000,
        maxUses: 2,
        usedCount: 2,
        validFrom: null,
        validUntil: null,
        isActive: true,
        isExitIntentActive: false,
        exitIntentText: null,
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-02'),
      } as PromoCode,
      {
        id: 3,
        code: 'PROMO_INACTIVE',
        discountType: DiscountType.FIXED,
        discountValue: 10000,
        maxUses: 50,
        usedCount: 0,
        validFrom: null,
        validUntil: null,
        isActive: false,
        isExitIntentActive: false,
        exitIntentText: null,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-03'),
      } as PromoCode,
    ];

    it('returns aggregated metrics and computed status for all promos', async () => {
      promoRepo.find.mockResolvedValue(mockPromos);

      const mockAgg = [
        {
          promoCodeId: '1',
          redemptions_count: '5',
          pending_reservations_count: '2',
          total_discount_amount: '50000',
          total_gross_revenue: '450000',
        },
        {
          promoCodeId: '2',
          redemptions_count: '2',
          pending_reservations_count: '0',
          total_discount_amount: '40000',
          total_gross_revenue: '200000',
        },
      ];

      paymentRepo.createQueryBuilder = jest.fn(() =>
        createMockPaymentQb(mockAgg, null),
      );

      const result = await service.list(1, 20);

      expect(result.total).toBe(3);
      expect(result.data.length).toBe(3);

      const item1 = result.data.find((p) => p.id === 1);
      expect(item1).toBeDefined();
      expect(item1?.redemptions_count).toBe(5);
      expect(item1?.pending_reservations_count).toBe(2);
      expect(item1?.total_discount_amount).toBe(50000);
      expect(item1?.total_gross_revenue).toBe(450000);
      expect(item1?.remaining_slots).toBe(95);
      expect(item1?.computed_status).toBe('active');
      expect(item1?.is_exit_intent_active).toBe(true);
      expect(item1?.exit_intent_text).toBe('Dapatkan diskon 10%!');

      const item2 = result.data.find((p) => p.id === 2);
      expect(item2?.computed_status).toBe('exhausted');
      expect(item2?.remaining_slots).toBe(0);

      const item3 = result.data.find((p) => p.id === 3);
      expect(item3?.computed_status).toBe('inactive');
      expect(item3?.redemptions_count).toBe(0);
    });

    it('filters results by computed status', async () => {
      promoRepo.find.mockResolvedValue(mockPromos);

      const mockAgg = [
        {
          promoCodeId: '1',
          redemptions_count: '5',
          pending_reservations_count: '2',
          total_discount_amount: '50000',
          total_gross_revenue: '450000',
        },
        {
          promoCodeId: '2',
          redemptions_count: '2',
          pending_reservations_count: '0',
          total_discount_amount: '40000',
          total_gross_revenue: '200000',
        },
      ];

      paymentRepo.createQueryBuilder = jest.fn(() =>
        createMockPaymentQb(mockAgg, null),
      );

      const activeList = await service.list(1, 20, undefined, 'active');
      expect(activeList.total).toBe(1);
      expect(activeList.data[0].id).toBe(1);

      const exhaustedList = await service.list(1, 20, undefined, 'exhausted');
      expect(exhaustedList.total).toBe(1);
      expect(exhaustedList.data[0].id).toBe(2);

      const inactiveList = await service.list(1, 20, undefined, 'inactive');
      expect(inactiveList.total).toBe(1);
      expect(inactiveList.data[0].id).toBe(3);
    });

    it('paginates results correctly', async () => {
      promoRepo.find.mockResolvedValue(mockPromos);
      paymentRepo.createQueryBuilder = jest.fn(() =>
        createMockPaymentQb([], null),
      );

      const paged = await service.list(2, 2);
      expect(paged.page).toBe(2);
      expect(paged.limit).toBe(2);
      expect(paged.total).toBe(3);
      expect(paged.data.length).toBe(1);
      expect(paged.data[0].id).toBe(3);
    });
  });

  describe('getSummary', () => {
    it('returns zeroes when no promos exist', async () => {
      promoRepo.find.mockResolvedValue([]);

      const summary = await service.getSummary();
      expect(summary).toEqual({
        total_promo_codes: 0,
        total_active_promo: 0,
        total_redemptions: 0,
        total_discount_granted: 0,
        total_gross_revenue: 0,
      });
    });

    it('calculates metrics and active promo count across all promo codes', async () => {
      const mockPromos: PromoCode[] = [
        {
          id: 1,
          code: 'ACTIVE1',
          isActive: true,
          maxUses: 10,
          validFrom: null,
          validUntil: null,
        } as PromoCode,
        {
          id: 2,
          code: 'EXHAUSTED',
          isActive: true,
          maxUses: 2,
          validFrom: null,
          validUntil: null,
        } as PromoCode,
        {
          id: 3,
          code: 'OFF',
          isActive: false,
          maxUses: 10,
          validFrom: null,
          validUntil: null,
        } as PromoCode,
      ];

      promoRepo.find.mockResolvedValue(mockPromos);

      let callCount = 0;
      paymentRepo.createQueryBuilder = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Total overall metrics
          return createMockPaymentQb([], {
            total_redemptions: '7',
            total_discount_granted: '85000',
            total_gross_revenue: '950000',
          });
        }
        // Per-promo redemptions
        return createMockPaymentQb(
          [
            { promoCodeId: '1', redemptions_count: '5' },
            { promoCodeId: '2', redemptions_count: '2' },
          ],
          null,
        );
      });

      const summary = await service.getSummary();

      expect(summary.total_promo_codes).toBe(3);
      expect(summary.total_active_promo).toBe(1); // Only ACTIVE1 is active (5 < 10)
      expect(summary.total_redemptions).toBe(7);
      expect(summary.total_discount_granted).toBe(85000);
      expect(summary.total_gross_revenue).toBe(950000);
    });
  });

  describe('getDetail', () => {
    it('throws NotFoundException if promo not found', async () => {
      promoRepo.findOne.mockResolvedValue(null);

      await expect(service.getDetail(99)).rejects.toThrow(NotFoundException);
    });

    it('returns detail with metrics, status, and latest 50 orders', async () => {
      const promo: PromoCode = {
        id: 1,
        code: 'PROMO1',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        maxUses: 100,
        usedCount: 15,
        validFrom: null,
        validUntil: null,
        isActive: true,
        isExitIntentActive: true,
        exitIntentText: 'Hemat 20%!',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      } as PromoCode;

      promoRepo.findOne.mockResolvedValue(promo);

      paymentRepo.createQueryBuilder = jest.fn(() =>
        createMockPaymentQb([], {
          redemptions_count: '12',
          pending_reservations_count: '3',
          total_discount_amount: '120000',
          total_gross_revenue: '1080000',
        }),
      );

      const mockOrders = [
        {
          id: 101,
          orderId: 'INV-101',
          name: 'Budi',
          email: 'budi@test.com',
          amount: 90000,
          discountAmount: 10000,
          package: 'premium',
          paymentMethod: 'midtrans',
          status: 'success',
          createdAt: new Date('2026-02-01'),
          settlementTime: new Date('2026-02-01'),
        },
      ];

      paymentRepo.find.mockResolvedValue(mockOrders);

      const detail = await service.getDetail(1);

      expect(detail.id).toBe(1);
      expect(detail.code).toBe('PROMO1');
      expect(detail.computed_status).toBe('active');
      expect(detail.remaining_slots).toBe(88);
      expect(detail.redemptions_count).toBe(12);
      expect(detail.pending_reservations_count).toBe(3);
      expect(detail.total_discount_amount).toBe(120000);
      expect(detail.total_gross_revenue).toBe(1080000);
      expect(detail.metrics).toEqual({
        redemptions_count: 12,
        pending_reservations_count: 3,
        total_discount_amount: 120000,
        total_gross_revenue: 1080000,
      });
      expect(detail.orders.length).toBe(1);
      expect(detail.orders[0].orderId).toBe('INV-101');
    });
  });

  describe('getActiveExitIntent', () => {
    it('returns active exit intent promo when found', async () => {
      const promo = { id: 1, isExitIntentActive: true, isActive: true };
      promoRepo.findOne.mockResolvedValue(promo);

      const res = await service.getActiveExitIntent();
      expect(res).toBe(promo);
      expect(promoRepo.findOne).toHaveBeenCalledWith({
        where: { isActive: true, isExitIntentActive: true },
      });
    });
  });

  describe('create, update, remove', () => {
    it('create uppercases promo code and parses dates', async () => {
      const dto = {
        code: 'disc10',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T23:59:59Z',
      };

      const created = await service.create(dto as any);
      expect(promoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DISC10',
          validFrom: new Date(dto.validFrom),
          validUntil: new Date(dto.validUntil),
        }),
      );
      expect(created).toBeDefined();
    });

    it('update throws NotFoundException if promo not found', async () => {
      promoRepo.findOne.mockResolvedValue(null);

      await expect(service.update(99, { code: 'NEW' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('update resets other exit intent promos if current is set active', async () => {
      const existing = {
        id: 1,
        code: 'OLD',
        isExitIntentActive: false,
      };
      promoRepo.findOne.mockResolvedValue(existing);

      await service.update(1, { isExitIntentActive: true });

      expect(promoRepo.update).toHaveBeenCalled();
      expect(promoRepo.save).toHaveBeenCalled();
    });

    it('remove throws NotFoundException if promo not found', async () => {
      promoRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });

    it('remove deletes existing promo', async () => {
      const existing = { id: 1, code: 'OLD' };
      promoRepo.findOne.mockResolvedValue(existing);

      await service.remove(1);
      expect(promoRepo.remove).toHaveBeenCalledWith(existing);
    });
  });
});
