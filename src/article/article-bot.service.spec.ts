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

  it('handleDailyScheduledBlog respects AUTO_BLOG_ENABLED=false', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AUTO_BLOG_ENABLED') return 'false';
      return null;
    });

    const generateSpy = jest.spyOn(service, 'generateAndPublishNextArticle');
    await service.handleDailyScheduledBlog();
    expect(generateSpy).not.toHaveBeenCalled();
  });
});
