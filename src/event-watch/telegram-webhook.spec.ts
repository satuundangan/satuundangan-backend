import { Test, TestingModule } from '@nestjs/testing';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { EventWatchService } from './event-watch.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { EmailService } from '../auth/email.service';
import { AdminHealthService } from '../admin/admin-health.service';

describe('TelegramWebhookController and Webhook Command Handling', () => {
  let controller: TelegramWebhookController;
  let service: EventWatchService;

  const mockConfig: Record<string, string> = {
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_CHAT_IDS: '123456, -100987654321',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    FRONTEND_URL: 'https://satuundangan.id',
  };

  const configServiceMock = {
    get: jest.fn((key: string) => mockConfig[key] || null),
  };

  const invitationRepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const emailServiceMock = {
    sendOpsAlert: jest.fn(),
  };

  const adminHealthServiceMock = {
    check: jest.fn().mockResolvedValue({
      worst: 'available',
      checkedAt: new Date().toISOString(),
      services: [
        {
          key: 'database',
          label: 'Database',
          status: 'available',
          message: 'Query uji berhasil (3 ms)',
          latencyMs: 3,
        },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        EventWatchService,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: getRepositoryToken(Invitation), useValue: invitationRepoMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: AdminHealthService, useValue: adminHealthServiceMock },
      ],
    }).compile();

    controller = module.get<TelegramWebhookController>(
      TelegramWebhookController,
    );
    service = module.get<EventWatchService>(EventWatchService);

    // Mock sendTelegramRaw so tests don't make real external network calls
    jest.spyOn(service, 'sendTelegramRaw').mockResolvedValue(undefined);
    // Mock checkPublicWeb
    jest.spyOn(service, 'checkPublicWeb').mockResolvedValue({
      ok: true,
      status: 200,
      latencyMs: 95,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /telegram/webhook returns active status info', () => {
    const res = controller.getWebhookInfo();
    expect(res.ok).toBe(true);
    expect(res.status).toBe('active');
  });

  it('rejects webhook request when secret token does not match TELEGRAM_WEBHOOK_SECRET', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/ping', chat: { id: 123456 } } },
      'wrong-secret',
    );
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Invalid secret token');
  });

  it('ignores non-text updates cleanly', async () => {
    const res = await controller.handleWebhook(
      { message: { photo: [], chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.message).toContain('Ignored non-text message');
  });

  it('rejects unauthorized chat ID with warning message', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/ping', chat: { id: 999999 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.message).toBe('Unauthorized chat ID');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '999999',
      expect.stringContaining('Akses Ditolak'),
    );
  });

  it('handles /ping command', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/ping', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('ping');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('Pong!'),
    );
  });

  it('handles /help and /start command', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/help', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('help');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('SatuUndangan Ops Bot'),
    );
  });

  it('handles /health and /status command', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/health', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('health');
    expect(adminHealthServiceMock.check).toHaveBeenCalled();
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('Status Kesehatan Sistem SatuUndangan'),
    );
  });

  it('handles /security and /bans command', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/security', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('security');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('Status Keamanan Server (Fail2ban & Rate Limit)'),
    );
  });

  it('handles /cek with found slug', async () => {
    invitationRepoMock.findOne.mockResolvedValueOnce({
      id: 10,
      slug: 'dilan-milea',
      groomName: 'Dilan',
      brideName: 'Milea',
      package: 'premium',
      isPublished: true,
      expiredAt: new Date('2027-11-02'),
      user: { email: 'dilan@example.com' },
    });
    jest.spyOn(service, 'smokeCheck').mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await controller.handleWebhook(
      { message: { text: '/cek dilan-milea', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('cek');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('Dilan & Milea'),
    );
  });

  it('handles /cek with missing invitation slug', async () => {
    invitationRepoMock.findOne.mockResolvedValueOnce(null);

    const res = await controller.handleWebhook(
      { message: { text: '/cek tidak-ada', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('cek');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('tidak ditemukan di database'),
    );
  });

  it('handles unknown command with help guidance', async () => {
    const res = await controller.handleWebhook(
      { message: { text: '/unknowncmd', chat: { id: 123456 } } },
      'test-secret',
    );
    expect(res.ok).toBe(true);
    expect(res.command).toBe('unknowncmd');
    expect(service.sendTelegramRaw).toHaveBeenCalledWith(
      'test-bot-token',
      '123456',
      expect.stringContaining('tidak dikenali'),
    );
  });
});
