import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'MOCKSECRET'),
  generateURI: jest.fn(() => 'otpauth://totp/mock'),
  verifySync: jest.fn(() => ({ valid: true })),
}));

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {};
  const mockJwtService = {};
  const mockConfigService = { get: jest.fn() };
  const mockUserService = {};
  const mockTurnstileService = { validateTurnstileToken: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserService, useValue: mockUserService },
        { provide: TurnstileService, useValue: mockTurnstileService },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
