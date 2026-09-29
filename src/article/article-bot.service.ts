import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { ArticleService } from './article.service';
import axios from 'axios';
import slugify from 'slugify';

// Curated high-intent wedding keyword bank for Indonesian couples
export const WEDDING_KEYWORDS_BANK = [
  // Cluster 1: Kata Mutiara & Teks Undangan (Pencarian Sangat Tinggi)
  {
    keyword: 'contoh kata mutiara undangan pernikahan kristen ayat alkitab',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks undangan pernikahan islami sesuai sunnah walimatul ursy',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ayat alquran untuk undangan pernikahan ar rum 21 arab latin',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh penulisan turut mengundang pada undangan pernikahan yang sopan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan pernikahan katolik doa dan sakramen perkawinan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 2: Rundown Acara & Panitia
  {
    keyword: 'susunan panitia pernikahan keluarga checklist dan pembagian tugas lengkap',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rundown acara akad nikah dan resepsi 2 jam sederhana khidmat',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks mc pernikahan formal akad dan resepsi bahasa indonesia modern',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 3: Anggaran & Budget Pernikahan
  {
    keyword: 'rincian biaya nikah sederhana 30 juta sampai 50 juta realistis hemat',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'daftar seserahan pernikahan sederhana dan hantaran pengantin wanita pria',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara menghemat budget cetak undangan dengan undangan pernikahan digital',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 4: Tips Undangan Digital & Musik
  {
    keyword: 'keuntungan undangan pernikahan digital website dibanding undangan fisik',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'daftar lagu romantis pernikahan pengiring undangan digital terpopuler',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara membuat undangan digital gratis langsung jadi dalam 5 menit',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 5: Tema & Adat Pernikahan
  {
    keyword: 'urutan prosesi pernikahan adat jawa panggih midodareni siraman',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tahapan prosesi pernikahan adat sunda ngeuyeuk seureuh sungkeman lengkap',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ide tema undangan pernikahan anime jepang unik aesthetic keren',
    category: 'tema',
    defaultCover: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
  },
];

@Injectable()
export class ArticleBotService {
  private readonly logger = new Logger(ArticleBotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly articleService: ArticleService,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  /**
   * Cron Job: Runs automatically every day at 08:00 AM WIB (Asia/Jakarta)
   * Pattern: second=0, minute=0, hour=8, day=*, month=*, dayOfWeek=*
   */
  @Cron('0 8 * * *', {
    name: 'auto_blog_publisher',
    timeZone: 'Asia/Jakarta',
  })
  async handleDailyScheduledBlog() {
    this.logger.log('⏰ Triggered daily automated blog generation (08:00 WIB)');

    const isEnabled = this.configService.get<string>('AUTO_BLOG_ENABLED', 'true') !== 'false';
    if (!isEnabled) {
      this.logger.log('Auto blog is disabled via AUTO_BLOG_ENABLED=false. Skipping.');
      return;
    }

    try {
      const result = await this.generateAndPublishNextArticle();
      this.logger.log(`✅ Successfully published article via Auto-Blogger: "${result.title}" (ID: ${result.id})`);
    } catch (error) {
      this.logger.error(`❌ Failed daily automated blog generation: ${error.message}`, error.stack);
    }
  }

  /**
   * Finds the next topic from the curated bank that hasn't been written yet
   */
  async getNextUnpublishedKeyword(): Promise<{ keyword: string; category: string; defaultCover: string }> {
    const existingArticles = await this.articleRepository.find({
      select: ['title', 'slug', 'focusKeyword'],
    });

    for (const item of WEDDING_KEYWORDS_BANK) {
      const isAlreadyWritten = existingArticles.some(
        (art) =>
          (art.focusKeyword && art.focusKeyword.toLowerCase().includes(item.keyword.toLowerCase())) ||
          (art.title && art.title.toLowerCase().includes(item.keyword.toLowerCase())) ||
          (art.slug && art.slug.includes(slugify(item.keyword, { lower: true, strict: true }).slice(0, 30))),
      );

      if (!isAlreadyWritten) {
        return item;
      }
    }

    // Fallback if all static keywords are already exhausted: generate date-anchored topic
    const currentYear = new Date().getFullYear();
    const randomTopic = WEDDING_KEYWORDS_BANK[Math.floor(Math.random() * WEDDING_KEYWORDS_BANK.length)];
    return {
      keyword: `${randomTopic.keyword} terbaru ${currentYear}`,
      category: randomTopic.category,
      defaultCover: randomTopic.defaultCover,
    };
  }

  /**
   * Generates and publishes an article (used by Cron or manual Admin call)
   */
  async generateAndPublishNextArticle(customTopic?: string, targetStatus: 'published' | 'draft' = 'published') {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY');

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY or GOOGLE_API_KEY is not set in backend environment variables. Please provide your Google AI Studio API key.',
      );
    }

    const topicItem = customTopic
      ? {
          keyword: customTopic,
          category: 'pernikahan',
          defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
        }
      : await this.getNextUnpublishedKeyword();

    this.logger.log(`Generating article with Gemini AI for target keyword: "${topicItem.keyword}"`);

    const generated = await this.callGeminiForArticle(topicItem.keyword, apiKey);

    // Ensure CTA Box is present for maximum conversion to SatuUndangan
    const contentWithCTA = this.ensureCtaAndBranding(generated.content);

    // Save article to database
    const newArticle = await this.articleService.create(
      {
        title: generated.title,
        slug: generated.slug || slugify(generated.title, { lower: true, strict: true }),
        content: contentWithCTA,
        excerpt: generated.excerpt,
        coverImage: generated.coverImage || topicItem.defaultCover,
        metaTitle: generated.metaTitle || generated.title,
        metaDescription: generated.metaDescription || generated.excerpt,
        focusKeyword: generated.focusKeyword || topicItem.keyword,
        status: targetStatus,
      },
      1, // Author: Admin (ID 1)
    );

    return newArticle;
  }

  /**
   * Calls Google Gemini REST API with strict JSON schema response
   */
  private async callGeminiForArticle(keyword: string, apiKey: string) {
    const currentYear = new Date().getFullYear();
    const prompt = `Anda adalah Senior SEO Content Strategist dan Editor Ahli untuk SatuUndangan (platform pembuatan undangan pernikahan digital aesthetic & instan di Indonesia).
Tulis artikel panduan pernikahan yang SANGAT MENDALAM, KOMPREHENSIF, dan RAMAH SEO (High EEAT) untuk keyword target: "${keyword}".

PANDUAN KONTEN:
1. Panjang artikel: Minimal 1.200 - 1.500 kata. Daging semua, bukan basa-basi generik.
2. Struktur:
   - Pembuka yang menarik (Hook masalah calon pengantin).
   - Beberapa sub-heading <h2> dan <h3> dengan poin-poin yang mudah dipahami.
   - Contoh nyata (misal: contoh teks/kutipan, tabel perbandingan budget, atau checklist susunan acara).
   - Bagian FAQ (Frequently Asked Questions) berisi 3-4 pertanyaan umum dan jawaban ringkas.
3. Gaya bahasa: Mengalir, sopan, bersahabat, terpercaya, dan menggunakan Bahasa Indonesia baku yang luwes.
4. Sertakan referensi ke tahun ${currentYear} bila relevan.
5. Format konten di field 'content' wajib menggunakan HTML bersih (gunakan tag <h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>). Jangan gunakan tag <html> atau <body>.

Balas HANYA dalam format JSON valid dengan struktur:
{
  "title": "Judul artikel yang memikat, mengandung keyword, 50-65 karakter",
  "slug": "url-slug-ramah-seo-tanpa-spasi",
  "excerpt": "Ringkasan padat dan memikat 140-160 karakter untuk meta description dan kartu preview",
  "focusKeyword": "${keyword}",
  "metaTitle": "Title SEO untuk Google Search (50-60 karakter)",
  "metaDescription": "Deskripsi SEO yang memicu klik di Google (140-160 karakter)",
  "content": "Konten lengkap artikel dalam format HTML semantik",
  "faqs": [
    { "question": "Pertanyaan 1?", "answer": "Jawaban 1..." },
    { "question": "Pertanyaan 2?", "answer": "Jawaban 2..." }
  ]
}`;

    // Multi-tier fallback array prioritized by highest quota (500 RPD each)
    const models = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
    ];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(
          url,
          {
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          },
          {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const candidates = response.data?.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('Gemini API returned no candidates');
        }

        const rawText = candidates[0].content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Empty response from Gemini');
        }

        const parsed = JSON.parse(rawText);
        return parsed;
      } catch (err) {
        lastError = err;
        this.logger.warn(`Model ${model} failed: ${err.message}. Trying fallback if available.`);
      }
    }

    throw new Error(`Failed to generate article from Gemini: ${lastError?.message}`);
  }

  /**
   * Injects an eye-catching CTA box into the HTML content to convert readers into SatuUndangan users
   */
  private ensureCtaAndBranding(htmlContent: string): string {
    const ctaBanner = `
<div class="my-10 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#2c1d11]/5 via-[#d4af37]/10 to-[#2c1d11]/5 border border-[#d4af37]/30 text-center shadow-sm">
  <span class="inline-block px-3 py-1 bg-[#d4af37]/20 text-[#8c6b2d] rounded-full text-xs font-bold uppercase tracking-widest mb-3">Solusi Undangan Pernikahan Digital</span>
  <h3 class="text-xl md:text-2xl font-bold text-gray-900 mb-2">Buat Undangan Pernikahan Digital Impianmu di SatuUndangan</h3>
  <p class="text-sm text-gray-600 max-w-xl mx-auto mb-6 leading-relaxed">
    Nikmati kemudahan membuat undangan digital modern dengan fitur lengkap: RSVP instan, amplop digital QRIS, countdown acara, dan pilihan musik romantis bebas pilih.
  </p>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <a href="/create" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2c1d11] text-white font-bold text-sm shadow-md hover:bg-[#432d1a] transition-all">
      Buat Undangan Sekarang
    </a>
    <a href="/templates" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all">
      Lihat Katalog Desain
    </a>
  </div>
</div>`;

    // Append FAQ section if not already in content
    return `${htmlContent}\n\n${ctaBanner}`;
  }

  /**
   * Retrieves bot status and remaining topics for admin dashboard
   */
  async getStatus() {
    const totalPublished = await this.articleRepository.count();
    const remainingKeywordCount = WEDDING_KEYWORDS_BANK.length;
    const isConfigured = Boolean(
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY'),
    );

    return {
      autoBlogEnabled: this.configService.get<string>('AUTO_BLOG_ENABLED', 'true') !== 'false',
      scheduleTime: '08:00 WIB (Setiap Hari)',
      geminiConfigured: isConfigured,
      totalArticlesInDb: totalPublished,
      curatedKeywordsTotal: remainingKeywordCount,
      nextScheduledRun: 'Setiap hari pukul 08:00 WIB',
    };
  }
}
