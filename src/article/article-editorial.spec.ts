import axios from 'axios';
import * as dns from 'dns/promises';
import { ageDays, ArticleEditorialService, joinArticlePerformance } from './article-editorial.service';
import { extractLinks, isPrivateAddress, LinkCheckService } from './link-check.service';

jest.mock('axios');
jest.mock('dns/promises', () => ({ lookup: jest.fn() }));
const lookup = dns.lookup as jest.Mock;
const head = axios.head as jest.Mock;

describe('SSRF guard', () => {
  it('recognises non-public addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('extractLinks', () => {
  it('collects links and images, resolves site-relative paths and drops non-web links', () => {
    const links = extractLinks({
      content: '<p><a href="/templates">t</a> <a href="https://a.test/x">x</a> <a href="mailto:a@b.c">m</a> <a href="#top">top</a> <img src="https://img.test/a.png"></p><a href="https://a.test/x">dup</a>',
      coverImage: 'https://img.test/cover.jpg',
      canonicalUrl: 'https://satuundangan.id/blog/x',
    });
    expect(links.map((l) => l.url)).toEqual([
      'https://satuundangan.id/templates', 'https://a.test/x', 'https://img.test/a.png', 'https://img.test/cover.jpg', 'https://satuundangan.id/blog/x',
    ]);
    expect(links.filter((l) => l.kind === 'gambar')).toHaveLength(2);
  });
});

describe('LinkCheckService', () => {
  const svc = new LinkCheckService();
  beforeEach(() => { jest.clearAllMocks(); lookup.mockResolvedValue([{ address: '93.184.216.34' }]); });
  const article = (url: string) => ({ content: `<a href="${url}">x</a>` });

  it('marks a 404 as broken and a 200 as ok', async () => {
    head.mockResolvedValueOnce({ status: 200, headers: {} }).mockResolvedValueOnce({ status: 404, headers: {} });
    const ok = await svc.check(article('https://ok.test/'));
    const bad = await svc.check(article('https://gone.test/'));
    expect(ok.results[0]).toMatchObject({ status: 'ok', httpStatus: 200 });
    expect(bad).toMatchObject({ broken: 1 });
  });

  it('does not call a link broken when the server merely refuses bots', async () => {
    head.mockResolvedValue({ status: 403, headers: {} });
    const out = await svc.check(article('https://shy.test/'));
    expect(out.results[0].status).toBe('tidak_dicek');
    expect(out.broken).toBe(0);
  });

  it('refuses to contact private addresses', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.8' }]);
    const out = await svc.check(article('https://internal.test/'));
    expect(out.results[0]).toMatchObject({ status: 'tidak_dicek', note: 'Alamat non-publik diblokir' });
    expect(head).not.toHaveBeenCalled();
  });

  it('re-validates every redirect hop', async () => {
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]).mockResolvedValueOnce([{ address: '127.0.0.1' }]);
    head.mockResolvedValueOnce({ status: 302, headers: { location: 'http://localhost/admin' } });
    const out = await svc.check(article('https://redir.test/'));
    expect(out.results[0].status).toBe('tidak_dicek');
    expect(head).toHaveBeenCalledTimes(1);
  });

  it('reports a missing domain as broken', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('nx'), { code: 'ENOTFOUND' }));
    expect((await svc.check(article('https://nope.invalid/'))).results[0]).toMatchObject({ status: 'rusak', note: 'Domain tidak ditemukan' });
  });
});

describe('article performance join', () => {
  const articles = [{ id: 1, title: 'A', slug: 'tips-a', publishedAt: null }, { id: 2, title: 'B', slug: 'tips-b', publishedAt: null }];

  it('matches GA4 and Search Console rows by slug and keeps conversion separate from traffic', () => {
    const rows = joinArticlePerformance(
      articles,
      [{ page: '/blog/tips-a', sessions: 100, activeUsers: 80, engagementRate: 0.6, purchases: 2 }],
      [{ page: 'https://satuundangan.id/blog/tips-a/', clicks: 30, impressions: 900, ctr: 0.033, position: 7.2 }],
    );
    expect(rows[0]).toMatchObject({ reader: { sessions: 100 }, conversion: { purchases: 2 }, search: { clicks: 30, position: 7.2 } });
    expect(rows[1]).toMatchObject({ reader: { sessions: 0 }, search: { clicks: 0, ctr: null } });
  });

  it('leaves a source null when it is not connected instead of showing zero', () => {
    const rows = joinArticlePerformance(articles, null, null);
    expect(rows[0]).toMatchObject({ reader: null, conversion: null, search: null });
  });
});

describe('editorial overview', () => {
  const now = new Date('2026-10-29T05:00:00Z');
  it('computes age in days', () => {
    expect(ageDays('2026-10-19T05:00:00Z', now)).toBe(10);
    expect(ageDays(null, now)).toBeNull();
  });

  it('lists scheduled items, flags overdue ones and surfaces stale content', async () => {
    const make = (rows: Record<string, any[]>) => ({ find: jest.fn(async ({ where }: any) => (where.status === 'scheduled' ? rows.scheduled : where.status === 'published' && where.publishedAt ? rows.recent : where.status === 'published' ? rows.stale : rows.drafts)) });
    const articles: any = make({
      scheduled: [{ id: 1, title: 'Besok', slug: 'besok', scheduledPublishAt: new Date('2026-10-30T01:00:00Z') }, { id: 2, title: 'Terlewat', slug: 'terlewat', scheduledPublishAt: new Date('2026-10-28T01:00:00Z') }],
      recent: [{ id: 3, title: 'Baru', slug: 'baru', publishedAt: new Date('2026-10-28T01:00:00Z') }],
      stale: [{ id: 4, title: 'Lama', slug: 'lama', updatedAt: new Date('2026-01-01T00:00:00Z') }],
      drafts: [{ id: 5, title: 'Draf basi', slug: 'draf', updatedAt: new Date('2026-09-01T00:00:00Z') }],
    });
    const logs: any = { find: jest.fn().mockResolvedValue([{ action: 'ARTICLE_SCHEDULED_PUBLISH_FAILED', createdAt: now, details: { message: 'x' } }]) };
    const svc = new ArticleEditorialService(articles, logs, {} as any, {} as any);
    const out = await svc.overview(now);
    expect(out.calendar.scheduled.map((s) => [s.id, s.overdue, s.date])).toEqual([[1, false, '2026-10-30'], [2, true, '2026-10-28']]);
    expect(out.execution.overdueCount).toBe(1);
    expect(out.execution.note).toContain('1 artikel');
    expect(out.execution.lastRuns[0].ok).toBe(false);
    expect(out.attention.stalePublished[0]).toMatchObject({ id: 4 });
    expect(out.attention.stalePublished[0].ageDays).toBeGreaterThan(180);
    expect(out.attention.staleDrafts[0].id).toBe(5);
  });
});
