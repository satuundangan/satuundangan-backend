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
      const premiumCat = await this.categoryRepo.findOne({
        where: { name: 'Premium' },
      });
      const exclusiveCat = await this.categoryRepo.findOne({
        where: { name: 'Exclusive' },
      });

      const missingTemplates = [
        {
          slug: 'meowly-married',
          name: 'Meowly Married',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Bold & Unik',
          description:
            'Tema ceria dan menggemaskan untuk pasangan pecinta kucing',
          tags: JSON.stringify([
            'kucing',
            'cat',
            'cute',
            'pet lovers',
            'playful',
          ]),
          previewUrl: 'https://satuundangan.id/demo/meowly-married',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/meowly-married.png',
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
          tags: JSON.stringify([
            'pixel',
            'retro',
            'gaming',
            'rpg',
            '8-bit',
            'arcade',
          ]),
          previewUrl: 'https://satuundangan.id/demo/pixel-quest',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/pixel-quest.png',
          paletteColors: ['#3B82F6', '#10B981', '#F59E0B'],
          defaultMusic: 'wedding-retro-adventure.mp3',
          isPublished: true,
        },
        {
          slug: 'sunda-sabilulungan',
          componentKey: 'sunda-sabilulungan',
          name: 'Sabilulungan Sunda',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan bernuansa Priangan dengan palet hijau dan aksen floral kontemporer.',
          tags: JSON.stringify([
            'sunda',
            'priangan',
            'adat',
            'nusantara',
            'hijau',
          ]),
          previewUrl: 'https://satuundangan.id/demo/sunda-sabilulungan',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/sunda-sabilulungan.png',
          paletteColors: ['#315B48', '#F5F3E8', '#C98767'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Raka Pratama',
            brideName: 'Nadia Puspita',
            parents: {
              groomParents: 'Bapak Dedi dan Ibu Rina',
              brideParents: 'Bapak Asep dan Ibu Mira',
            },
            quoteText: 'Dua hati, satu langkah baru.',
            akadLocation: {
              dateTime: '2027-06-12T08:00:00+07:00',
              description: 'Gedung Pakuan, Bandung',
            },
            resepsiLocation: {
              dateTime: '2027-06-12T11:00:00+07:00',
              description: 'Gedung Pakuan, Bandung',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'jawa-truntum',
          componentKey: 'jawa-truntum',
          name: 'Truntum Pawiwahan',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Jawa bernuansa sogan dengan aksen motif Truntum yang tumbuh berulang.',
          tags: JSON.stringify([
            'jawa',
            'truntum',
            'batik',
            'adat',
            'nusantara',
          ]),
          previewUrl: 'https://satuundangan.id/demo/jawa-truntum',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/jawa-truntum.png',
          paletteColors: ['#61472F', '#EEE7D8', '#A75C45'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Bagas Wicaksono',
            brideName: 'Sekar Ayuningtyas',
            parents: {
              groomParents: 'Bapak Hadi dan Ibu Sari',
              brideParents: 'Bapak Bimo dan Ibu Ratih',
            },
            quoteText: 'Tresna tuwuh, katresnan langgeng.',
            akadLocation: {
              dateTime: '2027-08-21T08:00:00+07:00',
              description: 'Pendopo Agung, Yogyakarta',
            },
            resepsiLocation: {
              dateTime: '2027-08-21T11:00:00+07:00',
              description: 'Pendopo Agung, Yogyakarta',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'batak-ragi-hotang',
          componentKey: 'batak-ragi-hotang',
          name: 'Ragi Hotang Batak Toba',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Batak Toba dengan aksen tenun geometris dan palet marun, emas, serta biru tua.',
          tags: JSON.stringify([
            'batak',
            'toba',
            'ragi hotang',
            'ulos',
            'adat',
            'nusantara',
          ]),
          previewUrl: 'https://satuundangan.id/demo/batak-ragi-hotang',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/batak-ragi-hotang.png',
          paletteColors: ['#7D2D3E', '#17263A', '#D5AA5A'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Andreas Simanjuntak',
            brideName: 'Maria br. Siregar',
            parents: {
              groomParents: 'Bapak J. Simanjuntak dan Ibu R. boru Hutapea',
              brideParents: 'Bapak T. Siregar dan Ibu M. boru Situmorang',
            },
            quoteText:
              'Horas! Dengan penuh sukacita kami mengundang keluarga dan sahabat.',
            akadLocation: {
              dateTime: '2027-09-18T09:00:00+07:00',
              description: 'Sopo Marpingkir, Medan',
            },
            resepsiLocation: {
              dateTime: '2027-09-18T12:00:00+07:00',
              description: 'Sopo Marpingkir, Medan',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'dayak-ngaju-benang-bintik',
          componentKey: 'dayak-ngaju-benang-bintik',
          name: 'Benang Bintik Dayak Ngaju',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Dayak Ngaju dari Kalimantan Tengah dengan aksen geometris Benang Bintik.',
          tags: JSON.stringify([
            'dayak ngaju',
            'kalimantan tengah',
            'benang bintik',
            'adat',
            'nusantara',
          ]),
          previewUrl: 'https://satuundangan.id/demo/dayak-ngaju-benang-bintik',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/dayak-ngaju-benang-bintik.png',
          paletteColors: ['#153F40', '#F3E8D0', '#B94B3E'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Dimas Tumbang',
            brideName: 'Lestari Bawi',
            parents: {
              groomParents: 'Bapak Jaya dan Ibu Rina',
              brideParents: 'Bapak Rudi dan Ibu Sinta',
            },
            quoteText: 'Satu perjalanan, banyak doa.',
            akadLocation: {
              dateTime: '2027-10-09T09:00:00+07:00',
              description: 'Taman Budaya, Palangka Raya',
            },
            resepsiLocation: {
              dateTime: '2027-10-09T12:00:00+07:00',
              description: 'Taman Budaya, Palangka Raya',
            },
          }),
          isPublished: true,
        },
      ];

      for (const tpl of missingTemplates) {
        const existing = await this.templateRepo.findOne({
          where: { slug: tpl.slug },
        });
        if (!existing) {
          const created = this.templateRepo.create(tpl as any);
          await this.templateRepo.save(created);
        } else if (tpl.thumbnailUrl && existing.thumbnailUrl !== tpl.thumbnailUrl) {
          // Update stale/broken thumbnail URL
          await this.templateRepo.update(existing.id, {
            thumbnailUrl: tpl.thumbnailUrl,
          });
        }
      }

      // Ensure kimi-no-na-wa has valid thumbnail
      const kimi = await this.templateRepo.findOne({ where: { slug: 'kimi-no-na-wa' } });
      if (kimi && !kimi.thumbnailUrl) {
        await this.templateRepo.update(kimi.id, {
          thumbnailUrl: 'https://satuundangan.id/assets/templates/kimi-no-na-wa.png',
        });
      }

      // Re-align taxonomy so every filter group has 3+ templates (e.g. Modern Noir in Minimalis & Modern)
      const modernNoir = await this.templateRepo.findOne({
        where: { slug: 'modern-noir' },
      });
      if (modernNoir && modernNoir.filterGroup !== 'Minimalis & Modern') {
        await this.templateRepo.update(modernNoir.id, {
          filterGroup: 'Minimalis & Modern',
        });
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
