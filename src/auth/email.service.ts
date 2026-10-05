import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
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
  private resendClient: Resend | null = null;

  constructor(private readonly configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
    }
  }

  async sendVerificationEmail(to: string, name: string, verifyUrl: string) {
    return this.sendMail({
      to,
      subject: 'Verifikasi Email SatuUndangan',
      text: `Halo ${name}, verifikasi email SatuUndangan kamu melalui link berikut: ${verifyUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f1ede8;">
          <div style="text-align: center; margin-bottom: 28px;">
            <h1 style="color: #634832; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">SatuUndangan</h1>
            <p style="color: #9c8e82; font-size: 13px; margin: 4px 0 0 0;">Platform Undangan Pernikahan Digital Eksklusif</p>
          </div>
          <div style="background: #faf8f5; border-radius: 12px; padding: 24px; border: 1px solid #f1ede8;">
            <h2 style="color: #1a1512; font-size: 18px; margin: 0 0 12px 0;">Halo ${this.escapeHtml(name)},</h2>
            <p style="color: #55483d; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Terima kasih telah bergabung di SatuUndangan! Mohon verifikasi alamat email kamu untuk mengamankan akun dan melanjutkan pembuatan undangan pernikahanmu.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${verifyUrl}" style="background-color: #634832; color: #ffffff; padding: 13px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(99, 72, 50, 0.25);">
                Verifikasi Email Saya
              </a>
            </div>
            <p style="color: #8c7d70; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
              Link ini berlaku selama 24 jam. Jika tombol tidak berfungsi, salin dan buka tautan ini di browsermu:<br/>
              <a href="${verifyUrl}" style="color: #634832; word-break: break-all;">${verifyUrl}</a>
            </p>
          </div>
          <p style="color: #b5a99f; font-size: 11px; text-align: center; margin-top: 24px;">
            © ${new Date().getFullYear()} SatuUndangan.id · Semua Hak Dilindungi
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
    return this.sendMail({
      to,
      subject: 'Reset Password Akun SatuUndangan',
      text: `Halo ${name}, reset password SatuUndangan kamu melalui link berikut: ${resetUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f1ede8;">
          <div style="text-align: center; margin-bottom: 28px;">
            <h1 style="color: #634832; font-size: 24px; font-weight: 800; margin: 0;">SatuUndangan</h1>
          </div>
          <div style="background: #faf8f5; border-radius: 12px; padding: 24px; border: 1px solid #f1ede8;">
            <h2 style="color: #1a1512; font-size: 18px; margin: 0 0 12px 0;">Halo ${this.escapeHtml(name)},</h2>
            <p style="color: #55483d; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Kami menerima permintaan untuk mereset password akun SatuUndangan kamu. Klik tombol di bawah untuk membuat password baru:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" style="background-color: #634832; color: #ffffff; padding: 13px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #8c7d70; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
              Link ini berlaku selama 1 jam. Abaikan email ini jika kamu tidak meminta reset password.
            </p>
          </div>
        </div>
      `,
    });
  }

  private async sendMail(payload: SendMailPayload): Promise<boolean> {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    const defaultFrom =
      this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
      this.configService.get<string>('RESEND_FROM_ADDRESS') ||
      'SatuUndangan <onboarding@resend.dev>';

    // 1. Try Resend if configured
    if (this.resendClient || resendApiKey) {
      try {
        const client = this.resendClient || new Resend(resendApiKey);
        const { data, error } = await client.emails.send({
          from: defaultFrom,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        });

        if (error) {
          this.logger.error(
            `Resend send failed to=${payload.to}: ${error.message} (code: ${error.name})`,
          );
        } else {
          this.logger.log(`Email sent via Resend to=${payload.to} id=${data?.id}`);
          return true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Resend exception to=${payload.to}: ${msg}`);
      }
    }

    // 2. Fallback to Cloudflare Email API if configured
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    const cfFrom =
      this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
      this.configService.get<string>('MAIL_FROM_ADDRESS');

    if (accountId && apiToken && cfFrom) {
      try {
        await axios.post(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
          {
            to: payload.to,
            from: cfFrom,
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
        this.logger.log(`Email sent via Cloudflare to=${payload.to}`);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Cloudflare send failed to=${payload.to}: ${message}`);
      }
    }

    this.logger.warn(`Email not sent to=${payload.to}: No active mail provider succeeded`);
    return false;
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
