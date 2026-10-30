import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { WhatsappBotService } from '../whatsapp-bot/whatsapp-bot.service';
import { EmailService } from '../auth/email.service';
import {
  buildDigestMessage,
  EventSourceInvitation,
  parseEmailList,
  parseExcludeList,
  parseWaNumbers,
  selectUpcomingEvents,
  SmokeResult,
  UpcomingEventItem,
} from './event-watch.utils';

export interface DigestResult {
  sent: boolean;
  count: number;
  channel: 'whatsapp' | 'email' | 'none';
}

@Injectable()
export class EventWatchService {
  private readonly logger = new Logger(EventWatchService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappBotService,
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

    const numbers = parseWaNumbers(
      this.config.get<string>('FOUNDER_WA_NUMBERS'),
    );
    let waOk = 0;
    let waFailed = 0;
    for (const n of numbers) {
      try {
        await this.whatsapp.sendMessage(`${n}@s.whatsapp.net`, text);
        waOk++;
      } catch (err) {
        waFailed++;
        this.logger.warn(
          `Event-watch WA send to ${n} failed: ${(err as Error)?.message}`,
        );
      }
    }

    if (numbers.length > 0 && waFailed === 0) {
      return { sent: true, count: items.length, channel: 'whatsapp' };
    }

    // Fallback: WA not configured, not connected, or at least one send failed.
    const reason =
      numbers.length === 0
        ? 'FOUNDER_WA_NUMBERS kosong'
        : 'WA gagal/tidak terhubung';
    const addresses = parseEmailList(
      this.config.get<string>('OPS_ALERT_EMAILS'),
    );
    let emailOk = 0;
    for (const addr of addresses) {
      try {
        const ok = await this.email.sendOpsAlert(
          addr,
          `[Event Watch] ${items.length} acara customer (H-7/H-1/Hari-H)`,
          `Catatan: dikirim via email karena ${reason}.\n\n${text}`,
        );
        if (ok) emailOk++;
      } catch (err) {
        this.logger.warn(
          `Event-watch email to ${addr} failed: ${(err as Error)?.message}`,
        );
      }
    }

    if (emailOk > 0) {
      return { sent: true, count: items.length, channel: 'email' };
    }
    if (waOk > 0) {
      // Partial WA delivery without an email fallback still reached someone.
      return { sent: true, count: items.length, channel: 'whatsapp' };
    }
    this.logger.error(
      `Event-watch digest NOT delivered: no WA success and no OPS_ALERT_EMAILS delivery\n${text}`,
    );
    return { sent: false, count: items.length, channel: 'none' };
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
