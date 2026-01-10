import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';

import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ConfigModule, // tambahkan ini
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}
