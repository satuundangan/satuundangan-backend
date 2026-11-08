import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { InvitationPackage } from '../invitation/invitation.entity';
import { PaymentStatus } from './types/payment.type';
import { User } from '../user/user.entity';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<Partial<PaymentService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const unverifiedUser = {
    id: 42,
    email: 'unverified@example.com',
    fullName: 'Unverified User',
    password: 'hashed-password',
    provider: 'email',
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;

  beforeEach(async () => {
    paymentService = {
      createTransaction: jest.fn(),
      simulatePayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      handleMidtransNotification: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://satuundangan.id';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: paymentService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Route Guards Verification (SAT-43 unblock unverified users)', () => {
    it('createSnap should be guarded by JwtAuthGuard but NOT EmailVerifiedGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        PaymentController.prototype.createSnap,
      );
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).not.toContain(EmailVerifiedGuard);
    });

    it('simulate should be guarded by JwtAuthGuard but NOT EmailVerifiedGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        PaymentController.prototype.simulate,
      );
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).not.toContain(EmailVerifiedGuard);
    });
  });

  describe('createSnap (checkout)', () => {
    it('allows authenticated unverified users to checkout and creates a transaction', async () => {
      const expectedResult = {
        token: 'snap-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
        order_id: 'INV-10-1794118000000',
        is_free: false,
      };

      (paymentService.createTransaction as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const body = {
        invitation_id: 10,
        package: InvitationPackage.PREMIUM,
        promo_code: 'DISKON50',
        affiliate_code: 'AFF123',
        ga_client_id: '1234567890.1699999999',
        acquisition: { source: 'instagram', medium: 'social' },
      };

      const result = await controller.createSnap(body, unverifiedUser);

      expect(result).toEqual(expectedResult);
      expect(paymentService.createTransaction).toHaveBeenCalledWith(
        10,
        unverifiedUser,
        InvitationPackage.PREMIUM,
        'DISKON50',
        'AFF123',
        {
          gaClientId: '1234567890.1699999999',
          acquisition: { source: 'instagram', medium: 'social' },
        },
      );
    });
  });

  describe('simulate (dev simulation)', () => {
    it('allows authenticated unverified users to simulate payment', async () => {
      const expectedResult = {
        id: 1,
        orderId: 'INV-10-1794118000000',
        status: PaymentStatus.SUCCESS,
      };

      (paymentService.simulatePayment as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const body = {
        invitation_id: 10,
        status: PaymentStatus.SUCCESS,
      };

      const result = await controller.simulate(body, unverifiedUser);

      expect(result).toEqual(expectedResult);
      expect(paymentService.simulatePayment).toHaveBeenCalledWith(
        10,
        PaymentStatus.SUCCESS,
        unverifiedUser,
      );
    });
  });

  describe('getPackages', () => {
    it('returns packages with prices, labels, and features', () => {
      const packages = controller.getPackages();
      expect(packages.length).toBeGreaterThan(0);
      expect(packages[0]).toHaveProperty('id');
      expect(packages[0]).toHaveProperty('label');
      expect(packages[0]).toHaveProperty('price');
      expect(packages[0]).toHaveProperty('features');
    });
  });

  describe('getStatus', () => {
    it('calls paymentService.getPaymentStatus with orderId', async () => {
      const statusResult = { orderId: 'ORDER-1', status: PaymentStatus.SUCCESS };
      (paymentService.getPaymentStatus as jest.Mock).mockResolvedValue(
        statusResult,
      );

      const res = await controller.getStatus('ORDER-1');
      expect(res).toEqual(statusResult);
      expect(paymentService.getPaymentStatus).toHaveBeenCalledWith('ORDER-1');
    });
  });

  describe('handleNotification', () => {
    it('calls paymentService.handleMidtransNotification and returns confirmation', async () => {
      const notificationPayload: any = {
        order_id: 'ORDER-1',
        transaction_status: 'settlement',
        gross_amount: '99000.00',
      };
      (paymentService.handleMidtransNotification as jest.Mock).mockResolvedValue({
        status: 'settlement',
      });

      const res = await controller.handleNotification(notificationPayload);
      expect(res).toEqual({
        message: 'Notification received',
        result: { status: 'settlement' },
      });
      expect(paymentService.handleMidtransNotification).toHaveBeenCalledWith(
        notificationPayload,
      );
    });
  });

  describe('Redirect handlers', () => {
    let mockRes: { redirect: jest.Mock };

    beforeEach(() => {
      mockRes = { redirect: jest.fn() };
    });

    it('handleFinish redirects to /payment/finish with query params', () => {
      controller.handleFinish(
        { order_id: 'ORDER-1', status_code: '200' },
        mockRes as any,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://satuundangan.id/payment/finish?order_id=ORDER-1&status_code=200',
      );
    });

    it('handlePending redirects to /payment/pending with query params', () => {
      controller.handlePending({ order_id: 'ORDER-1' }, mockRes as any);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://satuundangan.id/payment/pending?order_id=ORDER-1',
      );
    });

    it('handleError redirects to /payment/error with query params', () => {
      controller.handleError({ order_id: 'ORDER-1' }, mockRes as any);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://satuundangan.id/payment/error?order_id=ORDER-1',
      );
    });
  });
});
