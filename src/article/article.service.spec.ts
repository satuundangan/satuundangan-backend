import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ArticleService } from './article.service';
import { Article } from './article.entity';
import { User } from '../user/user.entity';

describe('ArticleService', () => {
  let service: ArticleService;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };

  const mockArticleRepository = {
    findAndCount: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll admin aggregates', () => {
    it('keeps search-scoped status counts independent from the selected page and status', async () => {
      mockArticleRepository.findAndCount.mockResolvedValueOnce([
        [{ id: 8, status: 'draft' }],
        21,
      ]);
      mockArticleRepository.count
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(19)
        .mockResolvedValueOnce(21);

      const result = await service.findAll(
        2,
        20,
        ' nikah ',
        'title',
        'ASC',
        JSON.stringify({ status: 'draft' }),
      );

      expect(result).toMatchObject({
        total: 21,
        page: 2,
        totalPages: 2,
        statusCounts: { all: 40, published: 19, draft: 21 },
      });
      expect(mockArticleRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
          skip: 20,
          take: 20,
          order: { title: 'ASC' },
        }),
      );
      expect(mockArticleRepository.count).toHaveBeenNthCalledWith(1, {
        where: { title: expect.objectContaining({ _value: '%nikah%' }) },
      });
      expect(mockArticleRepository.count).toHaveBeenNthCalledWith(2, {
        where: { title: expect.anything(), status: 'published' },
      });
    });

    it('rejects malformed or unsupported status filters', async () => {
      await expect(
        service.findAll(1, 20, undefined, 'createdAt', 'DESC', '{broken'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findAll(
          1,
          20,
          undefined,
          'createdAt',
          'DESC',
          JSON.stringify({ status: 'deleted' }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('clamps pagination and whitelists sorting fields', async () => {
      mockArticleRepository.findAndCount.mockResolvedValueOnce([[], 0]);
      mockArticleRepository.count.mockResolvedValue(0);
      await service.findAll(
        -2,
        1000,
        '   ',
        'title DESC; DROP TABLE articles',
        'ASC',
      );
      expect(mockArticleRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 100,
          order: { createdAt: 'ASC' },
        }),
      );
    });
  });

  describe('versioned editorial updates', () => {
    const article = () => ({ id: 1, title: 'Judul lama', slug: 'judul-lama', content: '<p>Lama</p>', status: 'draft', editVersion: 4, authorId: 1, sourceUrls: [], generatedByAi: false, revisionHistory: [], reviewedAt: null, reviewedByUserId: null });

    it('saves a prior snapshot and conditionally increments the edit version', async () => {
      mockArticleRepository.findOne.mockResolvedValue(article());
      mockArticleRepository.update.mockResolvedValueOnce({ affected: 1 });
      await service.update(1, { content: '<p>Baru</p>', expectedVersion: 4 }, 9);
      expect(mockArticleRepository.update).toHaveBeenCalledWith({ id: 1, editVersion: 4 }, expect.objectContaining({ content: '<p>Baru</p>', editVersion: 5, revisionHistory: [expect.objectContaining({ savedByUserId: 9, snapshot: expect.objectContaining({ content: '<p>Lama</p>' }) })] }));
    });

    it('rejects stale edits and a lost atomic update instead of overwriting newer content', async () => {
      mockArticleRepository.findOne.mockResolvedValue(article());
      await expect(service.update(1, { title: 'Judul baru', expectedVersion: 3 }, 9)).rejects.toThrow(ConflictException);
      mockArticleRepository.update.mockResolvedValueOnce({ affected: 0 });
      await expect(service.update(1, { content: 'baru', expectedVersion: 4 }, 9)).rejects.toThrow(ConflictException);
    });

    it('requires accountable review and a source before publishing AI content', async () => {
      mockArticleRepository.findOne.mockResolvedValue({ ...article(), generatedByAi: true });
      await expect(service.update(1, { status: 'published', expectedVersion: 4 }, 9)).rejects.toThrow(BadRequestException);
      mockArticleRepository.update.mockResolvedValueOnce({ affected: 1 });
      await service.update(1, { status: 'published', editorialReviewed: true, sourceUrls: ['https://example.com/source'], expectedVersion: 4 }, 9);
      expect(mockArticleRepository.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reviewedByUserId: 9, reviewedAt: expect.any(Date), status: 'published' }));
    });

    it('restores a prior saved version as a draft and preserves an additional history snapshot', async () => {
      const current = article();
      current.revisionHistory = [{ id: 'older', savedAt: new Date().toISOString(), savedByUserId: 2, snapshot: { title: 'Judul sebelumnya', content: '<p>Sebelumnya</p>' } }] as any;
      mockArticleRepository.findOne.mockResolvedValue(current);
      mockArticleRepository.update.mockResolvedValueOnce({ affected: 1 });
      await service.restoreRevision(1, 'older', { expectedVersion: 4 }, 9);
      expect(mockArticleRepository.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: 'Judul sebelumnya', status: 'draft', reviewedAt: null, reviewedByUserId: null }));
    });

    it('rejects schedules without an explicit timezone or with a past date', async () => {
      mockArticleRepository.findOne.mockResolvedValue(article());
      await expect(service.update(1, { status: 'scheduled', scheduledPublishAt: '2026-10-30T08:00', expectedVersion: 4 }, 9)).rejects.toThrow(BadRequestException);
      await expect(service.update(1, { status: 'scheduled', scheduledPublishAt: '2020-01-01T01:00:00Z', expectedVersion: 4 }, 9)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllPublished', () => {
    it('should query published articles with default pagination and relations', async () => {
      const mockArticles = [
        { id: 1, title: 'Tips Pernikahan', status: 'published' },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([mockArticles, 1]);

      const result = await service.findAllPublished();

      expect(mockArticleRepository.createQueryBuilder).toHaveBeenCalledWith(
        'article',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'article.author',
        'author',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "article.status = 'published'",
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'article.publishedAt',
        'DESC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);

      expect(result).toEqual({
        items: mockArticles,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply search filter on title, excerpt, and content when q is provided', async () => {
      const mockArticles = [
        {
          id: 2,
          title: 'Undangan Digital',
          excerpt: 'Ringkasan',
          content: 'Konten',
          status: 'published',
        },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([mockArticles, 1]);

      const result = await service.findAllPublished(1, 10, 'undangan');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "article.status = 'published'",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(article.title LIKE :q OR article.excerpt LIKE :q OR article.content LIKE :q)',
        { q: '%undangan%' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.items).toEqual(mockArticles);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should trim search query parameter and ignore empty or whitespace q', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.findAllPublished(2, 5, '   ');
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);

      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.findAllPublished(1, 10, '   nikah   ');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(article.title LIKE :q OR article.excerpt LIKE :q OR article.content LIKE :q)',
        { q: '%nikah%' },
      );
    });

    it('should calculate totalPages correctly based on total count and limit', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 23]);

      const result = await service.findAllPublished(1, 10);
      expect(result.total).toBe(23);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findBySlug', () => {
    it('should return published article by slug', async () => {
      const article = { id: 1, slug: 'test-slug', status: 'published' };
      mockArticleRepository.findOne.mockResolvedValueOnce(article);

      const result = await service.findBySlug('test-slug');
      expect(result).toEqual(article);
      expect(mockArticleRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug', status: 'published' },
        relations: ['author'],
      });
    });

    it('should throw NotFoundException if article not found or not published', async () => {
      mockArticleRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlug('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
