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

    if (data.sampleContent && typeof data.sampleContent === 'object') {
      data.sampleContent = JSON.stringify(data.sampleContent) as any;
    }

    if (data.designConfig && typeof data.designConfig === 'object') {
      data.designConfig = JSON.stringify(data.designConfig) as any;
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
      where: { isPublished: true },
      order: { name: 'ASC' },
      relations: ['category', 'palette', 'sections', 'sections.section'],
    });
    return templates.map((t) => this.transformPalette(t));
  }

  async findById(id: number): Promise<TemplateDesign> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['category', 'palette', 'sections', 'sections.section'],
    });
    if (!template) throw new NotFoundException('Template not found');
    return this.transformPalette(template);
  }

  async findBySlug(slug: string): Promise<TemplateDesign> {
    const template = await this.templateRepo.findOne({
      where: { slug },
      relations: ['category', 'palette', 'sections', 'sections.section'],
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

    if (
      dataToUpdate.sectionOptions &&
      typeof dataToUpdate.sectionOptions === 'object'
    ) {
      dataToUpdate.sectionOptions = JSON.stringify(dataToUpdate.sectionOptions);
    }

    if (
      dataToUpdate.sampleContent &&
      typeof dataToUpdate.sampleContent === 'object'
    ) {
      dataToUpdate.sampleContent = JSON.stringify(
        dataToUpdate.sampleContent,
      ) as any;
    }

    if (
      dataToUpdate.designConfig &&
      typeof dataToUpdate.designConfig === 'object'
    ) {
      dataToUpdate.designConfig = JSON.stringify(
        dataToUpdate.designConfig,
      ) as any;
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
    const where: any = { isPublished: true };
    if (category && category !== 'semua') {
      where.category = { name: category };
    }
    const templates = await this.templateRepo.find({
      where,
      relations: ['category', 'palette', 'sections', 'sections.section'],
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

    if (typeof template.sampleContent === 'string') {
      try {
        result.sampleContent = JSON.parse(template.sampleContent);
      } catch (err: any) {
        // Fallback if not JSON — leave as-is
      }
    }

    if (typeof template.designConfig === 'string') {
      try {
        result.designConfig = JSON.parse(template.designConfig);
      } catch (err: any) {
        // Fallback if not JSON — leave as-is
      }
    }

    if (template.category && typeof template.category === 'object') {
      result.category = template.category.name;
    }

    if (template.palette && typeof template.palette === 'object') {
      result.paletteColors = [
        template.palette.primary,
        template.palette.secondary,
        template.palette.accent,
      ];
    } else if (template.paletteColors) {
      result.paletteColors = template.paletteColors;
    } else {
      result.paletteColors = [];
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
