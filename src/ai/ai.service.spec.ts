import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { User } from '../user/user.entity';
import { AiCreditLog } from './ai-credit-log.entity';

describe('AiService', () => {
  let service: AiService;
  let mockUserRepo: any;
  let mockCreditLogRepo: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOneOrFail: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    };

    mockCreditLogRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation((log) =>
        Promise.resolve({ id: 1, createdAt: new Date(), ...log }),
      ),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-deepseek-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(AiCreditLog), useValue: mockCreditLogRepo },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('chat', () => {
    it('should throw PAYMENT_REQUIRED if user has 0 credits on first message', async () => {
      mockUserRepo.findOneOrFail.mockResolvedValue({ id: 1, aiCredits: 0 });

      await expect(
        service.chat(1, [{ role: 'user', content: 'Halo Nova' }]),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.PAYMENT_REQUIRED,
        }),
      );
    });

    it('should deduct 1 credit, call DeepSeek, compute IDR pricing and record credit log', async () => {
      mockUserRepo.findOneOrFail.mockResolvedValue({ id: 1, aiCredits: 5 });

      const mockDeepSeekResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                updatedData: { groomName: 'Fauzan' },
                message: 'Halo Fauzan!',
                isComplete: false,
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockDeepSeekResponse),
      } as any);

      const result = await service.chat(1, [
        { role: 'user', content: 'Nama saya Fauzan' },
      ]);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ aiCredits: 4 }),
      );
      expect(mockCreditLogRepo.create).toHaveBeenCalled();
      expect(mockCreditLogRepo.save).toHaveBeenCalled();

      // DeepSeek IDR pricing: 1000 * 0.0022 + 500 * 0.0044 = 2.2 + 2.2 = 4.4
      expect(mockCreditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          creditsChange: -1,
          creditsBalance: 4,
          status: 'success',
          promptTokens: 1000,
          completionTokens: 500,
          estimatedCostIdr: 4.4,
        }),
      );

      expect(result.updatedData.groomName).toBe('Fauzan');
      expect(result.creditsRemaining).toBe(4);
    });

    it('should record failed credit log if DeepSeek returns non-ok response', async () => {
      mockUserRepo.findOneOrFail.mockResolvedValue({ id: 1, aiCredits: 2 });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      } as any);

      const result = await service.chat(1, [
        { role: 'user', content: 'Halo' },
      ]);

      expect(result.message).toContain('Nova sedang sibuk');
      expect(mockCreditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Rate limit exceeded',
        }),
      );
    });
  });

  describe('getAdminStats', () => {
    it('should aggregate credits purchased, credits used, estimated cost and counts', async () => {
      const mockLogs = [
        {
          userId: 1,
          action: 'topup',
          creditsChange: 10,
          status: 'success',
          estimatedCostIdr: 0,
        },
        {
          userId: 1,
          action: 'deduct',
          creditsChange: -1,
          status: 'success',
          estimatedCostIdr: 4.4,
        },
        {
          userId: 2,
          action: 'deduct',
          creditsChange: -1,
          status: 'success',
          estimatedCostIdr: 2.2,
        },
        {
          userId: 2,
          action: 'deduct',
          creditsChange: 0,
          status: 'failed',
          estimatedCostIdr: 0,
        },
      ];

      mockCreditLogRepo.find.mockResolvedValue(mockLogs);

      const stats = await service.getAdminStats();

      expect(stats.totalCreditsPurchased).toBe(10);
      expect(stats.totalCreditsUsed).toBe(2);
      expect(stats.totalEstimatedCostIdr).toBe(6.6);
      expect(stats.totalRequests).toBe(4);
      expect(stats.successfulRequests).toBe(3);
      expect(stats.failedRequests).toBe(1);
      expect(stats.activeUsersCount).toBe(2);
    });
  });

  describe('getAdminLogs', () => {
    it('should filter logs by status and userId with pagination', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      };
      mockCreditLogRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getAdminLogs({
        status: 'success',
        userId: 1,
        page: 1,
        limit: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.status = :status', { status: 'success' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: 1 });
      expect(result.total).toBe(1);
    });
  });
});
