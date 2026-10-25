import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesignService } from './template-design.service';
import { TemplateDesign } from './template-design.entity';
import { TemplateDesignSection } from './template-design-section.entity';
import { Section } from '../admin/entities/section.entity';
import { Category } from '../category/category.entity';

describe('TemplateDesignService', () => {
  let service: TemplateDesignService;

  const mockTemplateRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({})),
  };

  const mockCategoryRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockTemplateSectionRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockSectionRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
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
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(TemplateDesignSection),
          useValue: mockTemplateSectionRepo,
        },
        {
          provide: getRepositoryToken(Section),
          useValue: mockSectionRepo,
        },
      ],
    }).compile();

    service = module.get<TemplateDesignService>(TemplateDesignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() filters isPublished: true and defaults to newest first (id: DESC)', async () => {
    await service.findAll();

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
    expect(mockTemplateRepo.find.mock.calls[0][0].order).toEqual({
      id: 'DESC',
    });
  });

  it('findAll(sort) supports custom sort options like name or oldest', async () => {
    await service.findAll('name');
    expect(mockTemplateRepo.find.mock.calls[0][0].order).toEqual({
      name: 'ASC',
    });

    await service.findAll('oldest');
    expect(mockTemplateRepo.find.mock.calls[1][0].order).toEqual({
      id: 'ASC',
    });

    await service.findAll('price_desc');
    expect(mockTemplateRepo.find.mock.calls[2][0].order).toEqual({
      price: 'DESC',
    });
  });

  it("findByCategory('romantis') filters isPublished: true, category and defaults to id: DESC", async () => {
    await service.findByCategory('romantis');

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
      category: { name: 'romantis' },
    });
    expect(mockTemplateRepo.find.mock.calls[0][0].order).toEqual({
      id: 'DESC',
    });
  });

  it("findByCategory('semua') filters isPublished: true with no category constraint and id: DESC", async () => {
    await service.findByCategory('semua');

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
    expect(mockTemplateRepo.find.mock.calls[0][0].order).toEqual({
      id: 'DESC',
    });
  });

  it('findByCategory(undefined) filters isPublished: true with no category constraint and id: DESC', async () => {
    await service.findByCategory(undefined);

    expect(mockTemplateRepo.find.mock.calls[0][0].where).toEqual({
      isPublished: true,
    });
    expect(mockTemplateRepo.find.mock.calls[0][0].order).toEqual({
      id: 'DESC',
    });
  });

  it("findBySlug('draft-x') has no isPublished constraint and preserves componentKey", async () => {
    const result = await service.findBySlug('draft-x');

    expect(mockTemplateRepo.findOne.mock.calls[0][0].where).toEqual({
      slug: 'draft-x',
    });
    expect(mockTemplateRepo.findOne.mock.calls[0][0].where).not.toHaveProperty(
      'isPublished',
    );
    expect(result.componentKey).toBe('royal-emerald');
  });

  it('create() stringifies designConfig object before passing to templateRepo.create', async () => {
    await service.create({
      designConfig: { colors: { primary: '#123456' } } as any,
    });

    expect(mockTemplateRepo.create.mock.calls[0][0].designConfig).toBe(
      JSON.stringify({ colors: { primary: '#123456' } }),
    );
    expect(typeof mockTemplateRepo.create.mock.calls[0][0].designConfig).toBe(
      'string',
    );
  });

  it("findBySlug('tema-batak') parses a valid designConfig JSON string into an object", async () => {
    mockTemplateRepo.findOne.mockResolvedValueOnce({
      id: 2,
      slug: 'tema-batak',
      designConfig: '{"colors":{"primary":"#123456"}}',
    });

    const result = (await service.findBySlug('tema-batak')) as any;

    expect(result.designConfig.colors.primary).toBe('#123456');
  });

  it('findBySlug() leaves a malformed designConfig string untouched (no throw)', async () => {
    mockTemplateRepo.findOne.mockResolvedValueOnce({
      id: 3,
      slug: 'broken-config',
      designConfig: '{oops',
    });

    const result = await service.findBySlug('broken-config');

    expect(result.designConfig).toBe('{oops');
  });

  it('findBySlug() does not crash when designConfig is null', async () => {
    mockTemplateRepo.findOne.mockResolvedValueOnce({
      id: 4,
      slug: 'no-config',
      designConfig: null,
    });

    const result = await service.findBySlug('no-config');

    expect(result.designConfig == null).toBe(true);
  });
});
