import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifiedCallback } from 'passport-google-oauth20';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifiedCallback,
  ): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { emails, displayName, photos } = profile;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const email = emails?.[0]?.value;
    const avatar = photos?.[0]?.value;

    // Cari user di DB
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      user = this.userRepo.create({
        name: displayName,
        email,
        provider: 'google',
        password: null,
        avatar,
        emailVerifiedAt: new Date(),
      });
      user = await this.userRepo.save(user);
    } else if (!user.avatar && avatar) {
      user.avatar = avatar;
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
    } else if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
    }

    this.logger.log(`Google user authenticated: ${email}`);
    console.log('Validate user from DB:', user);
    this.logger.log('Validate user profile:', profile);
    this.logger.log('User from DB (or created):', user);

    console.log(
      'GoogleStrategy callbackURL:',
      this.config.get<string>('GOOGLE_CALLBACK_URL'),
    );

    done(null, user);
  }
}
