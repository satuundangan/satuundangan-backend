import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(to: string, name: string, verifyUrl: string) {
    return this.sendMail({
      to,
      subject: 'Verifikasi email SatuUndangan',
      text: `Halo ${name}, verifikasi email SatuUndangan kamu melalui link berikut: ${verifyUrl}`,
      html: `
        <p>Halo ${this.escapeHtml(name)},</p>
        <p>Verifikasi email SatuUndangan kamu agar bisa checkout, publish undangan, dan mengajukan penarikan affiliate.</p>
        <p><a href="${verifyUrl}">Verifikasi Email</a></p>
        <p>Link ini berlaku 24 jam.</p>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
    return this.sendMail({
      to,
      subject: 'Reset password SatuUndangan',
      text: `Halo ${name}, reset password SatuUndangan kamu melalui link berikut: ${resetUrl}`,
      html: `
        <p>Halo ${this.escapeHtml(name)},</p>
        <p>Kami menerima permintaan reset password akun SatuUndangan kamu.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>Link ini berlaku 1 jam. Abaikan email ini jika kamu tidak meminta reset password.</p>
      `,
    });
  }

  private async sendMail(payload: SendMailPayload): Promise<boolean> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    const from =
      this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
      this.configService.get<string>('MAIL_FROM_ADDRESS');

    if (!accountId || !apiToken || !from) {
      this.logger.warn(
        `Email not sent to=${payload.to}: Cloudflare email env is not configured`,
      );
      return false;
    }

    try {
      await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
        {
          to: payload.to,
          from,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      this.logger.log(
        `Email queued to=${payload.to} subject="${payload.subject}"`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email send failed to=${payload.to}: ${message}`);
      return false;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
