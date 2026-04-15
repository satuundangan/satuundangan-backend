import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { PromoService } from '../promo/promo.service';
import { PaymentStatus } from './types/payment.type';

const mockCreateTransaction = jest.fn();

jest.mock('midtrans-client', () => ({
  Snap: jest.fn().mockImplementation(() => ({
    createTransaction: mockCreateTransaction,
  })),
}), { virtual: true });

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
      if (key === 'MIDTRANS_SERVER_KEY') return 'mock-midtrans-server-key';
      if (key === 'MIDTRANS_IS_PRODUCTION') return 'false';
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
    it('should create a paid transaction and return Midtrans redirect_url', async () => {
      const invitationId = 1;
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockInvitation = {
        id: invitationId,
        title: 'Wedding',
        user: mockUser,
        templateDesign: { price: 99000 },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockCreateTransaction.mockResolvedValue({
        token: 'snap-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
      });
      mockPaymentRepo.create.mockReturnValue({ id: 1 });
      mockPaymentRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.createTransaction(invitationId, mockUser as any);

      expect(mockCreateTransaction).toHaveBeenCalled();
      expect(paymentRepo.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        token: 'snap-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
        is_free: false,
        order_id: expect.stringContaining(`INV-${invitationId}-`),
      });
    });

    it('should activate free template without calling payment gateway', async () => {
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

      expect(mockCreateTransaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({ is_free: true, amount: 0 });
    });
  });

  describe('handleMidtransNotification', () => {
    it('should mark payment as SUCCESS on settlement', async () => {
      const mockPayment = {
        orderId: 'INV-1-123',
        status: PaymentStatus.PENDING,
        invitation: { isPublished: false },
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.save.mockResolvedValue({});

      const grossAmount = '99000.00';
      const signature = createHash('sha512')
        .update(`INV-1-123200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      const result = await service.handleMidtransNotification({
        order_id: 'INV-1-123',
        status_code: '200',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: 'midtrans-tx-1',
        payment_type: 'bank_transfer',
        settlement_time: '2026-01-01 10:00:00',
      });

      expect(mockPayment.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPayment.paymentMethod).toBe('midtrans');
      expect(mockPayment.paymentType).toBe('bank_transfer');
      expect(mockPayment.transactionId).toBe('midtrans-tx-1');
      expect(mockPayment.invitation.isPublished).toBe(true);
      expect(result.updatedStatus).toBe(PaymentStatus.SUCCESS);
    });

    it('should keep payment pending on challenged credit card capture', async () => {
      const mockPayment = {
        orderId: 'INV-2-123',
        status: PaymentStatus.PENDING,
        invitation: { isPublished: false },
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);

      const grossAmount = '99000.00';
      const signature = createHash('sha512')
        .update(`INV-2-123201${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      const result = await service.handleMidtransNotification({
        order_id: 'INV-2-123',
        status_code: '201',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'capture',
        payment_type: 'credit_card',
        fraud_status: 'challenge',
      });

      expect(mockPayment.status).toBe(PaymentStatus.PENDING);
      expect(mockInvitationRepo.save).not.toHaveBeenCalled();
      expect(result.updatedStatus).toBe(PaymentStatus.PENDING);
    });

    it('should throw UnauthorizedException on invalid Midtrans signature', async () => {
      await expect(
        service.handleMidtransNotification({
          order_id: 'INV-3-123',
          status_code: '200',
          gross_amount: '99000.00',
          signature_key: 'invalid',
          transaction_status: 'settlement',
        }),
      ).rejects.toThrow('Invalid Midtrans signature');
    });
  });
});
