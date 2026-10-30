import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LeadService } from './lead.service';
import { Lead } from './lead.entity';

describe('LeadService', () => {
  let service: LeadService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation((lead) =>
        Promise.resolve({ id: 1, createdAt: new Date(), updatedAt: new Date(), ...lead }),
      ),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(true),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        {
          provide: getRepositoryToken(Lead),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<LeadService>(LeadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new lead with defaults', async () => {
      const dto = {
        name: 'John Doe',
        whatsapp: '08123456789',
        estimatedBudget: 50000000,
        concept: 'Rustic Modern',
        note: 'Customer wants wedding in Bali',
      };

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('John Doe');
      expect(result.source).toBe('organic');
      expect(result.stage).toBe('new');
      expect(result.notes).toHaveLength(1);
      expect(result.notes![0].note).toBe('Customer wants wedding in Bali');
    });
  });

  describe('findAll', () => {
    it('should query leads with filters and pagination', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1, name: 'Alice' }], 1]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll({
        stage: 'new',
        source: 'budget_calculator',
        search: 'Alice',
        page: 1,
        limit: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('lead.stage = :stage', { stage: 'new' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('lead.source = :source', { source: 'budget_calculator' });
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return lead if found', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, name: 'Bob' });
      const result = await service.findOne(1);
      expect(result).toEqual({ id: 1, name: 'Bob' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update fields and append new note', async () => {
      const existing = {
        id: 1,
        name: 'Bob',
        notes: [{ note: 'First note', author: 'System', createdAt: new Date() }],
        stage: 'new',
      };
      mockRepo.findOne.mockResolvedValue({ ...existing });

      const result = await service.update(1, {
        stage: 'contacted',
        newNote: 'Followed up via WA',
        noteAuthor: 'Agent 1',
      });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.stage).toBe('contacted');
      expect(result.notes).toHaveLength(2);
      expect(result.notes![1].note).toBe('Followed up via WA');
      expect(result.notes![1].author).toBe('Agent 1');
    });
  });

  describe('remove', () => {
    it('should remove lead', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, name: 'Bob' });
      const result = await service.remove(1);
      expect(mockRepo.remove).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
