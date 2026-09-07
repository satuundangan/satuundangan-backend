import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SitemapService } from './sitemap.service';
import { Article } from '../article/article.entity';

describe('SitemapService', () => {
  let service: SitemapService;

  const mockArticleRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockArticleRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitemapService,
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepo,
        },
      ],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('queries only published articles and never returns drafts', async () => {
    await service.generate();

    expect(mockArticleRepo.find.mock.calls[0][0].where).toEqual({
      status: 'published',
    });
  });

  it('produces valid XML with the sitemap urlset namespace', async () => {
    const xml = await service.generate();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
  });

  it('lists the homepage and every static public route, excluding redirect-only routes', async () => {
    const xml = await service.generate();

    expect(xml).toContain('<loc>https://www.satuundangan.id/</loc>');
    for (const path of [
      '/blog',
      '/templates',
      '/create',
      '/tentang-kami',
      '/terms',
      '/privacy',
    ]) {
      expect(xml).toContain(`<loc>https://www.satuundangan.id${path}</loc>`);
    }
    expect(xml).not.toContain('/syarat-ketentuan');
    expect(xml).not.toContain('/kebijakan-privasi');
  });

  it('includes a published article with lastmod from updatedAt over publishedAt', async () => {
    mockArticleRepo.find.mockResolvedValue([
      {
        slug: 'foo',
        publishedAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-03-04'),
      },
    ]);

    const xml = await service.generate();

    expect(xml).toContain('<loc>https://www.satuundangan.id/blog/foo</loc>');
    expect(xml).toContain('<lastmod>2026-03-04</lastmod>');
  });

  it('falls back to publishedAt when updatedAt is null', async () => {
    mockArticleRepo.find.mockResolvedValue([
      { slug: 'bar', publishedAt: new Date('2026-02-05'), updatedAt: null },
    ]);

    const xml = await service.generate();

    expect(xml).toContain('<lastmod>2026-02-05</lastmod>');
  });

  it('omits <lastmod> entirely when both dates are null', async () => {
    mockArticleRepo.find.mockResolvedValue([
      { slug: 'baz', publishedAt: null, updatedAt: null },
    ]);

    const xml = await service.generate();
    const entryMatch = xml.match(
      /<loc>https:\/\/www\.satuundangan\.id\/blog\/baz<\/loc>[\s\S]*?<\/url>/,
    );

    expect(entryMatch).not.toBeNull();
    expect(entryMatch![0]).not.toContain('<lastmod>');
  });

  it('produces valid XML with only static routes when there are zero published articles', async () => {
    mockArticleRepo.find.mockResolvedValue([]);

    const xml = await service.generate();

    expect(xml).not.toContain('/blog/');
    expect(xml).toContain('<urlset');
  });

  it('XML-escapes a slug containing & or < characters', async () => {
    mockArticleRepo.find.mockResolvedValue([
      { slug: 'foo&bar<baz', publishedAt: null, updatedAt: null },
    ]);

    const xml = await service.generate();

    expect(xml).toContain('foo&amp;bar&lt;baz');
    expect(xml).not.toContain('foo&bar<baz');
  });
});
