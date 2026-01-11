import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo;
  let invitationRepo;
  let configService;

  const mockPaymentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockInvitationRepo = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SERVER_KEY') return 'mock-server-key';
      if (key === 'CLIENT_KEY') return 'mock-client-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    invitationRepo = module.get(getRepositoryToken(Invitation));
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create a transaction successfully', async () => {
      const invitationId = 1;
      const mockInvitation = {
        id: invitationId,
        title: 'Wedding',
        user: { name: 'Test User', email: 'test@example.com' },
      };

      mockInvitationRepo.findOne.mockResolvedValue(mockInvitation);

      // Mock snap.createTransaction
      // Since snap is a private property instantiated in constructor, we might need to spy on it
      // or rely on the fact that we can't easily mock `new Snap()` without external library overrides.
      // However, for this unit test to run without actual Midtrans call, we need to handle `this.snap`.
      // The service instantiates Snap directly. This makes it hard to mock without dependency injection.
      // A common workaround in Jest for direct instantiation is harder.
      // We will try to mock the method by casting service to any or spying if possible,
      // but since it's a property on the instance, we can try to replace it after instantiation.

      const mockSnapResponse = {
        token: 'mock-token',
        redirect_url: 'http://mock-url',
      };

      // Inject mock snap object
      (service as any).snap = {
        createTransaction: jest.fn().mockResolvedValue(mockSnapResponse),
      };

      mockPaymentRepo.create.mockReturnValue({ id: 1 });
      mockPaymentRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.createTransaction(invitationId);

      expect(invitationRepo.findOne).toHaveBeenCalledWith({
        where: { id: invitationId },
        relations: ['user', 'templateDesign'],
      });
      expect((service as any).snap.createTransaction).toHaveBeenCalled();
      expect(paymentRepo.create).toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        token: 'mock-token',
        redirect_url: 'http://mock-url',
        order_id: expect.stringContaining(`INV-${invitationId}-`),
      });
    });
  });
});
