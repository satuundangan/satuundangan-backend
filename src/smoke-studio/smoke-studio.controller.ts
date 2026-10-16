import {
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

const ATTEMPT_LIMIT = 10;
const WINDOW_MS = 60_000;

@Controller('smoke-studio')
export class SmokeStudioController {
  private readonly attemptsByIp = new Map<string, number[]>();

  @Post('attempt')
  checkAttempt(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const now = Date.now();
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
    const recentAttempts = (this.attemptsByIp.get(clientIp) || []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );

    if (recentAttempts.length >= ATTEMPT_LIMIT) {
      const retryAfter = Math.max(
        1,
        Math.ceil((recentAttempts[0] + WINDOW_MS - now) / 1000),
      );
      response.setHeader('Retry-After', retryAfter);
      this.attemptsByIp.set(clientIp, recentAttempts);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter} detik.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentAttempts.push(now);
    this.attemptsByIp.set(clientIp, recentAttempts);
    this.cleanupExpiredEntries(now);

    return { allowed: true };
  }

  private cleanupExpiredEntries(now: number) {
    if (this.attemptsByIp.size < 1_000) return;

    for (const [ip, attempts] of this.attemptsByIp) {
      const recentAttempts = attempts.filter(
        (timestamp) => now - timestamp < WINDOW_MS,
      );
      if (recentAttempts.length) this.attemptsByIp.set(ip, recentAttempts);
      else this.attemptsByIp.delete(ip);
    }
  }
}
