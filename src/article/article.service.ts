import { Injectable, NotFoundException } from '@nestjs/common';
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
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (q) {
      where.title = ILike(`%${q}%`);
    }

    const [items, total] = await this.articleRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip,
      take: limit,
      relations: ['author'],
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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

  async findAllPublished(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.articleRepository.findAndCount({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
      skip,
      take: limit,
      relations: ['author'],
    });

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
