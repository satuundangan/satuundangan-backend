import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User } from '../user/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Logger } from '@nestjs/common';

type UserType = {
  id: number;
  email: string;
};

@Injectable()
export class AuthService {
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
}
