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

import { User } from '../user/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Logger } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type UserType = {
  id: number;
  email: string;
};

const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashed,
      provider: 'local',
      isApproved: dto.agreedToTerms || false,
    });

    await this.userRepo.save(user);

    return this._createToken(user.id, user.email, user.isApproved);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      Logger.log('Failed login attempt for email:', dto.email);
      throw new UnauthorizedException('User not found');
    }

    let passwordMatch: string | boolean = false;
    if (typeof user.password === 'string') {
      passwordMatch = await bcrypt.compare(dto.password, user.password);
    }

    if (!passwordMatch) {
      Logger.log('User password not matched for email:', dto.email);
      throw new UnauthorizedException('Password not matched');
    }
    Logger.log('User logged in successfully:', dto.email);
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
      message:
        'Jika email terdaftar, instruksi reset password akan dikirim.',
    };

    if (!user) {
      this.logger.warn(
        `Password reset requested for unregistered email: ${normalizedEmail}`,
      );
      return response;
    }

    const resetToken = randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = this.hashResetToken(resetToken);
    user.resetPasswordTokenExpiresAt = new Date(
      Date.now() + RESET_PASSWORD_TOKEN_TTL_MS,
    );
    await this.userRepo.save(user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

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
    const tokenHash = this.hashResetToken(dto.token);
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

  async findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  async createUserFromGoogle(googleUser: any) {
    const newUser = this.userRepo.create({
      name: googleUser.name,
      email: googleUser.email,
      provider: 'google',
      avatar: googleUser.avatar,
    });
    return await this.userRepo.save(newUser);
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
