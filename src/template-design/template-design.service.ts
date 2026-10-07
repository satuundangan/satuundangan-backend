import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateDesign } from './template-design.entity';
import { TemplateDesignSection } from './template-design-section.entity';
import { Section } from '../admin/entities/section.entity';
import { Category } from '../category/category.entity';

@Injectable()
export class TemplateDesignService implements OnModuleInit {
  constructor(
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(TemplateDesignSection)
    private readonly templateSectionRepo: Repository<TemplateDesignSection>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
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
            'Tema pastel manis bertema feline playful dengan ilustrasi kucing menggemaskan. Pilihan tepat bagi pasangan cat lovers yang menginginkan suasana hangat, santai, dan penuh keceriaan.',
          tags: JSON.stringify([
            'kucing',
            'cat',
            'cute',
            'pet lovers',
            'playful',
            'pastel',
            'intimate',
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
          description:
            'Konsep retro arcade 8-bit RPG pixel art yang interaktif dan unik. Dirancang khusus bagi pasangan gamer yang merayakan petualangan cinta sejati layaknya misi epik seumur hidup.',
          tags: JSON.stringify([
            'pixel',
            'retro',
            'gaming',
            'rpg',
            '8-bit',
            'arcade',
            'gamer',
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
            'Undangan Adat Sunda bernuansa Parahyangan agung dengan mahkota Siger kencana, ronce melati, serta palet hijau zamrud botol dan emas priangan yang anggun.',
          tags: JSON.stringify([
            'sunda',
            'priangan',
            'siger',
            'adat',
            'nusantara',
            'hijau botol',
            'melati',
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
            'Undangan Adat Jawa klasik bernuansa keraton dengan filosofi Batik Truntum (cinta yang selalu bersemi kembali), siluet Gunungan Wayang kencana, dan palet cokelat sogan hangat.',
          tags: JSON.stringify([
            'jawa',
            'truntum',
            'batik',
            'gunungan',
            'wayang',
            'adat',
            'nusantara',
            'sogan',
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
            'Undangan Adat Batak Toba megah berhias ukiran Gorga Batak dan filosofi tenun Ulos Ragi Hotang (ikatan tali kasih tak terputus) dalam balutan merah marun, emas, dan midnight blue.',
          tags: JSON.stringify([
            'batak',
            'toba',
            'ragi hotang',
            'ulos',
            'gorga',
            'adat',
            'nusantara',
            'marun',
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
            'Undangan Adat Dayak Ngaju khas Kalimantan Tengah dengan motif sakral Benang Bintik Batang Garing (Pohon Kehidupan) dan perisai Talawang dalam keindahan zamrud hutan hujan serta emas.',
          tags: JSON.stringify([
            'dayak ngaju',
            'kalimantan tengah',
            'benang bintik',
            'talawang',
            'batang garing',
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
        {
          slug: 'strawberry-matcha',
          componentKey: 'strawberry-matcha',
          name: 'Strawberry Matcha',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Romantis & Dreamy',
          description:
            'Harmoni manis strawberry blush dan ketenangan matcha cream berestetika cafe Korea modern. Dipercantik kelopak bunga strawberry & daun teh melayang yang aesthetic.',
          tags: JSON.stringify([
            'strawberry matcha',
            'korean aesthetic',
            'pastel',
            'green',
            'pink',
            'garden',
            'intimate',
          ]),
          previewUrl: 'https://satuundangan.id/demo/strawberry-matcha',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/strawberry-matcha.png',
          paletteColors: ['#3E5142', '#FAF7F2', '#D96B7D'],
          defaultMusic: 'romantic_music1.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Romeo Monty',
            brideName: 'Juliet Capulet',
            parents: {
              groomParents: 'Bapak Monty & Ibu Monty',
              brideParents: 'Bapak Capulet & Ibu Capulet',
            },
            quoteText:
              'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri...',
            quoteSource: 'Ar-Rum: 21',
            akadLocation: {
              dateTime: '2026-10-24T08:00:00+07:00',
              description: 'Masjid Agung Al-Barkah, Bandung',
            },
            resepsiLocation: {
              dateTime: '2026-10-24T11:00:00+07:00',
              description: 'The Glass House Garden, Bandung',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'minang-suntiang-emas',
          componentKey: 'minang-suntiang-emas',
          name: 'Suntiang Emas Minangkabau',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Adat Minangkabau dengan siluet atap gonjong Rumah Gadang, ornamen mahkota Suntiang Emas, dan motif songket Pandai Sikek.',
          tags: JSON.stringify([
            'minangkabau',
            'padang',
            'suntiang',
            'rumah gadang',
            'adat',
            'nusantara',
            'marapulai',
            'anak daro',
          ]),
          previewUrl: 'https://satuundangan.id/demo/minang-suntiang-emas',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/minang-suntiang-emas.png',
          paletteColors: ['#4A0E17', '#D4AF37', '#1A0508'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Rian Syahputra',
            brideName: 'Aisyah Putri Minang',
            parents: {
              groomParents: 'Bpk. H. Syahputra & Ibu Hj. Ratna',
              brideParents: 'Bpk. Dt. Bandaro Basa & Ibu Hj. Nurhayati',
            },
            quoteText:
              'Anak urang koto anau, pai ka pakan mambawo lado. Hati sanang badan marasai, kasiah tibo kasio tando.',
            quoteSource: 'Petatah Petitih Minang / QS. Ar-Rum: 21',
            akadLocation: {
              dateTime: '2027-04-10T08:30:00+07:00',
              description: 'Masjid Raya Sumatera Barat, Padang',
            },
            resepsiLocation: {
              dateTime: '2027-04-10T11:00:00+07:00',
              description: 'Grand Basko Hotel & Convention Hall, Padang',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'bugis-saoraja',
          componentKey: 'bugis-saoraja',
          name: 'Saoraja Bugis Makassar',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Adat Bugis-Makassar bernuansa kemegahan Saoraja Balla Lompoa dengan tenun sutra Sarung Sabbe dan palet hijau zamrud emas.',
          tags: JSON.stringify([
            'bugis',
            'makassar',
            'saoraja',
            'baju bodo',
            'adat',
            'nusantara',
            'sulawesi',
            'sarung sabbe',
          ]),
          previewUrl: 'https://satuundangan.id/demo/bugis-saoraja',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/bugis-saoraja.png',
          paletteColors: ['#0F291E', '#D4AF37', '#681423'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'Andi Muhammad Fajar',
            brideName: 'Andi Tenri Bau',
            parents: {
              groomParents: 'Andi Fajar Bau & Andi Fatimah',
              brideParents: 'Andi Mallombassi & Andi Ratnawati',
            },
            quoteText:
              'Sipakatau, Sipakalebbi, Sipakainge. Menjaga harkat, memuliakan cinta dalam ikatan suci pernikahan.',
            quoteSource: 'Falsafah Bugis / QS. Ar-Rum: 21',
            akadLocation: {
              dateTime: '2027-05-15T09:00:00+08:00',
              description: 'Masjid 99 Kubah Asmaul Husna, Makassar',
            },
            resepsiLocation: {
              dateTime: '2027-05-15T12:00:00+08:00',
              description: 'Upperhills Convention Hall, Makassar',
            },
          }),
          isPublished: true,
        },
        {
          slug: 'bali-payas-agung',
          componentKey: 'bali-payas-agung',
          name: 'Payas Agung Bali Heritage',
          category: premiumCat,
          price: 79000,
          filterGroup: 'Adat & Budaya',
          description:
            'Undangan Pawiwahan Adat Bali dengan ukiran Kori Agung, motif Patra Samblung, kelopak Bunga Jepun, dan palet terracotta emas sakral.',
          tags: JSON.stringify([
            'bali',
            'payas agung',
            'pawiwahan',
            'kori agung',
            'adat',
            'nusantara',
            'hindu',
            'bunga jepun',
          ]),
          previewUrl: 'https://satuundangan.id/demo/bali-payas-agung',
          thumbnailUrl:
            'https://satuundangan.id/assets/templates/bali-payas-agung.png',
          paletteColors: ['#2C1810', '#DFB15B', '#180E0A'],
          defaultMusic: 'wedding-acoustic-cheerful.mp3',
          sampleContent: JSON.stringify({
            groomName: 'I Putu Arya Danendra',
            brideName: 'Ni Kadek Ayu Saraswati',
            parents: {
              groomParents: 'I Wayan Danendra & Ni Made Murni',
              brideParents: 'I Ketut Saraswati & Ni Nyoman Sukarni',
            },
            quoteText:
              'Ihaiva stam ma vi yaustam visvam ayur vyasnutam kridantau putrair naptrbhih modamanau sve grhe.',
            quoteSource: 'Rgveda X.85.42 / Pawiwahan Yadnya',
            akadLocation: {
              dateTime: '2027-06-20T09:00:00+08:00',
              description: 'Griya Agung Sanur, Denpasar, Bali',
            },
            resepsiLocation: {
              dateTime: '2027-06-20T12:00:00+08:00',
              description: 'Taman Bhagawan Beachfront, Nusa Dua, Bali',
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
        } else {
          const updates: Partial<TemplateDesign> = {};
          if (tpl.description && existing.description !== tpl.description) {
            updates.description = tpl.description;
          }
          if (tpl.tags && existing.tags !== tpl.tags) {
            updates.tags = tpl.tags;
          }
          if (tpl.thumbnailUrl && existing.thumbnailUrl !== tpl.thumbnailUrl) {
            updates.thumbnailUrl = tpl.thumbnailUrl;
          }
          if (Object.keys(updates).length > 0) {
            await this.templateRepo.update(existing.id, updates);
          }
        }
      }

      // Auto-populate default sections for templates that have 0 sections
      const allMasterSections = await this.sectionRepo.find({
        where: { is_active: true },
      });
      if (allMasterSections.length > 0) {
        const allTemplates = await this.templateRepo.find({
          relations: ['sections'],
        });
        for (const tpl of allTemplates) {
          if (!tpl.sections || tpl.sections.length === 0) {
            let order = 1;
            const newSections = allMasterSections.map((sec) =>
              this.templateSectionRepo.create({
                templateDesign: tpl,
                section: sec,
                is_enabled: true,
                order: order++,
              }),
            );
            await this.templateSectionRepo.save(newSections);
          }
        }
      }

      // Sync official template screenshots to database rows
      const OFFICIAL_THUMBNAILS: Record<string, string> = {
        'azure-shores': 'https://satuundangan.id/assets/templates/azure-shores.png',
        'batak-ragi-hotang': 'https://satuundangan.id/assets/templates/batak-ragi-hotang.png',
        'botanical-watercolor': 'https://satuundangan.id/assets/templates/botanical-watercolor.png',
        'celestial-sparkle': 'https://satuundangan.id/assets/templates/celestial-sparkle.png',
        'cyberpunk-neon': 'https://satuundangan.id/assets/templates/cyberpunk-neon.png',
        'dark-elegant': 'https://satuundangan.id/assets/templates/dark-elegant.png',
        'dayak-ngaju-benang-bintik': 'https://satuundangan.id/assets/templates/dayak-ngaju-benang-bintik.png',
        'editorial-magazine': 'https://satuundangan.id/assets/templates/editorial-magazine.png',
        'jawa-truntum': 'https://satuundangan.id/assets/templates/jawa-truntum.png',
        'kimi-no-na-wa': 'https://satuundangan.id/assets/templates/kimi-no-na-wa.png',
        'light-modern': 'https://satuundangan.id/assets/templates/light-modern.png',
        'meowly-married': 'https://satuundangan.id/assets/templates/meowly-married.png',
        'minimalist-terra': 'https://satuundangan.id/assets/templates/minimalist-terra.png',
        'modern-noir': 'https://satuundangan.id/assets/templates/modern-noir.png',
        'naruto': 'https://satuundangan.id/assets/templates/naruto.png',
        'one-piece': 'https://satuundangan.id/assets/templates/one-piece.png',
        'pixel-quest': 'https://satuundangan.id/assets/templates/pixel-quest.png',
        'retro-nostalgia': 'https://satuundangan.id/assets/templates/retro-nostalgia.png',
        'royal-emerald': 'https://satuundangan.id/assets/templates/royal-emerald.png',
        'royal-gold': 'https://satuundangan.id/assets/templates/royal-gold.png',
        'bali-payas-agung': 'https://satuundangan.id/assets/templates/bali-payas-agung.png',
        'bugis-saoraja': 'https://satuundangan.id/assets/templates/bugis-saoraja.png',
        'minang-suntiang-emas': 'https://satuundangan.id/assets/templates/minang-suntiang-emas.png',
        'strawberry-matcha': 'https://satuundangan.id/assets/templates/strawberry-matcha.png',
        'sunda-sabilulungan': 'https://satuundangan.id/assets/templates/sunda-sabilulungan.png',
      };

      for (const [slug, url] of Object.entries(OFFICIAL_THUMBNAILS)) {
        const item = await this.templateRepo.findOne({ where: { slug } });
        if (item && item.thumbnailUrl !== url) {
          await this.templateRepo.update(item.id, { thumbnailUrl: url });
        }
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
