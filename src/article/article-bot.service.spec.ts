import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ArticleBotService,
  WEDDING_KEYWORDS_BANK,
} from './article-bot.service';
import { ArticleService } from './article.service';
import { Article } from './article.entity';
import { ActivityLog } from '../admin/entities/activity-log.entity';

describe('ArticleBotService', () => {
  let service: ArticleBotService;

  const mockArticleRepo = {
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockArticleService = {
    create: jest.fn(),
  };

  const mockActivityRepo = {
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockArticleRepo.find.mockResolvedValue([]);
    mockArticleRepo.count.mockResolvedValue(5);
    mockActivityRepo.findOne.mockResolvedValue(null);
    mockConfigService.get.mockImplementation(
      (key: string, defaultVal?: string) => {
        if (key === 'AUTO_BLOG_ENABLED') return 'true';
        if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
        return defaultVal;
      },
    );

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
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: mockActivityRepo,
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

  it('reports remaining topics and unknown durable history without pretending a run succeeded', async () => {
    mockArticleRepo.find.mockResolvedValueOnce([
      {
        title: WEDDING_KEYWORDS_BANK[0].keyword,
        focusKeyword: WEDDING_KEYWORDS_BANK[0].keyword,
      },
    ]);
    const status = await service.getStatus();
    expect(status.curatedKeywordsRemaining).toBeLessThan(
      WEDDING_KEYWORDS_BANK.length,
    );
    expect(status.historyScope).toBe('persistent');
    expect(status.lastAttemptAt).toBeNull();
    expect(status.lastSuccessAt).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.runState).toBe('unknown');
    expect(mockArticleService.create).not.toHaveBeenCalled();
  });

  it('shows disabled scheduling separately from provider configuration', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'AUTO_BLOG_ENABLED' ? 'false' : undefined,
    );
    const status = await service.getStatus();
    expect(status.autoBlogEnabled).toBe(false);
    expect(status.geminiConfigured).toBe(false);
    expect(status.nextScheduledRunAt).toBeNull();
  });

  it('computes the next 08:00 Jakarta schedule across its UTC boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T00:59:59Z'));
    try {
      expect((await service.getStatus()).nextScheduledRunAt).toBe('2026-10-29T01:00:00.000Z');
      jest.setSystemTime(new Date('2026-10-29T01:00:00Z'));
      expect((await service.getStatus()).nextScheduledRunAt).toBe('2026-10-30T01:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows unavailable history instead of a successful state when the history query fails', async () => {
    mockActivityRepo.findOne.mockRejectedValue(new Error('database offline'));
    const status = await service.getStatus();
    expect(status.historyAvailable).toBe(false);
    expect(status.runState).toBe('unknown');
    expect(status.lastSuccessAt).toBeNull();
  });

  it('reports durable run facts independently and never runs generation from getStatus', async () => {
    const startedAt = new Date('2026-10-28T01:00:00Z');
    const failedAt = new Date('2026-10-28T01:00:01Z');
    mockActivityRepo.findOne.mockImplementation(({ where }) => Promise.resolve(
      where.action === 'ARTICLE_BOT_RUN_STARTED'
        ? { id: 10, action: where.action, createdAt: startedAt }
        : where.action === 'ARTICLE_BOT_RUN_FAILED'
          ? { id: 11, action: where.action, createdAt: failedAt, details: { message: 'Provider rejected request' } }
          : null,
    ));
    const status = await service.getStatus();
    expect(status).toMatchObject({ runState: 'failed', lastAttemptAt: startedAt, lastSuccessAt: null, lastError: { occurredAt: failedAt, message: 'Provider rejected request' } });
    expect(mockArticleService.create).not.toHaveBeenCalled();
  });

  it('redacts the configured provider key in durable failure details', async () => {
    jest.spyOn(service as any, 'generateArticle').mockRejectedValueOnce(new Error('Request test-gemini-key failed'));
    await expect(service.generateAndPublishNextArticle('test')).rejects.toThrow();
    const failure = mockActivityRepo.save.mock.calls.find(([log]) => log.action === 'ARTICLE_BOT_RUN_FAILED')?.[0];
    expect(failure.details.message).not.toContain('test-gemini-key');
    expect(failure.details.message).toContain('[redacted]');
  });

  it('records failed manual attempts without exposing a provider key', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    await expect(service.generateAndPublishNextArticle('test')).rejects.toThrow(
      'not set',
    );
    expect(mockActivityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_BOT_RUN_STARTED',
        details: expect.objectContaining({ source: 'manual' }),
      }),
    );
    expect(mockActivityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_BOT_RUN_FAILED',
        details: expect.objectContaining({ message: expect.any(String) }),
      }),
    );
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
    expect(
      resolveContextualCover('Kata Mutiara Pernikahan Kristen & Ayat Alkitab'),
    ).toContain('photo-1561345806-a2a89814df7a');

    // Islamic / Quran
    expect(resolveContextualCover('Ayat Alquran Surat Ar-Rum 21')).toContain(
      'photo-1665306376180-3349308d5a38',
    );
    expect(
      resolveContextualCover('Teks Undangan Islami Walimatul Ursy Sunnah'),
    ).toContain('photo-1653137790376-8f7f92afe14e');

    // Catholic / Holy Matrimony
    expect(resolveContextualCover('Doa Sakramen Perkawinan Katolik')).toContain(
      'photo-1769374072596-cec462031154',
    );

    // Planning / Panitia
    expect(
      resolveContextualCover('Susunan Panitia Pernikahan & Checklist Tugas'),
    ).toContain('photo-1759661937582-0ccd5dacf20f');

    // Budget
    expect(
      resolveContextualCover('Rincian Biaya Nikah Hemat 30 Juta'),
    ).toContain('photo-1559599101-f09722fb4948');

    // Japanese / Anime
    expect(
      resolveContextualCover('Konsep Undangan Tema Anime Jepang'),
    ).toContain('photo-1519882189396-71f93cb4714b');

    // Batak / Ulos
    expect(resolveContextualCover('Pernikahan Adat Batak Toba Ulos')).toContain(
      'photo-1583939003579-730e3918a45a',
    );

    // Minang / Suntiang
    expect(
      resolveContextualCover('Tata Cara Malam Bainai Suntiang Minang'),
    ).toContain('photo-1544717305-2782549b5136');

    // KUA / SIMKAH
    expect(
      resolveContextualCover('Syarat Nikah di KUA dan Daftar SIMKAH'),
    ).toContain('photo-1450133064473-71024230f91b');

    // Rings / Cincin
    expect(
      resolveContextualCover('Cincin Kawin Emas Putih vs Palladium'),
    ).toContain('photo-1605100804763-247f67b3557e');
  });

  it('keyword bank contains more than 80 curated keywords with no duplicate keywords', () => {
    expect(WEDDING_KEYWORDS_BANK.length).toBeGreaterThanOrEqual(80);
    const keywords = WEDDING_KEYWORDS_BANK.map((k) =>
      k.keyword.toLowerCase().trim(),
    );
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
    const isExactBankItem = WEDDING_KEYWORDS_BANK.some(
      (k) => k.keyword === dynamicTopic.keyword,
    );
    expect(isExactBankItem).toBe(false);
  });

  it('cleanupDuplicateLegacyArticles deletes articles matching terbaru-2026 pattern with id >= 18', async () => {
    const mockDuplicates = [
      { id: 18, slug: 'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026' },
      { id: 19, slug: 'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026-2' },
      { id: 21, slug: 'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026-3' },
    ];

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockDuplicates),
    };
    mockArticleRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockArticleRepo.delete.mockResolvedValue({ affected: 3 });

    const result = await service.cleanupDuplicateLegacyArticles();
    expect(result.deletedCount).toBe(3);
    expect(result.deletedSlugs).toEqual([
      'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026',
      'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026-2',
      'urutan-prosesi-pernikahan-adat-jawa-terbaru-2026-3',
    ]);
    expect(mockArticleRepo.delete).toHaveBeenCalledWith([18, 19, 21]);
  });

  it('cleanupDuplicateLegacyArticles returns 0 when no duplicates found', async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockArticleRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const result = await service.cleanupDuplicateLegacyArticles();
    expect(result.deletedCount).toBe(0);
    expect(result.deletedSlugs).toEqual([]);
    expect(mockArticleRepo.delete).not.toHaveBeenCalled();
  });
});
