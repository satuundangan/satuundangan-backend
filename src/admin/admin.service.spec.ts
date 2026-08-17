import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { Category } from '../category/category.entity';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import { UploadService } from '../modules/upload/upload.service';

function createChainableQueryBuilder(rawManyResult: any[]) {
  const qb: any = {
    getRawMany: jest.fn().mockResolvedValue(rawManyResult),
  };
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.leftJoin = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  return qb;
}

describe('AdminService - getDashboardStats', () => {
  let service: AdminService;
  let queryBuilders: any[];
  let rawResultsQueue: any[][];

  const mockInvitationRepo = {
    createQueryBuilder: jest.fn(() => {
      const rawManyResult = rawResultsQueue[queryBuilders.length] ?? [];
      const qb = createChainableQueryBuilder(rawManyResult);
      queryBuilders.push(qb);
      return qb;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilders = [];
    rawResultsQueue = [[], []];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepo,
        },
        { provide: getRepositoryToken(Guest), useValue: {} },
        { provide: getRepositoryToken(GuestMessage), useValue: {} },
        { provide: getRepositoryToken(TemplateDesign), useValue: {} },
        { provide: getRepositoryToken(TemplateDesignSection), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: getRepositoryToken(Section), useValue: {} },
        { provide: getRepositoryToken(Audio), useValue: {} },
        { provide: getRepositoryToken(Bank), useValue: {} },
        { provide: getRepositoryToken(PaletteColor), useValue: {} },
        { provide: UploadService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('builds the category query via templateDesign -> category relation joins (not inv.category)', async () => {
    await service.getDashboardStats();

    const categoryQb = queryBuilders[0];
    expect(categoryQb.leftJoin).toHaveBeenCalledWith(
      'inv.templateDesign',
      'templateDesign',
    );
    expect(categoryQb.leftJoin).toHaveBeenCalledWith(
      'templateDesign.category',
      'category',
    );
    expect(categoryQb.select).toHaveBeenCalledWith('category.name', 'category');
    expect(categoryQb.select).not.toHaveBeenCalledWith(
      'inv.category',
      'category',
    );
    expect(categoryQb.groupBy).toHaveBeenCalledWith('category.name');
  });

  it('coerces raw category rows into { category, count } with null rolled up into Lainnya', async () => {
    rawResultsQueue = [
      [
        { category: 'Romantis', count: '3' },
        { category: null, count: '2' },
      ],
      [],
    ];

    const result = await service.getDashboardStats();

    expect(result.categories).toEqual([
      { category: 'Romantis', count: 3 },
      { category: 'Lainnya', count: 2 },
    ]);
  });

  it('resolves without throwing and returns a 7-entry trend ending in Hari Ini', async () => {
    const result = await service.getDashboardStats();

    expect(result.trend).toHaveLength(7);
    expect(result.trend[6].dayLabel).toBe('Hari Ini');
  });
});
