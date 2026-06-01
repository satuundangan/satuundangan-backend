import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockJwtService = {
    sign: jest.fn(),
  };
  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns generic forgot password response when email is not registered', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const result = await service.forgotPassword({
      email: 'missing@example.com',
    });

    expect(result).toEqual({
      message:
        'Jika email terdaftar, instruksi reset password akan dikirim.',
    });
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('stores hashed reset token for registered email', async () => {
    const user = {
      id: 1,
      email: 'john@mail.com',
      resetPasswordTokenHash: null,
      resetPasswordTokenExpiresAt: null,
    };
    mockUserRepo.findOne.mockResolvedValue(user);
    mockUserRepo.save.mockResolvedValue(user);

    const result = await service.forgotPassword({
      email: 'john@mail.com',
    });

    expect(result.resetToken).toBeDefined();
    expect(result.resetUrl).toContain('/reset-password?token=');
    expect(user.resetPasswordTokenHash).toHaveLength(64);
    expect(user.resetPasswordTokenHash).not.toBe(result.resetToken);
    expect(user.resetPasswordTokenExpiresAt).toBeInstanceOf(Date);
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
  });

  it('rejects invalid reset password token', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'invalid-token', password: 'newpass123' }),
    ).rejects.toThrow('Token reset password tidak valid');
  });

  it('resets password and clears token for valid token', async () => {
    const tokenUser = {
      id: 1,
      email: 'john@mail.com',
      resetPasswordTokenHash: null,
      resetPasswordTokenExpiresAt: null,
    };
    mockUserRepo.findOne.mockResolvedValueOnce(tokenUser);
    mockUserRepo.save.mockResolvedValueOnce(tokenUser);

    const reset = await service.forgotPassword({
      email: 'john@mail.com',
    });

    const user = {
      id: 1,
      email: 'john@mail.com',
      provider: 'local',
      password: 'old-hash',
      resetPasswordTokenHash: tokenUser.resetPasswordTokenHash,
      resetPasswordTokenExpiresAt: new Date(Date.now() + 60_000),
    };

    mockUserRepo.findOne.mockResolvedValue(user);
    mockUserRepo.save.mockClear();

    const result = await service.resetPassword({
      token: reset.resetToken!,
      password: 'newpass123',
    });

    expect(result).toEqual({
      message: 'Password berhasil direset. Silakan login kembali.',
    });
    expect(user.password).not.toBe('old-hash');
    expect(user.resetPasswordTokenHash).toBeNull();
    expect(user.resetPasswordTokenExpiresAt).toBeNull();
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
  });
});
