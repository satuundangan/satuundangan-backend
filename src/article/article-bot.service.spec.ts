import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticleBotService, WEDDING_KEYWORDS_BANK } from './article-bot.service';
import { ArticleService } from './article.service';
import { Article } from './article.entity';

describe('ArticleBotService', () => {
  let service: ArticleBotService;

  const mockArticleRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockArticleService = {
    create: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockArticleRepo.find.mockResolvedValue([]);
    mockArticleRepo.count.mockResolvedValue(5);
    mockConfigService.get.mockImplementation((key: string, defaultVal?: string) => {
      if (key === 'AUTO_BLOG_ENABLED') return 'true';
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
      return defaultVal;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBotService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ArticleService,
          useValue: mockArticleService,
        },
        {
          provide: getRepositoryToken(Article),
          useValue: mockArticleRepo,
        },
      ],
    }).compile();

    service = module.get<ArticleBotService>(ArticleBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getStatus returns proper operational status and 08:00 WIB schedule', async () => {
    const status = await service.getStatus();
    expect(status.autoBlogEnabled).toBe(true);
    expect(status.scheduleTime).toContain('08:00 WIB');
    expect(status.geminiConfigured).toBe(true);
    expect(status.curatedKeywordsTotal).toBe(WEDDING_KEYWORDS_BANK.length);
  });

  it('getNextUnpublishedKeyword returns first keyword when no articles exist', async () => {
    mockArticleRepo.find.mockResolvedValueOnce([]);
    const keywordItem = await service.getNextUnpublishedKeyword();
    expect(keywordItem.keyword).toBe(WEDDING_KEYWORDS_BANK[0].keyword);
  });

  it('getNextUnpublishedKeyword skips already published topics', async () => {
    mockArticleRepo.find.mockResolvedValueOnce([
      {
        title: WEDDING_KEYWORDS_BANK[0].keyword,
        slug: 'contoh-kata-mutiara',
        focusKeyword: WEDDING_KEYWORDS_BANK[0].keyword,
      },
    ]);

    const keywordItem = await service.getNextUnpublishedKeyword();
    expect(keywordItem.keyword).toBe(WEDDING_KEYWORDS_BANK[1].keyword);
  });

  it('resolveContextualCover correctly matches religious, cultural, and planning topics', () => {
    const { resolveContextualCover } = require('./article-bot.service');

    // Christian / Bible
    expect(resolveContextualCover('Kata Mutiara Pernikahan Kristen & Ayat Alkitab')).toContain('photo-1561345806-a2a89814df7a');

    // Islamic / Quran
    expect(resolveContextualCover('Ayat Alquran Surat Ar-Rum 21')).toContain('photo-1665306376180-3349308d5a38');
    expect(resolveContextualCover('Teks Undangan Islami Walimatul Ursy Sunnah')).toContain('photo-1653137790376-8f7f92afe14e');

    // Catholic / Holy Matrimony
    expect(resolveContextualCover('Doa Sakramen Perkawinan Katolik')).toContain('photo-1769374072596-cec462031154');

    // Planning / Panitia
    expect(resolveContextualCover('Susunan Panitia Pernikahan & Checklist Tugas')).toContain('photo-1759661937582-0ccd5dacf20f');

    // Budget
    expect(resolveContextualCover('Rincian Biaya Nikah Hemat 30 Juta')).toContain('photo-1559599101-f09722fb4948');

    // Japanese / Anime
    expect(resolveContextualCover('Konsep Undangan Tema Anime Jepang')).toContain('photo-1519882189396-71f93cb4714b');

    // Batak / Ulos
    expect(resolveContextualCover('Pernikahan Adat Batak Toba Ulos')).toContain('photo-1583939003579-730e3918a45a');

    // Minang / Suntiang
    expect(resolveContextualCover('Tata Cara Malam Bainai Suntiang Minang')).toContain('photo-1544717305-2782549b5136');

    // KUA / SIMKAH
    expect(resolveContextualCover('Syarat Nikah di KUA dan Daftar SIMKAH')).toContain('photo-1450133064473-71024230f91b');

    // Rings / Cincin
    expect(resolveContextualCover('Cincin Kawin Emas Putih vs Palladium')).toContain('photo-1605100804763-247f67b3557e');
  });

  it('keyword bank contains more than 80 curated keywords with no duplicate keywords', () => {
    expect(WEDDING_KEYWORDS_BANK.length).toBeGreaterThanOrEqual(80);
    const keywords = WEDDING_KEYWORDS_BANK.map((k) => k.keyword.toLowerCase().trim());
    const uniqueKeywords = new Set(keywords);
    expect(uniqueKeywords.size).toBe(WEDDING_KEYWORDS_BANK.length);
  });

  it('getNextUnpublishedKeyword produces unique dynamic topic when all bank keywords are exhausted', async () => {
    // Mock all bank keywords as already written
    const allWrittenArticles = WEDDING_KEYWORDS_BANK.map((k) => ({
      title: k.keyword,
      slug: k.keyword.replace(/\s+/g, '-'),
      focusKeyword: k.keyword,
    }));
    mockArticleRepo.find.mockResolvedValueOnce(allWrittenArticles);

    const dynamicTopic = await service.getNextUnpublishedKeyword();
    expect(dynamicTopic).toBeDefined();
    expect(dynamicTopic.keyword.length).toBeGreaterThan(15);
    // Ensure the dynamic topic is not one of the raw bank keywords
    const isExactBankItem = WEDDING_KEYWORDS_BANK.some((k) => k.keyword === dynamicTopic.keyword);
    expect(isExactBankItem).toBe(false);
  });
});
