import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { EmailService } from '../auth/email.service';
import { AdminHealthService } from '../admin/admin-health.service';
import {
  buildDigestMessage,
  buildHealthReportMessage,
  EventSourceInvitation,
  formatUptime,
  formatWib,
  formatWibDate,
  parseEmailList,
  parseExcludeList,
  parseTelegramChatIds,
  parseTelegramCommand,
  PUBLIC_BASE_URL,
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
    @Optional()
    private readonly healthService?: AdminHealthService,
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

  /** Ping public website to ensure home page is live and responsive. */
  async checkPublicWeb(timeoutMs = 5000): Promise<{
    ok: boolean;
    status: number | null;
    latencyMs: number;
    error?: string;
  }> {
    const url =
      this.config.get<string>('FRONTEND_URL') || 'https://satuundangan.id';
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return {
        ok: res.ok,
        status: res.status,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const e = err as Error;
      return {
        ok: false,
        status: null,
        latencyMs: Date.now() - started,
        error: e?.message || 'unknown error',
      };
    }
  }

  /** Constructs formatted health digest string for Telegram / email. */
  async buildHealthReport(now: Date = new Date()): Promise<string> {
    const healthData = this.healthService
      ? await this.healthService.check(true)
      : {
          checkedAt: now.toISOString(),
          worst: 'available' as const,
          services: [],
        };
    const webCheck = await this.checkPublicWeb();
    const mem = process.memoryUsage();
    const memory = {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
    };
    const uptimeSeconds = process.uptime();

    return buildHealthReportMessage({
      worst: healthData.worst,
      checkedAt: healthData.checkedAt,
      services: healthData.services,
      webCheck,
      memory,
      uptimeSeconds,
      now,
    });
  }

  /** Runs daily morning system health digest delivery. */
  async runDailyHealthReport(now: Date = new Date()): Promise<DigestResult> {
    const html = await this.buildHealthReport(now);
    const channel = await this.deliver(
      html,
      `[Health Watch] Laporan Kesehatan Server & Web (${formatWib(now)})`,
    );
    return { sent: channel !== 'none', count: 1, channel };
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

  /** Manual test of the health report delivery (admin endpoint). */
  async sendTestHealth(now: Date = new Date()): Promise<DigestResult> {
    return this.runDailyHealthReport(now);
  }

  /** Sends raw HTML directly to a specific Telegram chat without double escaping. */
  async sendTelegramRaw(
    token: string,
    chatId: string,
    htmlText: string,
  ): Promise<void> {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }

  /** Process incoming updates from Telegram webhook. */
  async handleTelegramWebhook(
    body: any,
    secretToken?: string,
  ): Promise<{ ok: boolean; message?: string; command?: string }> {
    const expectedSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretToken !== expectedSecret) {
      this.logger.warn('Telegram webhook rejected: invalid secret token');
      return { ok: false, message: 'Invalid secret token' };
    }

    const msg = body?.message || body?.edited_message;
    if (!msg || !msg.text) {
      return { ok: true, message: 'Ignored non-text message' };
    }

    const chatId = String(msg.chat.id);
    const text = String(msg.text);
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured; cannot reply');
      return { ok: false, message: 'TELEGRAM_BOT_TOKEN not configured' };
    }

    // Security whitelist check
    const allowedChatIds = parseTelegramChatIds(
      this.config.get<string>('TELEGRAM_CHAT_IDS'),
    );
    if (allowedChatIds.length > 0 && !allowedChatIds.includes(chatId)) {
      this.logger.warn(`Unauthorized Telegram access from chat_id=${chatId}`);
      await this.sendTelegramRaw(
        token,
        chatId,
        `🚫 <b>Akses Ditolak</b>\nChat ID Anda (<code>${chatId}</code>) belum terdaftar di whitelist bot SatuUndangan.\nHubungi administrator untuk menambahkan ID Anda ke <code>TELEGRAM_CHAT_IDS</code>.`,
      );
      return { ok: true, message: 'Unauthorized chat ID' };
    }

    const parsed = parseTelegramCommand(text);
    if (!parsed) {
      return { ok: true, message: 'Not a command' };
    }

    const { command, args } = parsed;

    switch (command) {
      case 'start':
      case 'help': {
        const reply = [
          '🤖 <b>SatuUndangan Ops Bot</b>',
          '',
          'Halo! Saya bot operasional internal SatuUndangan. Berikut perintah yang dapat Anda gunakan:',
          '',
          '🏥 <b>Kesehatan & Sistem:</b>',
          '• /health atau /status — Laporan kesehatan web, DB, R2, Midtrans & server',
          '• /ping — Cek respon kilat & uptime bot',
          '• /security atau /bans — Informasi keamanan & fail2ban server',
          '',
          '📅 <b>Acara & Undangan:</b>',
          '• /events atau /acara — Laporan acara H-7, H-1, & Hari-H',
          '• /today atau /hariini — Daftar acara customer hari ini',
          '• /besok atau /h1 — Daftar acara customer besok',
          '• /cek &lt;slug&gt; — Cek status & smoke test spesifik 1 undangan',
        ].join('\n');
        await this.sendTelegramRaw(token, chatId, reply);
        return { ok: true, command };
      }

      case 'ping': {
        const reply = [
          '🏓 <b>Pong!</b>',
          'Server Backend Aktif &amp; Responsif',
          `Waktu: ${formatWib(new Date())}`,
          `Uptime: ${formatUptime(process.uptime())}`,
        ].join('\n');
        await this.sendTelegramRaw(token, chatId, reply);
        return { ok: true, command };
      }

      case 'health':
      case 'status': {
        const report = await this.buildHealthReport();
        await this.sendTelegramRaw(token, chatId, report);
        return { ok: true, command };
      }

      case 'events':
      case 'acara': {
        const items = (await this.getUpcomingEvents(7)).filter((i) =>
          [0, 1, 7].includes(i.daysUntil),
        );
        if (items.length === 0) {
          await this.sendTelegramRaw(
            token,
            chatId,
            'ℹ️ <b>Tidak ada acara customer</b> pada H-7, H-1, atau Hari-H.',
          );
          return { ok: true, command };
        }
        const smoke: Record<string, SmokeResult> = {};
        for (const it of items) {
          smoke[it.slug] = await this.smokeCheck(it.slug);
        }
        const digest = buildDigestMessage(items, smoke, new Date());
        await this.sendTelegramRaw(token, chatId, toTelegramHtml(digest));
        return { ok: true, command };
      }

      case 'today':
      case 'hariini': {
        const items = await this.getUpcomingEvents(0);
        const todayItems = items.filter((i) => i.daysUntil === 0);
        if (todayItems.length === 0) {
          await this.sendTelegramRaw(
            token,
            chatId,
            '🎉 <b>Hari ini tidak ada acara customer pernikahan yang berlangsung.</b>',
          );
          return { ok: true, command };
        }
        const smoke: Record<string, SmokeResult> = {};
        for (const it of todayItems) {
          smoke[it.slug] = await this.smokeCheck(it.slug);
        }
        const digest = buildDigestMessage(todayItems, smoke, new Date());
        await this.sendTelegramRaw(token, chatId, toTelegramHtml(digest));
        return { ok: true, command };
      }

      case 'besok':
      case 'h1': {
        const items = await this.getUpcomingEvents(1);
        const h1Items = items.filter((i) => i.daysUntil === 1);
        if (h1Items.length === 0) {
          await this.sendTelegramRaw(
            token,
            chatId,
            'ℹ️ <b>Besok tidak ada acara customer (H-1).</b>',
          );
          return { ok: true, command };
        }
        const smoke: Record<string, SmokeResult> = {};
        for (const it of h1Items) {
          smoke[it.slug] = await this.smokeCheck(it.slug);
        }
        const digest = buildDigestMessage(h1Items, smoke, new Date());
        await this.sendTelegramRaw(token, chatId, toTelegramHtml(digest));
        return { ok: true, command };
      }

      case 'cek': {
        if (!args) {
          await this.sendTelegramRaw(
            token,
            chatId,
            'ℹ️ <b>Format Perintah:</b>\n<code>/cek &lt;slug-undangan&gt;</code>\n\nContoh: <code>/cek dilan-milea</code>',
          );
          return { ok: true, command };
        }
        const slug = args.toLowerCase().replace(/^\/+/, '');
        const inv = await this.invitationRepo.findOne({
          where: { slug },
          relations: { user: true },
        });
        if (!inv) {
          await this.sendTelegramRaw(
            token,
            chatId,
            `⚠️ Undangan dengan slug "<b>${slug}</b>" tidak ditemukan di database.`,
          );
          return { ok: true, command };
        }
        const smoke = await this.smokeCheck(slug);
        const smokeText = smoke.ok
          ? '✅ OK (HTTP 200)'
          : `❌ FAIL (${smoke.status ?? smoke.error ?? 'error'})`;
        const couple =
          inv.groomName && inv.brideName
            ? `${inv.groomName} & ${inv.brideName}`
            : inv.coupleName || inv.title || `Undangan #${inv.id}`;
        const pkg = inv.package ? inv.package.toUpperCase() : 'BELUM DIPILIH';
        const pub = inv.isPublished
          ? '✅ Terbit (Published)'
          : '📝 Draft (Belum Terbit)';
        const expired = inv.expiredAt
          ? formatWibDate(new Date(inv.expiredAt))
          : '-';

        const lines = [
          `💌 <b>Detail Undangan:</b> <code>${slug}</code>`,
          `<b>Pasangan:</b> ${couple}`,
          `<b>Paket:</b> ${pkg}`,
          `<b>Status:</b> ${pub}`,
          `<b>Masa Aktif:</b> s.d. ${expired}`,
          `<b>Owner:</b> ${inv.user?.email || '-'}`,
          `<b>Link:</b> ${PUBLIC_BASE_URL}${slug}`,
          `<b>Kesehatan Halaman:</b> ${smokeText}`,
        ];
        await this.sendTelegramRaw(token, chatId, lines.join('\n'));
        return { ok: true, command };
      }

      case 'security':
      case 'bans': {
        const text = [
          '🛡️ <b>Status Keamanan Server (Fail2ban & Rate Limit)</b>',
          '',
          '<b>Jail Aktif yang Dikonfigurasi:</b>',
          '• <code>[sshd]</code> — Anti brute-force SSH port 22 (max 3 percobaan gagal)',
          '• <code>[nginx-badbots]</code> — Blokir scanner otomatis (/.env, /.git, /wp-login, phpmyadmin)',
          '• <code>[nginx-botsearch]</code> — Blokir 404 URL fuzzing & vulnerability scanners',
          '• <code>[nginx-req-limit]</code> — Blokir IP abuse request & DDoS layer 7',
          '',
          '⏱️ <b>Durasi Ban:</b> 24 Jam (86.400 detik)',
          '🚨 <b>Telegram Alert:</b> Setiap kali ada IP yang diblokir di server Biznet, bot akan mengirimkan peringatan instan ke grup ini.',
        ].join('\n');
        await this.sendTelegramRaw(token, chatId, text);
        return { ok: true, command };
      }

      default: {
        await this.sendTelegramRaw(
          token,
          chatId,
          `❓ Perintah <code>/${command}</code> tidak dikenali.\nKetik <b>/help</b> untuk melihat daftar perintah yang tersedia.`,
        );
        return { ok: true, command };
      }
    }
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
    const htmlText =
      text.includes('<') && text.includes('>') ? text : toTelegramHtml(text);
    return this.sendTelegramRaw(token, chatId, htmlText);
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
