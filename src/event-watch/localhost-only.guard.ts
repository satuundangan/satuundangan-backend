import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isLoopbackAddress } from './event-watch.utils';

/**
 * Allows only requests whose TCP peer is loopback. main.ts sets `trust proxy`
 * to 1, so req.ip and X-Forwarded-For are client-controlled and spoofable;
 * the socket's remoteAddress is not.
 */
@Injectable()
export class LocalhostOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      socket?: { remoteAddress?: string };
    }>();
    if (isLoopbackAddress(req?.socket?.remoteAddress)) return true;
    throw new ForbiddenException('Localhost only');
  }
}
