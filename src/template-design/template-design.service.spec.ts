import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesignService } from './template-design.service';
import { TemplateDesign } from './template-design.entity';

describe('TemplateDesignService', () => {
  let service: TemplateDesignService;

  const mockTemplateRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTemplateRepo.find.mockResolvedValue([]);
    mockTemplateRepo.findOne.mockResolvedValue({
      id: 1,
      slug: 'draft-x',
      componentKey: 'royal-emerald',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateDesignService,
        {
          provide: getRepositoryToken(TemplateDesign),
          useValue: mockTemplateRepo,
        },
      ],
    }).compile();

    service = module.get<TemplateDesignService>(TemplateDesignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() filters isPublished: true', async () => {
    await service.findAll();

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
  });

  it("findByCategory('romantis') filters isPublished: true and category", async () => {
    await service.findByCategory('romantis');

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
      category: { name: 'romantis' },
    });
  });

  it("findByCategory('semua') filters isPublished: true with no category constraint", async () => {
    await service.findByCategory('semua');

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
  });

  it('findByCategory(undefined) filters isPublished: true with no category constraint', async () => {
    await service.findByCategory(undefined);

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
  });

  it("findBySlug('draft-x') has no isPublished constraint and preserves componentKey", async () => {
    const result = await service.findBySlug('draft-x');

    expect(mockTemplateRepo.findOne.mock.calls[0][0].where).toEqual({
      slug: 'draft-x',
    });
    expect(
      mockTemplateRepo.findOne.mock.calls[0][0].where,
    ).not.toHaveProperty('isPublished');
    expect(result.componentKey).toBe('royal-emerald');
  });
});
