import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Article } from './article.entity';
import { User } from '../user/user.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import slugify from 'slugify';

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
        if (requestedStatus !== 'published' && requestedStatus !== 'draft') {
          throw new BadRequestException('Status artikel tidak valid.');
        }
        status = requestedStatus;
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

    const [all, published, draft] = await Promise.all([
      this.articleRepository.count({ where: searchWhere }),
      this.articleRepository.count({
        where: { ...searchWhere, status: 'published' },
      }),
      this.articleRepository.count({
        where: { ...searchWhere, status: 'draft' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: { all, published, draft },
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
    return article;
  }

  async create(createArticleDto: CreateArticleDto, authorId: number) {
    const article = this.articleRepository.create({
      ...createArticleDto,
      authorId,
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

    return this.articleRepository.save(article);
  }

  async update(id: number, updateArticleDto: UpdateArticleDto) {
    const article = await this.findOne(id);

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
      article.slug = await this.generateUniqueSlug(newSlug, id);
    }

    if (
      updateArticleDto.status === 'published' &&
      article.status !== 'published' &&
      !article.publishedAt
    ) {
      article.publishedAt = new Date();
    }

    Object.assign(article, updateArticleDto);

    return this.articleRepository.save(article);
  }

  async remove(id: number) {
    const article = await this.findOne(id);
    await this.articleRepository.remove(article);
  }

  async findBySlug(slug: string) {
    const article = await this.articleRepository.findOne({
      where: { slug, status: 'published' },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }
    return article;
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
      items,
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
