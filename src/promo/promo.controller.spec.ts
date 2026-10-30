import { Test, TestingModule } from '@nestjs/testing';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';
import { DiscountType } from './promo-code.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

describe('PromoController', () => {
  let controller: PromoController;
  let service: any;

  beforeEach(async () => {
    service = {
      getActiveExitIntent: jest.fn(),
      validate: jest.fn(),
      list: jest.fn(),
      getSummary: jest.fn(),
      getDetail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoController],
      providers: [{ provide: PromoService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PromoController>(PromoController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getActiveIntent', () => {
    it('returns formatted data when active intent promo exists', async () => {
      service.getActiveExitIntent.mockResolvedValue({
        code: 'INTENT10',
        discountType: DiscountType.PERCENTAGE,
        discountValue: '10',
        exitIntentText: 'Jangan pergi dulu!',
      });

      const res = await controller.getActiveIntent();
      expect(res).toEqual({
        success: true,
        data: {
          code: 'INTENT10',
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 10,
          text: 'Jangan pergi dulu!',
        },
      });
    });

    it('returns null data when no active intent promo exists', async () => {
      service.getActiveExitIntent.mockResolvedValue(null);

      const res = await controller.getActiveIntent();
      expect(res).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe('validate', () => {
    it('returns success: false when validation fails', async () => {
      service.validate.mockResolvedValue({
        valid: false,
        message: 'Kode promo expired',
      });

      const res = await controller.validate({
        code: 'EXPIRED',
        invitation_id: 1,
        base_amount: 100000,
      });

      expect(res).toEqual({
        success: false,
        message: 'Kode promo expired',
      });
    });

    it('returns formatted discount breakdown when validation succeeds', async () => {
      service.validate.mockResolvedValue({
        valid: true,
        promoCode: {
          code: 'SAVE20',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
        },
        originalPrice: 100000,
        discountAmount: 20000,
        finalPrice: 80000,
      });

      const res = await controller.validate({
        code: 'SAVE20',
        invitation_id: 1,
        base_amount: 100000,
      });

      expect(res).toEqual({
        success: true,
        data: {
          code: 'SAVE20',
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 20,
          original_price: 100000,
          discount_amount: 20000,
          final_price: 80000,
        },
      });
    });
  });

  describe('getSummary', () => {
    it('returns summary metrics from service', async () => {
      const mockSummary = {
        total_promo_codes: 5,
        total_active_promo: 3,
        total_redemptions: 12,
        total_discount_granted: 150000,
        total_gross_revenue: 1200000,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const res = await controller.getSummary();
      expect(service.getSummary).toHaveBeenCalled();
      expect(res).toBe(mockSummary);
    });
  });

  describe('list', () => {
    it('delegates to service.list with pagination, query, and status params', async () => {
      const mockListResult = {
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      };
      service.list.mockResolvedValue(mockListResult);

      const res = await controller.list(2, 10, 'SAVE', 'active');

      expect(service.list).toHaveBeenCalledWith(2, 10, 'SAVE', 'active');
      expect(res).toBe(mockListResult);
    });
  });

  describe('getDetail', () => {
    it('returns detail for a specific promo code id', async () => {
      const mockDetail = {
        id: 7,
        code: 'VIP50',
        computed_status: 'active',
        metrics: {
          redemptions_count: 10,
        },
        orders: [],
      };
      service.getDetail.mockResolvedValue(mockDetail);

      const res = await controller.getDetail(7);

      expect(service.getDetail).toHaveBeenCalledWith(7);
      expect(res).toBe(mockDetail);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        code: 'NEWCODE',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      } as any;
      const created = { id: 1, ...dto };
      service.create.mockResolvedValue(created);

      const res = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(res).toBe(created);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { discountValue: 15 } as any;
      const updated = { id: 1, code: 'CODE', discountValue: 15 };
      service.update.mockResolvedValue(updated);

      const res = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(res).toBe(updated);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove and returns success message', async () => {
      service.remove.mockResolvedValue(undefined);

      const res = await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(res).toEqual({
        success: true,
        message: 'Promo code deleted successfully',
      });
    });
  });
});
