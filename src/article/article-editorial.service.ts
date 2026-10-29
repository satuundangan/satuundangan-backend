import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { ActivityLog } from '../admin/entities/activity-log.entity';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';
import { jakartaDate, resolveDashboardPeriod } from '../admin/admin-dashboard-period';
import { AdminAnalyticsService } from '../admin-analytics/admin-analytics.service';
import { Article } from './article.entity';
import { LinkCheckService } from './link-check.service';

const DAY = 86_400_000;
export const STALE_PUBLISHED_DAYS = 180;
export const STALE_DRAFT_DAYS = 30;
const SCHEDULER_ACTIONS = ['ARTICLE_SCHEDULED_PUBLISH_RESULT', 'ARTICLE_SCHEDULED_PUBLISH_FAILED'];
const LIST_FIELDS: Array<keyof Article> = ['id', 'title', 'slug', 'status', 'publishedAt', 'scheduledPublishAt', 'updatedAt', 'createdAt'];

export function ageDays(value: Date | string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor((now.getTime() - time) / DAY) : null;
}

/** Joins per-article GA4 and Search Console rows on the article slug; missing sources stay null, never zero. */
export function joinArticlePerformance(
  articles: Array<{ id: number; title: string; slug: string; publishedAt: Date | string | null }>,
  ga4Rows: Array<{ page: string; sessions: number | null; engagementRate: number | null; activeUsers: number | null; purchases: number | null }> | null,
  gscRows: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }> | null,
) {
  const slugOf = (page: string) => decodeURIComponent(page.split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/^\/blog\//, '').replace(/\/+$/, ''));
  const ga = new Map((ga4Rows ?? []).map((row) => [slugOf(row.page), row]));
  const gsc = new Map((gscRows ?? []).map((row) => [slugOf(row.page), row]));
  return articles.map((article) => {
    const g = ga.get(article.slug);
    const s = gsc.get(article.slug);
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      publishedAt: article.publishedAt,
      reader: ga4Rows ? { sessions: g?.sessions ?? 0, activeUsers: g?.activeUsers ?? 0, engagementRate: g?.engagementRate ?? null } : null,
      conversion: ga4Rows ? { purchases: g?.purchases ?? 0 } : null,
      search: gscRows ? { clicks: s?.clicks ?? 0, impressions: s?.impressions ?? 0, ctr: s?.ctr ?? null, position: s?.position ?? null } : null,
    };
  });
}

@Injectable()
export class ArticleEditorialService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(ActivityLog) private readonly logs: Repository<ActivityLog>,
    private readonly ga4: AdminAnalyticsService,
    private readonly links: LinkCheckService,
  ) {}

  /** Schedule calendar, execution status and the content that needs attention, in one list. */
  async overview(now = new Date()) {
    const staleBefore = new Date(now.getTime() - STALE_PUBLISHED_DAYS * DAY);
    const draftStaleBefore = new Date(now.getTime() - STALE_DRAFT_DAYS * DAY);
    const [scheduled, recent, stalePublished, staleDrafts, runs] = await Promise.all([
      this.articles.find({ where: { status: 'scheduled' }, select: LIST_FIELDS, order: { scheduledPublishAt: 'ASC' }, take: 100 }),
      this.articles.find({ where: { status: 'published', publishedAt: MoreThanOrEqual(new Date(now.getTime() - 14 * DAY)) }, select: LIST_FIELDS, order: { publishedAt: 'DESC' }, take: 50 }),
      this.articles.find({ where: { status: 'published', updatedAt: LessThan(staleBefore) }, select: LIST_FIELDS, order: { updatedAt: 'ASC' }, take: 50 }),
      this.articles.find({ where: { status: 'draft', updatedAt: LessThan(draftStaleBefore) }, select: LIST_FIELDS, order: { updatedAt: 'ASC' }, take: 50 }),
      this.logs.find({ where: { action: In(SCHEDULER_ACTIONS) }, order: { id: 'DESC' }, take: 10 }),
    ]);
    const overdue = scheduled.filter((a) => a.scheduledPublishAt && new Date(a.scheduledPublishAt).getTime() < now.getTime());
    const withAge = (rows: Article[]) => rows.map((a) => ({ id: a.id, title: a.title, slug: a.slug, updatedAt: a.updatedAt, ageDays: ageDays(a.updatedAt, now) }));
    return {
      timezone: 'Asia/Jakarta',
      generatedAt: now.toISOString(),
      calendar: {
        scheduled: scheduled.map((a) => ({ id: a.id, title: a.title, slug: a.slug, scheduledPublishAt: a.scheduledPublishAt, date: a.scheduledPublishAt ? jakartaDate(new Date(a.scheduledPublishAt)) : null, overdue: overdue.some((o) => o.id === a.id) })),
        recentlyPublished: recent.map((a) => ({ id: a.id, title: a.title, slug: a.slug, publishedAt: a.publishedAt })),
      },
      execution: {
        // The scheduler runs every minute; an overdue item means it has not been published yet.
        overdueCount: overdue.length,
        lastRuns: runs.map((r) => ({ at: r.createdAt, ok: r.action === 'ARTICLE_SCHEDULED_PUBLISH_RESULT', details: r.details })),
        note: overdue.length ? `${overdue.length} artikel melewati jadwal dan belum terbit; periksa aturan AI dan hasil proses terakhir.` : null,
      },
      attention: {
        thresholds: { stalePublishedDays: STALE_PUBLISHED_DAYS, staleDraftDays: STALE_DRAFT_DAYS },
        stalePublished: withAge(stalePublished),
        staleDrafts: withAge(staleDrafts),
      },
    };
  }

  async checkLinks(id: number) {
    const article = await this.articles.findOne({ where: { id }, select: ['id', 'title', 'content', 'coverImage', 'ogImage', 'canonicalUrl'] });
    if (!article) throw new NotFoundException(`Article with ID ${id} not found`);
    return { articleId: id, title: article.title, checkedAt: new Date().toISOString(), ...(await this.links.check(article)) };
  }

  async performance(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    const range = { startDate: period.startDate, endDate: period.endDate };
    const articles = await this.articles.find({
      where: { status: 'published' },
      select: ['id', 'title', 'slug', 'publishedAt'],
      order: { publishedAt: 'DESC' },
      take: 200,
    });
    let ga4: any = { status: 'not_connected', missingConfiguration: this.ga4.connection().missing };
    let ga4Rows: any[] | null = null;
    if (!this.ga4.connection().missing.length) {
      try {
        const report = await this.ga4.customReport({
          ...range,
          dimensions: ['landingPage'],
          metrics: ['sessions', 'activeUsers', 'engagementRate', 'ecommercePurchases'],
          filters: [{ filter: { fieldName: 'landingPage', stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/' } } }],
          limit: 250,
          orderMetric: 'sessions',
        });
        ga4Rows = report.rows.map((r) => ({ page: r.dimensions.landingPage, sessions: r.metrics.sessions, activeUsers: r.metrics.activeUsers, engagementRate: r.metrics.engagementRate, purchases: r.metrics.ecommercePurchases }));
        ga4 = { status: 'ready' };
      } catch {
        ga4 = { status: 'error', message: 'Laporan GA4 artikel belum dapat dimuat.' };
      }
    }
    let search: any = { status: 'not_connected' };
    let gscRows: any[] | null = null;
    try {
      const gsc = await this.ga4.searchConsolePages(range);
      search = gsc.status === 'ready' ? { status: 'ready' } : { status: 'not_connected', missingConfiguration: gsc.missing };
      if (gsc.status === 'ready') gscRows = gsc.rows;
    } catch {
      search = { status: 'error', message: 'Data Search Console belum dapat dimuat. Pastikan akun layanan sudah menjadi pengguna properti.' };
    }
    return {
      period: { startDate: period.startDate, endDate: period.endDate, timezone: period.timezone },
      sources: { ga4, searchConsole: search },
      items: joinArticlePerformance(articles, ga4Rows, gscRows),
      definitions: {
        reader: 'Sesi dengan halaman masuk artikel ini (GA4). Users mengikuti definisi GA4.',
        conversion: 'Purchase pada sesi yang dimulai dari artikel ini; bukan bukti artikel menjadi satu-satunya penyebab. Traffic dan konversi dipisahkan.',
        search: 'Data Search Console tertunda 2-3 hari. Tanpa koneksi, kolom ditampilkan kosong, bukan nol.',
      },
    };
  }
}
