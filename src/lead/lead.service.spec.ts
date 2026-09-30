import { Test, TestingModule } from '@nestjs/testing';
import { LeadService } from './lead.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Lead } from './lead.entity';

describe('LeadService', () => {
  let service: LeadService;

  const mockLeadRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn((lead) => Promise.resolve({ id: 1, ...lead, createdAt: new Date() })),
    findAndCount: jest.fn().mockResolvedValue([
      [{ id: 1, name: 'Budi', whatsapp: '08123456789' }],
      1,
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        {
          provide: getRepositoryToken(Lead),
          useValue: mockLeadRepo,
        },
      ],
    }).compile();

    service = module.get<LeadService>(LeadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a lead successfully', async () => {
    const dto = {
      name: 'Rian & Maya',
      whatsapp: '081298765432',
      email: 'rian@test.com',
      estimatedBudget: 50000000,
      guestCount: 300,
      concept: 'Modern Intimate',
      source: 'budget_calculator',
    };

    const result = await service.create(dto);
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.name).toBe('Rian & Maya');
    expect(mockLeadRepo.create).toHaveBeenCalled();
    expect(mockLeadRepo.save).toHaveBeenCalled();
  });

  it('should findAll leads with pagination', async () => {
    const result = await service.findAll(1, 10);
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});
