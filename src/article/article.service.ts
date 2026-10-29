import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, LessThan, LessThanOrEqual } from 'typeorm';
import { Article } from './article.entity';
import { User } from '../user/user.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import slugify from 'slugify';
import { randomUUID } from 'node:crypto';
import { RestoreArticleRevisionDto } from './dto/restore-article-revision.dto';

const CONTENT_FIELDS = ['title', 'slug', 'content', 'excerpt', 'coverImage', 'metaTitle', 'metaDescription', 'focusKeyword', 'ogImage', 'canonicalUrl', 'status', 'generatedByAi', 'sourceUrls', 'reviewNotes'] as const;
const REVIEW_FIELDS = ['title', 'content', 'excerpt', 'sourceUrls'] as const;

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    q?: string,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    filters?: string,
  ) {
    page =
      Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    limit =
      Number.isInteger(Number(limit)) && Number(limit) > 0
        ? Math.min(Number(limit), 100)
        : 20;
    const skip = (page - 1) * limit;
    const searchWhere: any = {};
    if (q?.trim()) {
      searchWhere.title = ILike(`%${q.trim()}%`);
    }

    let status: string | undefined;
    if (filters) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(filters);
      } catch {
        throw new BadRequestException('Filter artikel tidak valid.');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('Filter artikel harus berupa objek.');
      }
      const requestedStatus = (parsed as { status?: unknown }).status;
      if (requestedStatus !== undefined && requestedStatus !== 'all') {
        if (requestedStatus !== 'published' && requestedStatus !== 'draft' && requestedStatus !== 'scheduled') {
          throw new BadRequestException('Status artikel tidak valid.');
        }
        status = requestedStatus;
      }
      const staleDays = (parsed as { staleDays?: unknown }).staleDays;
      if (staleDays !== undefined) {
        if (!Number.isInteger(staleDays) || Number(staleDays) < 1 || Number(staleDays) > 730) throw new BadRequestException('Batas usia artikel tidak valid.');
        searchWhere.updatedAt = LessThan(new Date(Date.now() - Number(staleDays) * 86_400_000));
      }
    }

    const allowedSortFields = [
      'id',
      'title',
      'status',
      'createdAt',
      'updatedAt',
      'publishedAt',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const where = status ? { ...searchWhere, status } : searchWhere;

    const [items, total] = await this.articleRepository.findAndCount({
      where,
      order: { [safeSortBy]: sortOrder === 'ASC' ? 'ASC' : 'DESC' },
      skip,
      take: limit,
      relations: ['author'],
    });

    const [all, published, draft, scheduled] = await Promise.all([
      this.articleRepository.count({ where: searchWhere }),
      this.articleRepository.count({
        where: { ...searchWhere, status: 'published' },
      }),
      this.articleRepository.count({
        where: { ...searchWhere, status: 'draft' },
      }),
      this.articleRepository.count({ where: { ...searchWhere, status: 'scheduled' } }),
    ]);

    return {
      items: items.map((article) => this.serializeArticle(article)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: { all, published, draft, scheduled },
    };
  }

  async findOne(id: number) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }
    return this.serializeArticle(article);
  }

  async create(createArticleDto: CreateArticleDto, authorId: number) {
    const data: Partial<Article> = this.prepareEditorialData(createArticleDto, null, authorId);
    const article = this.articleRepository.create({
      ...data,
      authorId,
      editVersion: 1,
    });

    let slugToUse = createArticleDto.slug;
    if (!slugToUse) {
      slugToUse = slugify(createArticleDto.title, {
        lower: true,
        strict: true,
      });
    }

    article.slug = await this.generateUniqueSlug(slugToUse);

    if (article.status === 'published' && !article.publishedAt) {
      article.publishedAt = new Date();
    }

    return this.serializeArticle(await this.articleRepository.save(article));
  }

  async update(id: number, updateArticleDto: UpdateArticleDto, actorId?: number, forceReviewReset = false) {
    const article = await this.findEditable(id);
    const version = article.editVersion || 1;
    if (updateArticleDto.expectedVersion !== undefined && updateArticleDto.expectedVersion !== version) {
      throw new ConflictException('Artikel sudah diperbarui admin lain. Muat ulang sebelum menyimpan; draft perangkat Anda tetap tersedia.');
    }
    const changes = this.prepareEditorialData(updateArticleDto, article, actorId, forceReviewReset);

    let newSlug = updateArticleDto.slug;
    if (
      updateArticleDto.title &&
      updateArticleDto.title !== article.title &&
      !updateArticleDto.slug
    ) {
      newSlug = slugify(updateArticleDto.title, {
        lower: true,
        strict: true,
      });
    }

    if (newSlug && newSlug !== article.slug) {
      changes.slug = await this.generateUniqueSlug(newSlug, id);
    }

    if (
      updateArticleDto.status === 'published' &&
      article.status !== 'published' &&
      !article.publishedAt
    ) {
      changes.publishedAt = new Date();
    }

    const revision = {
      id: randomUUID(), savedAt: new Date().toISOString(), savedByUserId: actorId || null,
      reason: updateArticleDto.revisionReason?.trim() || null,
      snapshot: Object.fromEntries([...CONTENT_FIELDS, 'scheduledPublishAt', 'authorId'].map((field) => [field, article[field]])),
    };
    const result = await this.articleRepository.update({ id, editVersion: version }, {
      ...changes,
      editVersion: version + 1,
      revisionHistory: [...(article.revisionHistory || []), revision].slice(-10),
    });
    if (result.affected !== 1) throw new ConflictException('Artikel berubah saat penyimpanan. Muat ulang dan periksa draft perangkat Anda.');
    return this.findOne(id);
  }

  private async findEditable(id: number) {
    const article = await this.articleRepository.findOne({
      where: { id },
      select: ['id', ...CONTENT_FIELDS, 'editVersion', 'revisionHistory', 'reviewedAt', 'reviewedByUserId', 'scheduledPublishAt', 'publishedAt', 'authorId', 'createdAt', 'updatedAt'],
    });
    if (!article) throw new NotFoundException(`Article with ID ${id} not found`);
    return article;
  }

  private serializeArticle(article: Article) {
    if (!article) return article;
    const { revisionHistory: _privateHistory, ...safe } = article;
    if (article.author) safe.author = { id: article.author.id, name: article.author.name, avatar: article.author.avatar } as User;
    return safe;
  }

  private prepareEditorialData(dto: UpdateArticleDto, previous: Article | null, actorId?: number, forceReviewReset = false): any {
    const next: any = { ...(previous || {}), ...Object.fromEntries(CONTENT_FIELDS.filter((field) => dto[field] !== undefined).map((field) => [field, dto[field]])) };
    next.status = next.status || 'draft';
    next.generatedByAi = Boolean(previous?.generatedByAi || next.generatedByAi);
    next.sourceUrls = Array.isArray(next.sourceUrls) ? [...new Set(next.sourceUrls.map((url: string) => url.trim()).filter(Boolean))] : [];
    for (const value of next.sourceUrls) {
      try { if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error(); }
      catch { throw new BadRequestException('Referensi sumber harus berupa URL http atau https.'); }
    }
    const contentChanged = Boolean(previous) && REVIEW_FIELDS.some((field) => dto[field] !== undefined && JSON.stringify(dto[field]) !== JSON.stringify(previous?.[field]));
    let reviewedAt = forceReviewReset || contentChanged ? null : previous?.reviewedAt || null;
    let reviewedByUserId = forceReviewReset || contentChanged ? null : previous?.reviewedByUserId || null;
    if (dto.editorialReviewed && !forceReviewReset) {
      if (!actorId) throw new BadRequestException('Identitas admin peninjau tidak tersedia.');
      reviewedAt = new Date();
      reviewedByUserId = actorId;
    }
    if (next.generatedByAi && ['published', 'scheduled'].includes(next.status) && (!reviewedAt || !reviewedByUserId || !next.sourceUrls.length)) {
      throw new BadRequestException('Artikel AI memerlukan sumber referensi dan tinjauan editorial sebelum diterbitkan atau dijadwalkan.');
    }
    let scheduledPublishAt: Date | null = null;
    if (next.status === 'scheduled') {
      const raw = dto.scheduledPublishAt ?? previous?.scheduledPublishAt?.toISOString();
      if (typeof raw !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw)) || Date.parse(raw) <= Date.now()) throw new BadRequestException('Jadwal harus berada di masa depan dan mencantumkan zona waktu.');
      scheduledPublishAt = new Date(raw);
    }
    return { ...Object.fromEntries(CONTENT_FIELDS.filter((field) => next[field] !== undefined).map((field) => [field, next[field]])), reviewedAt, reviewedByUserId, scheduledPublishAt };
  }

  async listRevisions(id: number) {
    const article = await this.findEditable(id);
    return { editVersion: article.editVersion, retainedLimit: 10, items: (article.revisionHistory || []).slice().reverse().map(({ snapshot, ...revision }) => ({ ...revision, title: snapshot.title, status: snapshot.status })) };
  }

  async resolveAuthorId(preferredId?: number) {
    const author = await this.userRepository.findOne({
      where: preferredId ? { id: preferredId, isAdmin: true } : { isAdmin: true },
      select: { id: true }, order: { id: 'ASC' },
    });
    if (!author) throw new BadRequestException('Penulis admin belum tersedia untuk draft AI.');
    return author.id;
  }

  async getRevision(id: number, revisionId: string) {
    const article = await this.findEditable(id);
    const revision = article.revisionHistory?.find((item) => item.id === revisionId);
    if (!revision) throw new NotFoundException('Versi artikel tidak ditemukan atau sudah melewati batas penyimpanan.');
    return revision;
  }

  async restoreRevision(id: number, revisionId: string, dto: RestoreArticleRevisionDto, actorId?: number) {
    const revision = await this.getRevision(id, revisionId);
    return this.update(id, { ...revision.snapshot, status: 'draft', scheduledPublishAt: null, editorialReviewed: false, expectedVersion: dto.expectedVersion, revisionReason: dto.revisionReason || `Pulihkan versi ${revisionId}` }, actorId, true);
  }

  async publishScheduledArticles(now = new Date()) {
    const due = await this.articleRepository.find({ where: { status: 'scheduled', scheduledPublishAt: LessThanOrEqual(now) }, order: { scheduledPublishAt: 'ASC' }, take: 100 });
    const result = { considered: due.length, published: 0, skipped: 0, failed: [] as { articleId: number; message: string }[] };
    for (const article of due) {
      try {
        await this.update(article.id, { status: 'published', expectedVersion: article.editVersion, revisionReason: 'Penerbitan terjadwal' });
        result.published++;
      } catch (error) {
        if (error instanceof ConflictException) result.skipped++;
        else result.failed.push({ articleId: article.id, message: error instanceof BadRequestException ? error.message : 'Penerbitan terjadwal gagal.' });
      }
    }
    return result;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.articleRepository.delete(id);
  }

  async findBySlug(slug: string) {
    const article = await this.articleRepository.findOne({
      where: { slug, status: 'published' },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }
    return this.serializeArticle(article);
  }

  async findAllPublished(page: number = 1, limit: number = 20, q?: string) {
    const skip = (page - 1) * limit;

    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .where("article.status = 'published'");

    if (q && q.trim()) {
      qb.andWhere(
        '(article.title LIKE :q OR article.excerpt LIKE :q OR article.content LIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }

    qb.orderBy('article.publishedAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((article) => this.serializeArticle(article)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: number,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
      const qb = this.articleRepository
        .createQueryBuilder('article')
        .where('article.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('article.id != :id', { id: excludeId });
      }

      const existing = await qb.getOne();
      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
