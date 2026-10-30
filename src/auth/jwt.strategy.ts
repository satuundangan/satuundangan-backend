import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AdminSecurityService } from './admin-security.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly adminSecurity: AdminSecurityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const id = Number(payload.sub);
    // Only admin logins carry a session id; tokens issued before sessions existed stay valid.
    if (payload.sid) await this.adminSecurity.assertActive(String(payload.sid), id);
    return { id, email: payload.email, sid: payload.sid as string | undefined };
  }
}
