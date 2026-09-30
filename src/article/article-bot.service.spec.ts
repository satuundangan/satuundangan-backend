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
  });
});
