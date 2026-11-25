import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { WeddingPlannerService } from './wedding-planner.service';
import { WeddingPlanner } from './wedding-planner.entity';
import { User } from '../user/user.entity';

describe('WeddingPlannerService (SAT-72)', () => {
  let service: WeddingPlannerService;

  const mockPlannerRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeddingPlannerService,
        {
          provide: getRepositoryToken(WeddingPlanner),
          useValue: mockPlannerRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<WeddingPlannerService>(WeddingPlannerService);
  });

  it('generates and persists a rundownShareToken when missing', async () => {
    const planner = { id: 1, userId: 7, rundownShareToken: null };
    mockPlannerRepo.findOne.mockResolvedValue(planner);
    mockPlannerRepo.save.mockImplementation(async (p) => p);

    const res = await service.generateOrGetRundownShareToken(7);
    expect(res.rundownShareToken).toMatch(/^[a-f0-9]{24}$/);
    expect(mockPlannerRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns public technical rundown and vendor PICs while stripping financial fields', async () => {
    mockPlannerRepo.findOne.mockResolvedValue({
      weddingDate: '2026-12-20',
      weddingConcept: 'Modern',
      estimatedGuests: 250,
      budgetTotal: 90000000,
      budgetItems: [{ id: 'b1', estimatedCost: 50000000 }],
      rundown: [
        { id: 'r1', time: '05:00', activity: 'MUA Standby', location: 'Suite A', pic: 'WO Sari' },
      ],
      vendors: [
        {
          id: 'v1',
          category: 'MUA',
          name: 'Studio Cantik',
          picName: 'Mbak Rina',
          phoneNumber: '08123456789',
          price: 15000000,
          paymentStatus: 'dp',
        },
      ],
    });

    const res = await service.getPublicRundownByToken('abc123');
    expect(res.rundown).toHaveLength(1);
    expect(res.vendors[0]).toEqual({
      id: 'v1',
      category: 'MUA',
      name: 'Studio Cantik',
      picName: 'Mbak Rina',
      phoneNumber: '08123456789',
      instagram: '',
      notes: '',
    });
    expect((res as any).budgetTotal).toBeUndefined();
    expect((res as any).budgetItems).toBeUndefined();
    expect((res.vendors[0] as any).price).toBeUndefined();
  });

  it('throws NotFoundException when token is invalid', async () => {
    mockPlannerRepo.findOne.mockResolvedValue(null);
    await expect(service.getPublicRundownByToken('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });
});
