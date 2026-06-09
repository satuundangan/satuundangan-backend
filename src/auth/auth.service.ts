import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';

import { User } from '../user/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Logger } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from './email.service';

type UserType = {
  id: number;
  email: string;
};

const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');

    const user = this.userRepo.create({
      name: dto.name,
      email: normalizedEmail,
      password: hashed,
      provider: 'local',
      isApproved: dto.agreedToTerms || false,
      emailVerificationTokenHash: this.hashToken(verificationToken),
      emailVerificationTokenExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS,
      ),
    });

    await this.userRepo.save(user);

    const verificationUrl = this.buildEmailVerificationUrl(verificationToken);
    await this.emailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationUrl,
    );

    const response: ReturnType<AuthService['_createToken']> & {
      verificationUrl?: string;
    } = this._createToken(user.id, user.email, user.isApproved);

    if (process.env.NODE_ENV !== 'production') {
      response.verificationUrl = verificationUrl;
    }

    return response;
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      Logger.log('Failed login attempt for email:', normalizedEmail);
      throw new UnauthorizedException('User not found');
    }

    let passwordMatch: string | boolean = false;
    if (typeof user.password === 'string') {
      passwordMatch = await bcrypt.compare(dto.password, user.password);
    }

    if (!passwordMatch) {
      Logger.log('User password not matched for email:', normalizedEmail);
      throw new UnauthorizedException('Password not matched');
    }
    Logger.log('User logged in successfully:', normalizedEmail);
    return this._createToken(user.id, user.email, user.isApproved);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    const response: {
      message: string;
      resetToken?: string;
      resetUrl?: string;
    } = {
      message: 'Jika email terdaftar, instruksi reset password akan dikirim.',
    };

    if (!user) {
      this.logger.warn(
        `Password reset requested for unregistered email: ${normalizedEmail}`,
      );
      return response;
    }

    const resetToken = randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = this.hashToken(resetToken);
    user.resetPasswordTokenExpiresAt = new Date(
      Date.now() + RESET_PASSWORD_TOKEN_TTL_MS,
    );
    await this.userRepo.save(user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl,
    );

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `Password reset token created for userId=${user.id} resetUrl=${resetUrl}`,
      );
      response.resetToken = resetToken;
      response.resetUrl = resetUrl;
    } else {
      this.logger.log(`Password reset token created for userId=${user.id}`);
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.userRepo.findOne({
      where: { resetPasswordTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.resetPasswordTokenExpiresAt ||
      new Date(user.resetPasswordTokenExpiresAt).getTime() < Date.now()
    ) {
      throw new BadRequestException('Token reset password tidak valid');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.provider = user.provider || 'local';
    user.resetPasswordTokenHash = null;
    user.resetPasswordTokenExpiresAt = null;
    await this.userRepo.save(user);

    return { message: 'Password berhasil direset. Silakan login kembali.' };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepo.findOne({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.emailVerificationTokenExpiresAt ||
      new Date(user.emailVerificationTokenExpiresAt).getTime() < Date.now()
    ) {
      throw new BadRequestException('Token verifikasi email tidak valid');
    }

    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;
    await this.userRepo.save(user);

    return { message: 'Email berhasil diverifikasi.' };
  }

  async resendEmailVerification(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const response: {
      message: string;
      verificationUrl?: string;
    } = {
      message: 'Jika email belum terverifikasi, link verifikasi akan dikirim.',
    };

    if (user.provider === 'google' || user.emailVerifiedAt) {
      response.message = 'Email akun sudah terverifikasi.';
      return response;
    }

    const verificationToken = randomBytes(32).toString('hex');
    user.emailVerificationTokenHash = this.hashToken(verificationToken);
    user.emailVerificationTokenExpiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS,
    );
    await this.userRepo.save(user);

    const verificationUrl = this.buildEmailVerificationUrl(verificationToken);
    await this.emailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationUrl,
    );

    if (process.env.NODE_ENV !== 'production') {
      response.verificationUrl = verificationUrl;
    }

    return response;
  }

  // untuk Google OAuth
  async googleLogin(
    user: User,
  ): Promise<{ access_token: string; isApproved: boolean }> {
    return this._createToken(user.id, user?.email, user.isApproved);
  }

  private _createToken(
    userId: number,
    email: string,
    isApproved: boolean = false,
  ): { access_token: string; isApproved: boolean } {
    const payload = { sub: userId, email };
    Logger.log(`Creating JWT for userId: ${userId}, email: ${email}`);
    return {
      access_token: this.jwtService.sign(payload),
      isApproved,
    };
  }

  async adminLogin(email: string, password: string, totpCode?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalizedEmail } });

    if (!user || !user.isAdmin) {
      throw new UnauthorizedException('Akun tidak ditemukan atau bukan admin');
    }

    let passwordMatch = false;
    if (typeof user.password === 'string') {
      passwordMatch = await bcrypt.compare(password, user.password);
    }
    if (!passwordMatch) {
      throw new UnauthorizedException('Password salah');
    }

    if (process.env.NODE_ENV !== 'production') {
      return this._createToken(user.id, user.email, user.isApproved);
    }

    if (!user.totpEnabled) {
      const token = this._createToken(user.id, user.email, user.isApproved);
      return { ...token, totpSetupRequired: true };
    }

    if (!totpCode) {
      return { requiresTotp: true };
    }

    const result = verifySync({ token: totpCode, secret: user.totpSecret! });
    if (!result.valid) {
      throw new UnauthorizedException('Kode OTP tidak valid atau sudah kadaluarsa');
    }

    return this._createToken(user.id, user.email, user.isApproved);
  }

  async setupTotp(userId: number): Promise<{ otpauthUrl: string; secret: string; qrCode: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = generateSecret();
    user.totpSecret = secret;
    user.totpEnabled = false;
    await this.userRepo.save(user);

    const otpauthUrl = generateURI({ issuer: 'Satu Undangan Admin', label: user.email, secret });
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return { otpauthUrl, secret, qrCode };
  }

  async activateTotp(userId: number, code: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('Setup TOTP dulu sebelum aktivasi');
    }

    const result = verifySync({ token: code, secret: user.totpSecret });
    if (!result.valid) {
      throw new BadRequestException('Kode OTP tidak valid, coba lagi');
    }

    user.totpEnabled = true;
    await this.userRepo.save(user);
    return { message: 'TOTP berhasil diaktifkan' };
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  async createUserFromGoogle(googleUser: any) {
    const newUser = this.userRepo.create({
      name: googleUser.name,
      email: googleUser.email,
      provider: 'google',
      avatar: googleUser.avatar,
      emailVerifiedAt: new Date(),
    });
    return await this.userRepo.save(newUser);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildEmailVerificationUrl(token: string): string {
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    const inferredApiUrl = callbackUrl
      ? callbackUrl.replace(/\/auth\/google\/redirect\/?$/, '')
      : null;
    const apiUrl =
      process.env.API_URL ||
      process.env.BACKEND_URL ||
      inferredApiUrl ||
      'http://localhost:3000';
    return `${apiUrl}/auth/verify-email?token=${token}`;
  }
}
