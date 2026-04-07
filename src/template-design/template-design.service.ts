import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateDesign } from './template-design.entity';

@Injectable()
export class TemplateDesignService {
  constructor(
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
  ) {}

  async create(data: Partial<TemplateDesign>): Promise<TemplateDesign> {
    if (typeof data.sectionOptions === 'object') {
      data.sectionOptions = JSON.stringify(data.sectionOptions);
    }

    if (Array.isArray(data.tags)) {
      data.tags = JSON.stringify(data.tags);
    }

    const template = this.templateRepo.create(data);
    const saved = await this.templateRepo.save(template);
    return this.transformPalette(saved);
  }

  async findAll(): Promise<TemplateDesign[]> {
    const templates = await this.templateRepo.find({
      order: { name: 'ASC' },
      relations: ['category', 'sections', 'sections.section'],
    });
    return templates.map((t) => this.transformPalette(t));
  }

  async findById(id: number): Promise<TemplateDesign> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['category', 'sections', 'sections.section'],
    });
    if (!template) throw new NotFoundException('Template not found');
    return this.transformPalette(template);
  }

  async update(
    id: number,
    data: Partial<TemplateDesign>,
  ): Promise<TemplateDesign> {
    const dataToUpdate = { ...data };
    if (dataToUpdate.tags && Array.isArray(dataToUpdate.tags)) {
      dataToUpdate.tags = (dataToUpdate.tags as string[]).join(', ');
    }

    await this.templateRepo.update(id, dataToUpdate);

    const updatedTemplate = await this.findById(id);
    return updatedTemplate;
  }

  async remove(id: number): Promise<void> {
    const template = await this.findById(id);
    await this.templateRepo.remove(template);
  }

  async findByCategory(category?: string): Promise<TemplateDesign[]> {
    const where: any = {};
    if (category && category !== 'semua') {
      where.category = { name: category };
    }
    const templates = await this.templateRepo.find({
      where,
      relations: ['category', 'sections', 'sections.section'],
    });

    return templates.map((t) => this.transformPalette(t));
  }

  private transformPalette(template: TemplateDesign): TemplateDesign {
    const result = { ...template } as any;

    if (typeof template.tags === 'string') {
      try {
        result.tags = JSON.parse(template.tags) as string;
      } catch (err: any) {
        // Fallback if not JSON
      }
    }

    if (template.category && typeof template.category === 'object') {
      result.category = template.category.name;
    }

    if (template.sections) {
      result.sections = template.sections
        .sort((a, b) => a.order - b.order)
        .map((ts) => ({
          id: ts.section.id,
          key: ts.section.key,
          label: ts.section.label,
          order: ts.order,
          is_enabled: ts.is_enabled,
        }));
    }

    return result;
  }

  private async getAllTemplateDesigns(): Promise<TemplateDesign[]> {
    const templates = await this.templateRepo.find();
    return templates.map((t) => this.transformPalette(t));
  }
}
