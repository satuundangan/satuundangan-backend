import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { PromoService } from '../promo/promo.service';
import { PaymentStatus } from './types/payment.type';

jest.mock('axios');
import axios from 'axios';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo;
  let invitationRepo;

  const mockPaymentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockInvitationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockPromoService = {
    validate: jest.fn(),
    tryReserve: jest.fn(),
    release: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'FLIP_SECRET_KEY') return 'mock-flip-secret';
      if (key === 'FLIP_VALIDATION_TOKEN') return 'mock-validation-token';
      if (key === 'NODE_ENV') return 'test';
      if (key === 'FRONTEND_URL') return 'http://localhost:5173';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Invitation), useValue: mockInvitationRepo },
        { provide: getRepositoryToken(PromoCode), useValue: {} },
        { provide: PromoService, useValue: mockPromoService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    invitationRepo = module.get(getRepositoryToken(Invitation));
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create a paid transaction and return flip redirect_url', async () => {
      const invitationId = 1;
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockInvitation = {
        id: invitationId,
        title: 'Wedding',
        user: mockUser,
        templateDesign: { price: 99000 },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      (axios.post as jest.Mock).mockResolvedValue({
        data: { link_id: 123, link_url: 'https://flip.id/pay/123' },
      });
      mockPaymentRepo.create.mockReturnValue({ id: 1 });
      mockPaymentRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.createTransaction(invitationId, mockUser as any);

      expect(axios.post).toHaveBeenCalled();
      expect(paymentRepo.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        redirect_url: 'https://flip.id/pay/123',
        is_free: false,
        order_id: expect.stringContaining(`INV-${invitationId}-`),
      });
    });

    it('should activate free template without calling Flip', async () => {
      const invitationId = 2;
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockInvitation = {
        id: invitationId,
        title: 'Free Wedding',
        user: mockUser,
        templateDesign: { price: 0 },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockInvitationRepo.save.mockResolvedValue({});
      mockPaymentRepo.create.mockReturnValue({ id: 2 });
      mockPaymentRepo.save.mockResolvedValue({ id: 2 });

      const result = await service.createTransaction(invitationId, mockUser as any);

      expect(axios.post).not.toHaveBeenCalled();
      expect(result).toMatchObject({ is_free: true, amount: 0 });
    });
  });

  describe('handleFlipNotification', () => {
    it('should mark payment as SUCCESS when status is SUCCESSFUL', async () => {
      const mockPayment = {
        orderId: 'INV-1-123',
        status: PaymentStatus.PENDING,
        invitation: { isPublished: false },
        paymentType: null,
        settlementTime: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.save.mockResolvedValue({});

      const payload = {
        id: 1,
        bill_link_id: 123,
        bill_link: 'https://flip.id/pay/123',
        bill_title: 'Test',
        sender_name: 'Test',
        sender_bank: 'bca',
        sender_bank_type: 'virtual_account',
        amount: 99000,
        status: 'SUCCESSFUL',
        settlement_status: 'Done',
        created_at: '2026-01-01 10:00:00',
      };

      const result = await service.handleFlipNotification(payload, 'mock-validation-token');

      expect(mockPayment.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPayment.invitation.isPublished).toBe(true);
      expect(result.updatedStatus).toBe(PaymentStatus.SUCCESS);
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      await expect(
        service.handleFlipNotification({} as any, 'wrong-token'),
      ).rejects.toThrow('Invalid callback token');
    });
  });
});
