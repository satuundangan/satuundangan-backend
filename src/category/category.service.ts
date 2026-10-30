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

  async findAll(query: PaginationQueryDto = {}) {
    const { page = 1, limit = 20, q } = query;
    const where = q ? { name: ILike(`%${q}%`) } : undefined;

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

  async findOne(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.categoryRepo.findOne({
      where: { name: dto.name },
    });
    if (existing)
      throw new BadRequestException('Category with this name already exists');
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);
    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepo.findOne({
        where: { name: dto.name },
      });
      if (existing)
        throw new BadRequestException('Category with this name already exists');
    }
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
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
    return this.categoryRepo.findOne({ where: { name } });
  }
}
