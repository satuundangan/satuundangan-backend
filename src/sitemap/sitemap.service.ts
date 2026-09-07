import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../article/article.entity';

const SITEMAP_ORIGIN =
  process.env.SITEMAP_ORIGIN || 'https://www.satuundangan.id';

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/templates', priority: '0.8', changefreq: 'weekly' },
  { path: '/create', priority: '0.7', changefreq: 'monthly' },
  { path: '/tentang-kami', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
];

const ARTICLE_PRIORITY = '0.6';
const ARTICLE_CHANGEFREQ = 'monthly';

@Injectable()
export class SitemapService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  async generate(): Promise<string> {
    const articles = await this.articleRepository.find({
      where: { status: 'published' },
      select: ['slug', 'publishedAt', 'updatedAt'],
      order: { publishedAt: 'DESC' },
    });

    const entries: string[] = [];

    for (const route of STATIC_ROUTES) {
      entries.push(
        this.buildUrlEntry(
          `${SITEMAP_ORIGIN}${route.path}`,
          null,
          route.changefreq,
          route.priority,
        ),
      );
    }

    for (const article of articles) {
      const lastmod = this.formatLastmod(
        article.updatedAt || article.publishedAt,
      );
      entries.push(
        this.buildUrlEntry(
          `${SITEMAP_ORIGIN}/blog/${this.escapeXml(article.slug)}`,
          lastmod,
          ARTICLE_CHANGEFREQ,
          ARTICLE_PRIORITY,
        ),
      );
    }

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      `${entries.join('\n')}\n` +
      '</urlset>'
    );
  }

  private buildUrlEntry(
    loc: string,
    lastmod: string | null,
    changefreq: string,
    priority: string,
  ): string {
    const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
    return (
      `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n` +
      `    <changefreq>${changefreq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n  </url>`
    );
  }

  private escapeXml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private formatLastmod(date?: Date | null): string | null {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }
}
