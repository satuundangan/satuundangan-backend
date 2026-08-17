import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Verifies a Cloudflare Turnstile token against the siteverify API.
   * If TURNSTILE_SECRET_KEY is not configured, verification is skipped
   * (returns true) so local/dev environments keep working without keys.
   */
  async verify(token?: string, remoteIp?: string): Promise<boolean> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');

    if (!secret) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY not set — skipping Turnstile verification',
      );
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const params = new URLSearchParams();
      params.append('secret', secret);
      params.append('response', token);
      if (remoteIp) params.append('remoteip', remoteIp);

      const { data } = await axios.post<SiteVerifyResponse>(
        VERIFY_URL,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      if (!data.success) {
        this.logger.warn(
          `Turnstile verification failed: ${(data['error-codes'] || []).join(', ')}`,
        );
      }

      return data.success === true;
    } catch (err) {
      this.logger.error('Turnstile verification request error', err as Error);
      return false;
    }
  }
}
