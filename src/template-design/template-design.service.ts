import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateDesign } from './template-design.entity';
import { Category } from '../category/category.entity';

@Injectable()
export class TemplateDesignService implements OnModuleInit {
  constructor(
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async onModuleInit() {
    await this.seedMissingTemplatesAndSyncTaxonomy();
  }

  async seedMissingTemplatesAndSyncTaxonomy() {
    try {
      const premiumCat = await this.categoryRepo.findOne({ where: { name: 'Premium' } });
      const exclusiveCat = await this.categoryRepo.findOne({ where: { name: 'Exclusive' } });

      const missingTemplates = [
        {
          slug: 'meowly-married',
          name: 'Meowly Married',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Bold & Unik',
          description: 'Tema ceria dan menggemaskan untuk pasangan pecinta kucing',
          tags: JSON.stringify(['kucing', 'cat', 'cute', 'pet lovers', 'playful']),
          previewUrl: 'https://satuundangan.id/demo/meowly-married',
          thumbnailUrl: 'https://cdn.satuundangan.id/templates/meowly-married.jpg',
          paletteColors: ['#FFB5A7', '#FCD5CE', '#F8EDEB'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          isPublished: true,
        },
        {
          slug: 'pixel-quest',
          name: 'Pixel Quest',
          category: exclusiveCat,
          price: 99000,
          filterGroup: 'Anime & Pop Culture',
          description: 'Tema retro game 8-bit RPG petualangan cinta sejati',
          tags: JSON.stringify(['pixel', 'retro', 'gaming', 'rpg', '8-bit', 'arcade']),
          previewUrl: 'https://satuundangan.id/demo/pixel-quest',
          thumbnailUrl: 'https://cdn.satuundangan.id/templates/pixel-quest.jpg',
          paletteColors: ['#3B82F6', '#10B981', '#F59E0B'],
          defaultMusic: 'wedding-retro-adventure.mp3',
          isPublished: true,
        },
      ];

      for (const tpl of missingTemplates) {
        const existing = await this.templateRepo.findOne({ where: { slug: tpl.slug } });
        if (!existing) {
          const created = this.templateRepo.create(tpl as any);
          await this.templateRepo.save(created);
        }
      }

      // Re-align taxonomy so every filter group has 3+ templates (e.g. Modern Noir in Minimalis & Modern)
      const modernNoir = await this.templateRepo.findOne({ where: { slug: 'modern-noir' } });
      if (modernNoir && modernNoir.filterGroup !== 'Minimalis & Modern') {
        await this.templateRepo.update(modernNoir.id, { filterGroup: 'Minimalis & Modern' });
      }
    } catch (err: any) {
      console.warn('Template taxonomy auto-sync warning:', err?.message || err);
    }
  }

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
