import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_test_123';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('uses noreply@satuundangan.id as default fallback sender when EMAIL_FROM_ADDRESS is not set', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null });

    const sent = await service.sendVerificationEmail(
      'user@example.com',
      'Test User',
      'https://satuundangan.id/verify?token=abc',
    );

    expect(sent).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'SatuUndangan <noreply@satuundangan.id>',
        to: 'user@example.com',
      }),
    );
  });

  it('uses EMAIL_FROM_ADDRESS when configured', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test_123';
      if (key === 'EMAIL_FROM_ADDRESS') return 'Custom Sender <custom@satuundangan.id>';
      return null;
    });

    mockSend.mockResolvedValue({ data: { id: 'msg_124' }, error: null });

    const sent = await service.sendPasswordResetEmail(
      'user@example.com',
      'Test User',
      'https://satuundangan.id/reset?token=xyz',
    );

    expect(sent).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Custom Sender <custom@satuundangan.id>',
        to: 'user@example.com',
      }),
    );
  });

  it('handles and logs Resend API errors gracefully without throwing', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Domain not verified' },
    });

    const sent = await service.sendVerificationEmail(
      'user@example.com',
      'Test User',
      'https://satuundangan.id/verify?token=abc',
    );

    expect(sent).toBe(false);
  });

  it('handles Resend exceptions gracefully without crashing', async () => {
    mockSend.mockRejectedValue(new Error('Network timeout'));

    const sent = await service.sendOpsAlert(
      'admin@satuundangan.id',
      'Ops Alert',
      'Sample alert text',
    );

    expect(sent).toBe(false);
  });
});
