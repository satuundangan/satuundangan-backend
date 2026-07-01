import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { TurnstileService } from './turnstile.service';

/**
 * Guard that validates a Cloudflare Turnstile token sent in the request body
 * under `turnstileToken`. Runs before the ValidationPipe strips it from DTOs.
 * Attach with `@UseGuards(TurnstileGuard)` on the routes to protect.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstileService: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.body?.turnstileToken as string) || undefined;
    const remoteIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;

    const ok = await this.turnstileService.verify(token, remoteIp);
    if (!ok) {
      throw new ForbiddenException(
        'Verifikasi keamanan gagal. Silakan coba lagi.',
      );
    }
    return true;
  }
}
