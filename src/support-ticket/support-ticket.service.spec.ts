import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  SupportTicketService,
  calculateOperationalMinutes,
} from './support-ticket.service';
import {
  SupportTicket,
  isUrgentWeddingDate,
} from './support-ticket.entity';

describe('SupportTicketService', () => {
  let service: SupportTicketService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation((ticket) =>
        Promise.resolve({
          id: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...ticket,
        }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketService,
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<SupportTicketService>(SupportTicketService);
  });

  describe('isUrgentWeddingDate', () => {
    it('should return true for wedding within 0 to 7 days', () => {
      const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      expect(isUrgentWeddingDate(in3Days)).toBe(true);

      const in6Days = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
      expect(isUrgentWeddingDate(in6Days)).toBe(true);
    });

    it('should return false for wedding further than 7 days or past', () => {
      const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      expect(isUrgentWeddingDate(in20Days)).toBe(false);

      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      expect(isUrgentWeddingDate(past)).toBe(false);
      expect(isUrgentWeddingDate(null)).toBe(false);
    });
  });

  describe('calculateOperationalMinutes', () => {
    it('should calculate operational minutes within same business day (08:00 to 21:00 WIB)', () => {
      // 09:00 WIB to 11:30 WIB on same day = 150 minutes
      // In UTC: 02:00 UTC to 04:30 UTC
      const start = new Date('2026-10-30T02:00:00Z');
      const end = new Date('2026-10-30T04:30:00Z');
      expect(calculateOperationalMinutes(start, end)).toBe(150);
    });

    it('should exclude overnight non-operational hours (21:00 to 08:00 WIB)', () => {
      // 20:00 WIB (13:00 UTC) Day 1 to 09:00 WIB (02:00 UTC) Day 2
      // Day 1 operational: 20:00 - 21:00 = 60 mins
      // Overnight (21:00 - 08:00): 0 mins
      // Day 2 operational: 08:00 - 09:00 = 60 mins
      // Total: 120 minutes
      const start = new Date('2026-10-29T13:00:00Z');
      const end = new Date('2026-10-30T02:00:00Z');
      expect(calculateOperationalMinutes(start, end)).toBe(120);
    });

    it('should handle tickets created outside operational hours', () => {
      // Created at 23:00 WIB (16:00 UTC) Day 1, responded at 08:30 WIB (01:30 UTC) Day 2
      // Day 1: 0 mins
      // Day 2: 08:00 - 08:30 = 30 mins
      const start = new Date('2026-10-29T16:00:00Z');
      const end = new Date('2026-10-30T01:30:00Z');
      expect(calculateOperationalMinutes(start, end)).toBe(30);
    });
  });

  describe('create', () => {
    it('should create ticket and auto-assign urgent priority when wedding is <= 7 days', async () => {
      const nearWedding = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const dto = {
        subject: 'Can not open invitation',
        customerName: 'Budi Santoso',
        weddingDate: nearWedding,
        message: 'Tolong dibantu segera',
      };

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalled();
      expect(result.priority).toBe('urgent');
      expect(result.ticketNumber).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages![0].sender).toBe('customer');
    });

    it('should retain default priority if wedding is far away', async () => {
      const farWedding = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
      const dto = {
        subject: 'Payment inquiry',
        customerName: 'Siti Aminah',
        weddingDate: farWedding,
      };

      const result = await service.create(dto);
      expect(result.priority).toBe('medium');
    });
  });

  describe('findAll', () => {
    it('should filter by status, priority, category and paginate', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll({
        status: 'open',
        priority: 'urgent',
        category: 'technical',
        search: 'Budi',
        page: 1,
        limit: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('ticket.status = :status', { status: 'open' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('ticket.priority = :priority', { priority: 'urgent' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('ticket.category = :category', { category: 'technical' });
      expect(result.total).toBe(1);
    });
  });

  describe('update', () => {
    it('should auto-populate firstResponseAt on first staff message and resolvedAt on resolve', async () => {
      const existing = {
        id: 1,
        status: 'open',
        messages: [{ sender: 'customer', message: 'Hello' }],
        firstResponseAt: null,
        resolvedAt: null,
      };
      mockRepo.findOne.mockResolvedValue({ ...existing });

      const updated = await service.update(1, {
        newMessage: 'Kami sedang cek ya Kak',
        sender: 'staff',
        status: 'resolved',
      });

      expect(updated.firstResponseAt).toBeDefined();
      expect(updated.resolvedAt).toBeDefined();
      expect(updated.messages).toHaveLength(2);
      expect(updated.status).toBe('resolved');
    });
  });

  describe('getMetrics', () => {
    it('should compute operational SLA metrics, backlog, urgent count, and categories', async () => {
      const t1 = {
        id: 1,
        status: 'open',
        priority: 'urgent',
        category: 'technical',
        createdAt: new Date('2026-10-30T01:00:00Z'), // 08:00 WIB
        firstResponseAt: new Date('2026-10-30T01:30:00Z'), // 08:30 WIB (30 mins)
        resolvedAt: null,
        weddingDate: null,
      };
      const t2 = {
        id: 2,
        status: 'in_progress',
        priority: 'medium',
        category: 'payment',
        createdAt: new Date('2026-10-30T02:00:00Z'),
        firstResponseAt: new Date('2026-10-30T03:00:00Z'), // 60 mins
        resolvedAt: new Date('2026-10-30T04:00:00Z'), // 120 mins
        weddingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // urgent wedding!
      };
      const t3 = {
        id: 3,
        status: 'resolved',
        priority: 'low',
        category: 'order',
        createdAt: new Date('2026-10-29T02:00:00Z'),
        firstResponseAt: null,
        resolvedAt: new Date('2026-10-29T04:00:00Z'),
        weddingDate: null,
      };

      mockRepo.find.mockResolvedValue([t1, t2, t3]);

      const metrics = await service.getMetrics();

      expect(metrics.backlog.open).toBe(1);
      expect(metrics.backlog.inProgress).toBe(1);
      expect(metrics.backlog.total).toBe(2);
      expect(metrics.urgentCount).toBe(2); // t1 (urgent priority) + t2 (wedding <= 7 days)
      expect(metrics.categoryBreakdown.technical).toBe(1);
      expect(metrics.categoryBreakdown.payment).toBe(1);
      expect(metrics.categoryBreakdown.order).toBe(1);
      expect(metrics.avgFirstResponseTime.minutes).toBe(45); // (30 + 60) / 2
      expect(metrics.avgResolutionTime.minutes).toBeGreaterThan(0);
    });
  });
});
