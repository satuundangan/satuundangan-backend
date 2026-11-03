import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';
import { TemplateDesign } from '../template-design/template-design.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
  ) {}

  async findAll(query: PaginationQueryDto = {}, includeInactive = false) {
    const { page = 1, limit = 20, q } = query;
    const normalizedQuery = q?.trim().replace(/\s+/gu, ' ');
    const activeFilter = includeInactive ? {} : { isActive: true };
    const where = normalizedQuery
      ? [{ name: ILike(`%${normalizedQuery}%`), ...activeFilter }]
      : includeInactive
        ? undefined
        : activeFilter;

    const [data, total] = await this.categoryRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const enriched = await Promise.all(
      data.map(async (category) => {
        const [templateCount, activeTemplateCount, invitationResult] =
          await Promise.all([
            this.templateRepo.count({
              where: { category: { id: category.id } },
            }),
            this.templateRepo.count({
              where: { category: { id: category.id }, isPublished: true },
            }),
            this.templateRepo
              .createQueryBuilder('template')
              .leftJoin('template.category', 'category')
              .leftJoin('template.invitations', 'invitation')
              .select('COUNT(DISTINCT invitation.id)', 'count')
              .where('category.id = :categoryId', {
                categoryId: category.id,
              })
              .getRawOne(),
          ]);
        return {
          ...category,
          templateCount,
          activeTemplateCount,
          invitationCount: Number(invitationResult?.count || 0),
        };
      }),
    );

    return { data: enriched, total, page, limit };
  }

  async findOne(id: string, includeInactive = false) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category || (!includeInactive && category.isActive === false)) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const name = this.normalizeName(dto.name);
    if (await this.findNameConflict(name)) {
      throw new BadRequestException('Kategori dengan nama ini sudah ada.');
    }
    const category = this.categoryRepo.create({
      ...dto,
      name,
      aliases: [],
      isActive: dto.isActive ?? true,
    });
    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id, true);
    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);
      if (name !== category.name && (await this.findNameConflict(name, id))) {
        throw new BadRequestException('Kategori dengan nama ini sudah ada.');
      }
      if (name !== category.name) {
        category.aliases = Array.from(
          new Set([...(category.aliases || []), category.name]),
        );
      }
      category.name = name;
    }
    if (dto.color !== undefined) category.color = dto.color;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    return this.categoryRepo.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id, true);
    const templateCount = await this.templateRepo.count({
      where: { category: { id } },
    });
    if (templateCount > 0) {
      throw new BadRequestException(
        `Kategori masih dipakai ${templateCount} template. Pindahkan template sebelum menghapus kategori.`,
      );
    }
    return this.categoryRepo.remove(category);
  }

  async findByName(name: string) {
    const normalizedName = this.normalizeName(name);
    return this.categoryRepo
      .createQueryBuilder('category')
      .where('LOWER(TRIM(category.name)) = LOWER(:name)', {
        name: normalizedName,
      })
      .orWhere('JSON_CONTAINS(category.aliases, :nameJson)', {
        nameJson: JSON.stringify(normalizedName),
      })
      .getOne();
  }

  private normalizeName(value: string) {
    return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  }

  private findNameConflict(name: string, excludeId?: string) {
    const query = this.categoryRepo
      .createQueryBuilder('category')
      .where(
        '(LOWER(TRIM(category.name)) = LOWER(:name) OR JSON_CONTAINS(category.aliases, :nameJson))',
        { name, nameJson: JSON.stringify(name) },
      );
    if (excludeId) query.andWhere('category.id <> :excludeId', { excludeId });
    return query.getOne();
  }
}
