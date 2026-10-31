import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { EmailService } from '../auth/email.service';
import {
  buildDigestMessage,
  EventSourceInvitation,
  formatWib,
  parseEmailList,
  parseExcludeList,
  parseTelegramChatIds,
  selectUpcomingEvents,
  SmokeResult,
  toTelegramHtml,
  UpcomingEventItem,
} from './event-watch.utils';

export interface DigestResult {
  sent: boolean;
  count: number;
  channel: 'telegram' | 'email' | 'none';
}

@Injectable()
export class EventWatchService {
  private readonly logger = new Logger(EventWatchService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async getUpcomingEvents(
    days: number,
    now: Date = new Date(),
  ): Promise<UpcomingEventItem[]> {
    const rows = await this.invitationRepo.find({
      where: { isPublished: true },
      relations: { user: true },
      select: {
        id: true,
        slug: true,
        title: true,
        coupleName: true,
        groomName: true,
        brideName: true,
        package: true,
        dateTime: true,
        akadLocation: true,
        resepsiLocation: true,
        user: { id: true, email: true, isAdmin: true },
      },
    });
    return selectUpcomingEvents(rows as unknown as EventSourceInvitation[], {
      days,
      now,
      excludeList: parseExcludeList(
        this.config.get<string>('EVENT_WATCH_EXCLUDE_EMAILS'),
      ),
    });
  }

  async smokeCheck(slug: string): Promise<SmokeResult> {
    // The app listens on 0.0.0.0 (IPv4 only), so use 127.0.0.1 rather than localhost.
    const url = `http://127.0.0.1:${process.env.PORT || 3000}/invitation/slug/${encodeURIComponent(slug)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return { ok: res.status === 200, status: res.status };
    } catch (err) {
      const e = err as Error;
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      return {
        ok: false,
        status: null,
        error: timedOut ? 'timeout' : (e?.message ?? 'unknown error'),
      };
    }
  }

  async runDailyDigest(now: Date = new Date()): Promise<DigestResult> {
    const items = (await this.getUpcomingEvents(7, now)).filter((i) =>
      [0, 1, 7].includes(i.daysUntil),
    );
    if (items.length === 0) {
      this.logger.log('No H-7/H-1/Hari-H customer events');
      return { sent: false, count: 0, channel: 'none' };
    }

    const smoke: Record<string, SmokeResult> = {};
    for (const item of items) {
      smoke[item.slug] = await this.smokeCheck(item.slug);
    }
    const text = buildDigestMessage(items, smoke, now);
    const channel = await this.deliver(
      text,
      `[Event Watch] ${items.length} acara customer (H-7/H-1/Hari-H)`,
    );
    return { sent: channel !== 'none', count: items.length, channel };
  }

  /** Manual check of the delivery path (admin endpoint); does not touch event data. */
  async sendTestMessage(now: Date = new Date()): Promise<DigestResult> {
    const text = [
      '*Event Watch SatuUndangan — pesan uji*',
      `Dikirim ${formatWib(now)}.`,
      'Kalau pesan ini masuk, notifikasi H-7/H-1/Hari-H siap jalan.',
    ].join('\n');
    const channel = await this.deliver(text, '[Event Watch] Pesan uji');
    return { sent: channel !== 'none', count: 0, channel };
  }

  /** Telegram first; email fallback when Telegram is unconfigured or any send fails. */
  private async deliver(
    text: string,
    emailSubject: string,
  ): Promise<DigestResult['channel']> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatIds = parseTelegramChatIds(
      this.config.get<string>('TELEGRAM_CHAT_IDS'),
    );
    let tgOk = 0;
    let tgFailed = 0;
    if (token) {
      for (const chatId of chatIds) {
        try {
          await this.sendTelegram(token, chatId, text);
          tgOk++;
        } catch (err) {
          tgFailed++;
          this.logger.warn(
            `Event-watch Telegram send to ${chatId} failed: ${(err as Error)?.message}`,
          );
        }
      }
    }

    if (tgOk > 0 && tgFailed === 0) return 'telegram';

    const reason = !token
      ? 'TELEGRAM_BOT_TOKEN kosong'
      : chatIds.length === 0
        ? 'TELEGRAM_CHAT_IDS kosong'
        : 'Telegram gagal';
    const addresses = parseEmailList(
      this.config.get<string>('OPS_ALERT_EMAILS'),
    );
    let emailOk = 0;
    for (const addr of addresses) {
      try {
        const ok = await this.email.sendOpsAlert(
          addr,
          emailSubject,
          `Catatan: dikirim via email karena ${reason}.\n\n${text}`,
        );
        if (ok) emailOk++;
      } catch (err) {
        this.logger.warn(
          `Event-watch email to ${addr} failed: ${(err as Error)?.message}`,
        );
      }
    }

    if (emailOk > 0) return 'email';
    // Partial Telegram delivery without an email fallback still reached someone.
    if (tgOk > 0) return 'telegram';
    this.logger.error(
      `Event-watch message NOT delivered (${reason}, no OPS_ALERT_EMAILS delivery)\n${text}`,
    );
    return 'none';
  }

  private async sendTelegram(
    token: string,
    chatId: string,
    text: string,
  ): Promise<void> {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: toTelegramHtml(text),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      // Telegram error bodies never echo the token; safe to log.
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }

  async getDeployGateEvents(days = 1): Promise<{
    count: number;
    items: Array<Pick<UpcomingEventItem, 'slug' | 'eventAtWib' | 'daysUntil'>>;
  }> {
    const items = await this.getUpcomingEvents(days);
    return {
      count: items.length,
      items: items.map(({ slug, eventAtWib, daysUntil }) => ({
        slug,
        eventAtWib,
        daysUntil,
      })),
    };
  }
}
