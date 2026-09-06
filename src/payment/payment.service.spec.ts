import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Payment } from './payment.entity';
import { Invitation, InvitationPackage } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { PromoService } from '../promo/promo.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { PaymentStatus } from './types/payment.type';
import { BadGatewayException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const mockCreateTransaction = jest.fn();

jest.mock(
  'midtrans-client',
  () => ({
    Snap: jest.fn().mockImplementation(() => ({
      createTransaction: mockCreateTransaction,
    })),
  }),
  { virtual: true },
);

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo;
  let invitationRepo;

  const mockPaymentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
  };

  const mockInvitationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = { increment: jest.fn(), findOne: jest.fn(), save: jest.fn() };

  const mockPromoService = {
    validate: jest.fn(),
    tryReserve: jest.fn(),
    release: jest.fn(),
  };

  const mockAffiliateService = {
    validateAffiliateCode: jest.fn(),
    creditCommission: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn((entity) => {
      if (entity === Payment) return mockPaymentRepo;
      if (entity === Invitation) return mockInvitationRepo;
      if (entity === User) return mockUserRepo;
      throw new Error(`Unexpected entity in test manager: ${String(entity)}`);
    }),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn() }),
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
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
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
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
        redirect_url:
          'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
      });
      mockPaymentRepo.create.mockReturnValue({ id: 1 });
      mockPaymentRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.createTransaction(
        invitationId,
        mockUser as any,
        InvitationPackage.BASIC,
      );

      expect(mockCreateTransaction).toHaveBeenCalled();
      expect(paymentRepo.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        token: 'snap-token-123',
        redirect_url:
          'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
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
        redirect_url:
          'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-456',
      });
      mockPaymentRepo.create.mockReturnValue({ id: 9 });
      mockPaymentRepo.save.mockResolvedValue({ id: 9 });

      await service.createTransaction(
        invitationId,
        mockUser as any,
        InvitationPackage.BASIC,
      );

      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_details: {
            first_name: 'Nainggolan Utami',
            email: 'naingggolanutami@gmail.com',
          },
          item_details: [
            expect.objectContaining({
              name: expect.stringMatching(/^Undangan Basic putra & putri/),
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
        service.createTransaction(
          invitationId,
          mockUser as any,
          InvitationPackage.BASIC,
        ),
      ).rejects.toThrow(BadGatewayException);
      await expect(
        service.createTransaction(
          invitationId,
          mockUser as any,
          InvitationPackage.BASIC,
        ),
      ).rejects.toThrow('Gagal membuat transaksi Midtrans: Validation failed');
    });

    it('should activate invitation without calling payment gateway when a promo brings the price to zero', async () => {
      const invitationId = 2;
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      const mockInvitation = {
        id: invitationId,
        title: 'Free Wedding',
        user: mockUser,
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockInvitationRepo.save.mockResolvedValue({});
      mockPaymentRepo.create.mockReturnValue({ id: 2 });
      mockPaymentRepo.save.mockResolvedValue({ id: 2 });
      mockPromoService.validate.mockResolvedValue({
        valid: true,
        promoCode: { id: 1 },
        discountAmount: 89000,
        finalPrice: 0,
      });
      mockPromoService.tryReserve.mockResolvedValue(true);

      const result = await service.createTransaction(
        invitationId,
        mockUser as any,
        InvitationPackage.BASIC,
        'PROMO100',
      );

      expect(mockCreateTransaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({ is_free: true, amount: 0 });
    });
  });

  describe('handleMidtransNotification', () => {
    it('should mark payment as SUCCESS on settlement', async () => {
      const mockInvitation = { id: 1, isPublished: false };
      const mockPayment = {
        id: 1,
        orderId: 'INV-1-123',
        status: PaymentStatus.PENDING,
        invitationId: 1,
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: null,
        package: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockInvitationRepo.save.mockResolvedValue(mockInvitation);

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
      expect(mockInvitation.isPublished).toBe(true);
      expect(result.updatedStatus).toBe(PaymentStatus.SUCCESS);
    });

    it.each([
      ['virtual account', 'bank_transfer'],
      ['GoPay', 'gopay'],
      ['QRIS', 'qris'],
    ])('should mark %s settlement as SUCCESS', async (_label, paymentType) => {
      const mockInvitation = { id: 10, isPublished: false };
      const mockPayment = {
        id: 10,
        orderId: `INV-${paymentType}-123`,
        status: PaymentStatus.PENDING,
        invitationId: 10,
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: null,
        package: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);
      mockInvitationRepo.save.mockResolvedValue(mockInvitation);

      const grossAmount = '79000.00';
      const signature = createHash('sha512')
        .update(
          `${mockPayment.orderId}200${grossAmount}mock-midtrans-server-key`,
        )
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
      expect(mockInvitation.isPublished).toBe(true);
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

    it('rejects an invalid signature before any transaction is opened', async () => {
      await expect(
        service.handleMidtransNotification({
          order_id: 'INV-99-1',
          status_code: '200',
          gross_amount: '89000.00',
          signature_key: 'invalid',
          transaction_status: 'settlement',
        }),
      ).rejects.toThrow('Invalid Midtrans signature');

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('locks the payment row inside the transaction for a settlement notification', async () => {
      const mockPayment = {
        id: 20,
        orderId: 'INV-20-123',
        status: PaymentStatus.PENDING,
        invitationId: 20,
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: null,
        package: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.findOne.mockResolvedValue(null);

      const grossAmount = '89000.00';
      const signature = createHash('sha512')
        .update(`INV-20-123200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      await service.handleMidtransNotification({
        order_id: 'INV-20-123',
        status_code: '200',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: 'midtrans-tx-20',
        payment_type: 'bank_transfer',
      });

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockPaymentRepo.findOne.mock.calls[0][0]).toEqual({
        where: { orderId: 'INV-20-123' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('does not downgrade a settled payment on a late expire notification', async () => {
      const mockPayment = {
        id: 21,
        orderId: 'INV-21-123',
        status: PaymentStatus.SUCCESS,
        invitationId: 21,
        paymentType: 'bank_transfer',
        paymentMethod: 'midtrans',
        fraudStatus: 'accept',
        transactionId: 'midtrans-tx-21',
        settlementTime: new Date('2026-01-01'),
        affiliateProfileId: null,
        promoCodeId: null,
        package: null,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

      const grossAmount = '89000.00';
      const signature = createHash('sha512')
        .update(`INV-21-123200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      const result = await service.handleMidtransNotification({
        order_id: 'INV-21-123',
        status_code: '200',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'expire',
      });

      expect(result).toEqual({
        orderId: 'INV-21-123',
        updatedStatus: PaymentStatus.SUCCESS,
      });
      expect(mockPaymentRepo.save).not.toHaveBeenCalled();
      expect(mockPromoService.release).not.toHaveBeenCalled();
      expect(mockPayment.status).toBe(PaymentStatus.SUCCESS);
    });

    describe('ai_credits idempotency', () => {
      it('does not double-credit on a duplicate settlement webhook', async () => {
        const mockPayment = {
          id: 30,
          orderId: 'AI-CREDIT-5-10-123',
          status: PaymentStatus.SUCCESS,
          purpose: 'ai_credits',
          userId: 5,
          aiCreditsAmount: 10,
          paymentType: 'bank_transfer',
          paymentMethod: 'midtrans',
          fraudStatus: 'accept',
          transactionId: 'midtrans-tx-30',
          settlementTime: new Date('2026-01-01'),
          invitationId: null,
          affiliateProfileId: null,
        };

        mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
        mockPaymentRepo.save.mockResolvedValue(mockPayment);

        const grossAmount = '14000.00';
        const signature = createHash('sha512')
          .update(
            `AI-CREDIT-5-10-123200${grossAmount}mock-midtrans-server-key`,
          )
          .digest('hex');

        await service.handleMidtransNotification({
          order_id: 'AI-CREDIT-5-10-123',
          status_code: '200',
          gross_amount: grossAmount,
          signature_key: signature,
          transaction_status: 'settlement',
          transaction_id: 'midtrans-tx-30-dup',
          payment_type: 'bank_transfer',
        });

        expect(mockUserRepo.increment).not.toHaveBeenCalled();
      });

      it('credits ai credits exactly once on a fresh settlement', async () => {
        const mockPayment = {
          id: 31,
          orderId: 'AI-CREDIT-5-10-124',
          status: PaymentStatus.PENDING,
          purpose: 'ai_credits',
          userId: 5,
          aiCreditsAmount: 10,
          paymentType: null,
          paymentMethod: null,
          fraudStatus: null,
          transactionId: null,
          settlementTime: null,
          invitationId: null,
          affiliateProfileId: null,
        };

        mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
        mockPaymentRepo.save.mockResolvedValue(mockPayment);

        const grossAmount = '14000.00';
        const signature = createHash('sha512')
          .update(
            `AI-CREDIT-5-10-124200${grossAmount}mock-midtrans-server-key`,
          )
          .digest('hex');

        await service.handleMidtransNotification({
          order_id: 'AI-CREDIT-5-10-124',
          status_code: '200',
          gross_amount: grossAmount,
          signature_key: signature,
          transaction_status: 'settlement',
          transaction_id: 'midtrans-tx-31',
          payment_type: 'bank_transfer',
        });

        expect(mockUserRepo.increment).toHaveBeenCalledTimes(1);
        expect(mockUserRepo.increment).toHaveBeenCalledWith(
          { id: 5 },
          'aiCredits',
          10,
        );
      });
    });

    it('throws NotFoundException with the standard message for an unknown orderId', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);

      const grossAmount = '89000.00';
      const signature = createHash('sha512')
        .update(`INV-404-1200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      await expect(
        service.handleMidtransNotification({
          order_id: 'INV-404-1',
          status_code: '200',
          gross_amount: grossAmount,
          signature_key: signature,
          transaction_status: 'settlement',
        }),
      ).rejects.toThrow('Payment with order_id INV-404-1 not found');
    });

    it('saves the payment before crediting the affiliate commission', async () => {
      const mockPayment = {
        id: 40,
        orderId: 'INV-40-123',
        status: PaymentStatus.PENDING,
        invitationId: 40,
        paymentType: null,
        paymentMethod: null,
        fraudStatus: null,
        transactionId: null,
        settlementTime: null,
        affiliateProfileId: 7,
        package: InvitationPackage.BASIC,
      };

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockInvitationRepo.findOne.mockResolvedValue(null);
      mockAffiliateService.creditCommission.mockResolvedValue(null);

      const grossAmount = '89000.00';
      const signature = createHash('sha512')
        .update(`INV-40-123200${grossAmount}mock-midtrans-server-key`)
        .digest('hex');

      await service.handleMidtransNotification({
        order_id: 'INV-40-123',
        status_code: '200',
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: 'settlement',
        transaction_id: 'midtrans-tx-40',
        payment_type: 'bank_transfer',
      });

      expect(mockPaymentRepo.save).toHaveBeenCalled();
      expect(mockAffiliateService.creditCommission).toHaveBeenCalled();
      expect(mockPaymentRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
        mockAffiliateService.creditCommission.mock.invocationCallOrder[0],
      );
    });
  });
});
