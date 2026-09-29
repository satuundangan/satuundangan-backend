import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
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
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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

  describe('findAllPublished', () => {
    it('should query published articles with default pagination and relations', async () => {
      const mockArticles = [{ id: 1, title: 'Tips Pernikahan', status: 'published' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([mockArticles, 1]);

      const result = await service.findAllPublished();

      expect(mockArticleRepository.createQueryBuilder).toHaveBeenCalledWith('article');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('article.author', 'author');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("article.status = 'published'");
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('article.publishedAt', 'DESC');
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
      const mockArticles = [{ id: 2, title: 'Undangan Digital', excerpt: 'Ringkasan', content: 'Konten', status: 'published' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([mockArticles, 1]);

      const result = await service.findAllPublished(1, 10, 'undangan');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith("article.status = 'published'");
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
      expect(result).toBe(article);
      expect(mockArticleRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug', status: 'published' },
        relations: ['author'],
      });
    });

    it('should throw NotFoundException if article not found or not published', async () => {
      mockArticleRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlug('not-exist')).rejects.toThrow(NotFoundException);
    });
  });
});
