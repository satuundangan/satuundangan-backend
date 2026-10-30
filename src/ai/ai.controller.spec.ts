import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PaymentService } from '../payment/payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';

describe('AiController', () => {
  let controller: AiController;
  let mockAiService: any;
  let mockPaymentService: any;

  beforeEach(async () => {
    mockAiService = {
      getCredits: jest.fn(),
      chat: jest.fn(),
      getAdminStats: jest.fn(),
      getAdminLogs: jest.fn(),
    };

    mockPaymentService = {
      createAiCreditTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: mockAiService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get credits for user', async () => {
    mockAiService.getCredits.mockResolvedValue({ credits: 5 });
    const user = { id: 1 } as User;
    const result = await controller.getCredits(user);
    expect(result).toEqual({ credits: 5 });
    expect(mockAiService.getCredits).toHaveBeenCalledWith(1);
  });

  it('should chat with Nova AI', async () => {
    const chatResponse = { message: 'Halo!', creditsRemaining: 4 };
    mockAiService.chat.mockResolvedValue(chatResponse);
    const user = { id: 1 } as User;
    const dto = { messages: [{ role: 'user' as const, content: 'Hi' }] };

    const result = await controller.chat(dto, user);
    expect(result).toEqual(chatResponse);
    expect(mockAiService.chat).toHaveBeenCalledWith(1, dto.messages, undefined);
  });

  it('should get admin stats', async () => {
    const stats = { totalCreditsPurchased: 10, totalRequests: 5 };
    mockAiService.getAdminStats.mockResolvedValue(stats);

    const result = await controller.getAdminStats();
    expect(result).toEqual({ success: true, data: stats });
  });

  it('should get admin logs', async () => {
    const logsResult = { data: [], total: 0, page: 1, limit: 20 };
    mockAiService.getAdminLogs.mockResolvedValue(logsResult);

    const result = await controller.getAdminLogs({ status: 'success' });
    expect(result.success).toBe(true);
    expect(mockAiService.getAdminLogs).toHaveBeenCalledWith({ status: 'success' });
  });
});
