import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { PromoService } from '../promo/promo.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { PaymentStatus } from './types/payment.type';
import { BadGatewayException } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

  const mockAffiliateService = {
    validateAffiliateCode: jest.fn(),
    creditCommission: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(),
    }),
    transaction: jest.fn().mockImplementation(async (cb) => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue({}),
          findOne: jest.fn(),
          update: jest.fn(),
        }),
      };
      return cb(manager);
    }),
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
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(PromoCode), useValue: {} },
        { provide: PromoService, useValue: mockPromoService },
        { provide: AffiliateService, useValue: mockAffiliateService },
        { provide: DataSource, useValue: mockDataSource },
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

    it('should sanitize Midtrans customer and item fields', async () => {
      const invitationId = 9;
      const mockUser = {
        id: 9,
        name: 'Nainggolan 🚀 Utami',
        email: 'naingggolanutami@gmail.com',
      };
      const mockInvitation = {
        id: invitationId,
        title: 'putra & putri dengan judul undangan yang sangat panjang sekali',
        slug: 'putra-putri',
        user: mockUser,
        templateDesign: { price: 10000 },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockCreateTransaction.mockResolvedValue({
        token: 'snap-token-456',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-456',
      });
      mockPaymentRepo.create.mockReturnValue({ id: 9 });
      mockPaymentRepo.save.mockResolvedValue({ id: 9 });

      await service.createTransaction(invitationId, mockUser as any);

      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_details: {
            first_name: 'Nainggolan Utami',
            email: 'naingggolanutami@gmail.com',
          },
          item_details: [
            expect.objectContaining({
              name: expect.stringMatching(/^Undangan Digital putra & putri/),
            }),
          ],
        }),
      );
      const parameter = mockCreateTransaction.mock.calls[0][0];
      expect(parameter.item_details[0].name.length).toBeLessThanOrEqual(50);
    });

    it('should expose Midtrans create transaction errors as BadGatewayException', async () => {
      const invitationId = 3;
      const mockUser = { id: 3, name: 'Test User', email: 'test@example.com' };
      const mockInvitation = {
        id: invitationId,
        title: 'Wedding',
        user: mockUser,
        templateDesign: { price: 10000 },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockCreateTransaction.mockRejectedValue({
        ApiResponse: { error_messages: ['Validation failed'] },
      });
      mockPromoService.release.mockResolvedValue(undefined);

      await expect(
        service.createTransaction(invitationId, mockUser as any),
      ).rejects.toThrow(BadGatewayException);
      await expect(
        service.createTransaction(invitationId, mockUser as any),
      ).rejects.toThrow('Gagal membuat transaksi Midtrans: Validation failed');
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
        id: 1,
        orderId: 'INV-1-123',
        status: PaymentStatus.PENDING,
        invitation: { isPublished: false },
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: null,
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

    it.each([
      ['virtual account', 'bank_transfer'],
      ['GoPay', 'gopay'],
      ['QRIS', 'qris'],
    ])('should mark %s settlement as SUCCESS', async (_label, paymentType) => {
      const mockPayment = {
        id: 10,
        orderId: `INV-${paymentType}-123`,
        status: PaymentStatus.PENDING,
        invitation: { isPublished: false },
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.save.mockResolvedValue({});

      const grossAmount = '79000.00';
      const signature = createHash('sha512')
        .update(`${mockPayment.orderId}200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      const result = await service.handleMidtransNotification({
        order_id: mockPayment.orderId,
        status_code: '200',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: `midtrans-${paymentType}-tx`,
        payment_type: paymentType,
        fraud_status: 'accept',
      });

      expect(mockPayment.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPayment.paymentMethod).toBe('midtrans');
      expect(mockPayment.paymentType).toBe(paymentType);
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
