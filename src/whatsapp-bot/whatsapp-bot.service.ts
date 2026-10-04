import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import pino from 'pino';

export type BotConnectionStatus =
  | 'DISCONNECTED'
  | 'SCAN_QR'
  | 'CONNECTING'
  | 'CONNECTED';

@Injectable()
export class WhatsappBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappBotService.name);
  private sock: WASocket | null = null;
  private status: BotConnectionStatus = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private isAiEnabled = true;

  // Anti-spam / Cooldown per contact (JID -> timestamp)
  private readonly cooldownMap = new Map<string, number>();
  // Paused contacts (e.g. handover to human admin) (JID -> unpause timestamp)
  private readonly pausedContacts = new Map<string, number>();

  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesReplied: 0,
    aiRepliesGenerated: 0,
    startedAt: new Date().toISOString(),
  };

  private readonly sessionDir = path.resolve(process.cwd(), 'sessions/whatsapp-bot');

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Optionally auto-connect on boot if sessions exist or if WA_BOT_AUTOSTART=true
    const autoStart =
      this.configService.get<string>('WA_BOT_AUTOSTART', 'true') !== 'false';
    if (autoStart) {
      this.logger.log('🚀 Initializing WhatsApp Bot Service...');
      // Start connection asynchronously
      this.connectToWhatsApp().catch((err) => {
        this.logger.warn(`Failed initial WA connection: ${err.message}`);
      });
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect or reconnect to WhatsApp Multi-Device
   */
  async connectToWhatsApp() {
    if (this.status === 'CONNECTED' && this.sock) {
      return;
    }

    this.status = 'CONNECTING';

    try {
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }) as any,
        browser: ['SatuUndangan Bot', 'Chrome', '120.0.0'],
        syncFullHistory: false,
      });

      // Save credentials on updates
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'SCAN_QR';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
            });
            this.logger.log('📱 New WhatsApp QR Code generated for scanning');
          } catch (qrErr) {
            this.logger.error('Failed to generate QR data URL', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `WhatsApp connection closed. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`,
          );

          this.status = 'DISCONNECTED';
          this.connectedPhone = null;
          this.connectedName = null;

          if (shouldReconnect) {
            setTimeout(() => this.connectToWhatsApp(), 4000);
          } else {
            // Logged out: wipe session folder
            this.clearSessionFolder();
            this.qrCodeDataUrl = null;
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;

          const userJid = this.sock?.user?.id || '';
          this.connectedPhone = userJid.split(':')[0] || userJid.split('@')[0];
          this.connectedName = this.sock?.user?.name || 'SatuUndangan CS';

          this.logger.log(
            `✅ WhatsApp Bot Connected successfully! Phone: ${this.connectedPhone} (${this.connectedName})`,
          );
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          await this.handleIncomingMessage(msg);
        }
      });
    } catch (err: any) {
      this.status = 'DISCONNECTED';
      this.logger.error(`Error connecting to WhatsApp: ${err.message}`, err.stack);
    }
  }

  /**
   * Process individual incoming WhatsApp message
   */
  private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
    if (!msg.message || !msg.key || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    if (!jid) return;

    // Ignore group chats and status/broadcasts
    if (
      jid.endsWith('@g.us') ||
      jid.includes('@broadcast') ||
      jid === 'status@broadcast'
    ) {
      return;
    }

    // Extract incoming text
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    const trimmed = text.trim();
    if (!trimmed) return;

    this.stats.messagesReceived++;
    const senderNumber = jid.split('@')[0];
    this.logger.log(`📥 Incoming WA from ${senderNumber}: "${trimmed.slice(0, 50)}..."`);

    // Check if user is currently paused for human agent handover
    const pausedUntil = this.pausedContacts.get(jid) || 0;
    if (Date.now() < pausedUntil) {
      this.logger.debug(`User ${senderNumber} is in human handover pause window. Skipping AI.`);
      return;
    }

    // Check anti-spam cooldown (ignore if sent message < 10 seconds ago to prevent double response)
    const lastReply = this.cooldownMap.get(jid) || 0;
    if (Date.now() - lastReply < 10000) {
      this.logger.debug(`Cooldown active for ${senderNumber}. Skipping reply.`);
      return;
    }

    // Check if user wants human admin handover
    const lower = trimmed.toLowerCase();
    const isHandoverRequest =
      lower.includes('admin') ||
      lower.includes('operator') ||
      lower.includes('cs manusia') ||
      lower.includes('bicara admin') ||
      lower.includes('hubungi admin');

    if (isHandoverRequest) {
      // Pause AI for 2 hours for this user so admin can converse uninterrupted
      this.pausedContacts.set(jid, Date.now() + 2 * 60 * 60 * 1000);
      const handoverNotice =
        `Halo Kak! 🙏 Permintaan untuk berbicara dengan Admin telah kami catat.\n\n` +
        `Sistem bot otomatis kami jeda untuk obrolan ini. Tim Customer Care SatuUndangan akan segera membalas chat Kakak secara langsung. Mohon ditunggu ya! 💍✨`;
      await this.sendMessage(jid, handoverNotice);
      return;
    }

    // If AI is disabled, send default friendly greeting menu
    if (!this.isAiEnabled) {
      const defaultMenu =
        `Halo Kak! Terima kasih sudah menghubungi *SatuUndangan.id* 💍✨\n\n` +
        `Saat ini tim Customer Care kami sedang mempersiapkan pesanan. Ada yang bisa kami bantu?\n\n` +
        `1️⃣ *Katalog Desain*: https://satuundangan.id/#templates\n` +
        `2️⃣ *Paket & Harga*: Basic (Rp 49rb), Premium (Rp 79rb), Exclusive (Rp 99rb)\n` +
        `3️⃣ *Coba Gratis*: https://satuundangan.id/create\n` +
        `4️⃣ *Bicara dengan Admin*: Ketik "Admin"\n\n` +
        `Silakan ketik pertanyaan Kakak ya!`;
      await this.sendMessage(jid, defaultMenu);
      this.cooldownMap.set(jid, Date.now());
      return;
    }

    // Generate AI response with Gemini
    try {
      const aiReply = await this.generateGeminiReply(trimmed, senderNumber);
      if (aiReply) {
        await this.sendMessage(jid, aiReply);
        this.stats.aiRepliesGenerated++;
        this.cooldownMap.set(jid, Date.now());
      }
    } catch (err: any) {
      this.logger.error(`Failed to generate AI WA reply: ${err.message}`);
      // Fallback response
      const fallback =
        `Halo Kak! Terima kasih sudah menghubungi *SatuUndangan.id* 💍✨\n\n` +
        `Pesan Kakak sudah kami terima. Tim kami akan segera membantu Kakak. Untuk melihat katalog tema dan mencoba buat undangan gratis, kunjungi: https://satuundangan.id/#templates`;
      await this.sendMessage(jid, fallback);
      this.cooldownMap.set(jid, Date.now());
    }
  }

  /**
   * Send WhatsApp message with typing simulation
   */
  async sendMessage(jid: string, text: string) {
    if (!this.sock || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp Bot is not connected');
    }

    try {
      // Simulate typing presence for natural feeling
      await this.sock.sendPresenceUpdate('composing', jid);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await this.sock.sendPresenceUpdate('paused', jid);

      await this.sock.sendMessage(jid, { text });
      this.stats.messagesReplied++;
    } catch (err: any) {
      this.logger.error(`Error sending message to ${jid}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Gemini AI response generator with fallback models
   */
  async generateGeminiReply(userMessage: string, senderNumber = ''): Promise<string> {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = `Anda adalah Customer Care Virtual ramah dari SatuUndangan.id (platform pembuatan undangan pernikahan digital aesthetic, instan, & modern di Indonesia).
Tugas Anda: Membantu calon pengantin yang mengirim chat WhatsApp ini dengan ramah, sopan, bersahabat, ringkas, dan informatif.

INFORMASI PENTING TENTANG SATUUNDANGAN.ID:
- Fitur Unggulan:
  * Jadi instan dalam 5 menit, bebas revisi sepuasnya tanpa batas.
  * RSVP & Ucapan Doa otomatis terkumpul real-time.
  * QR Code Meja Resepsi (Buku Tamu Digital): Tamu cukup scan QR akrilik di pintu masuk untuk isi buku tamu atau check-in.
  * Amplop Digital / Hadiah Pernikahan QRIS tanpa potongan biaya.
  * Navigasi Peta Lokasi Google Maps, Countdown hari H, Love Story, Galeri Foto & Video, Musik Romantis bebas pilih.
- Pilihan Paket Harga:
  * Paket Basic: Rp 49.000 (Desain modern, fitur esensial)
  * Paket Premium: Rp 79.000 (Paling favorit, pilihan tema adat Nusantara & modern, musik custom)
  * Paket Exclusive: Rp 99.000 (Desain luxury tingkat tinggi, reservasi VIP meja khusus)
- Cara Membuat:
  1. Calon pengantin buka website https://satuundangan.id
  2. Klik "Pilih Desain" atau "Buat Undangan"
  3. Isi data pengantin & tanggal acara
  4. Undangan langsung jadi dan bisa dicoba preview GRATIS sebelum bayar. Bayar hanya ketika siap disebarkan.
- Metode Pembayaran: QRIS (GoPay, OVO, ShopeePay, DANA) & Transfer Bank Otomatis (BCA, Mandiri, BRI, BNI).

ATURAN MENJAWAB:
1. Format teks WhatsApp: Gunakan format WhatsApp seperti *bold* untuk poin penting. Jangan gunakan markdown heading (### atau **).
2. Panjang jawaban: Pendek dan nyaman dibaca di layar HP (maksimal 2 - 3 paragraf pendek atau poin-poin rapi).
3. Gunakan emotikon pernikahan yang manis (💍, ✨, 👰, 🤵, 💌, 🙏).
4. Sertakan link relevan:
   - Katalog Desain: https://satuundangan.id/#templates
   - Buat Undangan: https://satuundangan.id/create
5. Jika pengguna menanyakan hal teknis yang rumit, kendala pembayaran, atau ingin kustomisasi khusus di luar sistem, sarankan untuk ketik "Admin" agar disambungkan ke tim CS manusia.

Pesan dari pengguna WhatsApp:
"${userMessage}"

Balas chat di atas langsung sebagai Customer Care SatuUndangan:`;

    const models = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
    ];

    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 600,
            },
          },
          {
            timeout: 25000,
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const candidates = response.data?.candidates;
        const rawText = candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return rawText.trim();
        }
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`Model ${model} failed for WA reply: ${err.message}. Trying next fallback.`);
      }
    }

    throw new Error(`Gemini AI failed: ${lastError?.message}`);
  }

  /**
   * Get bot status for Admin Dashboard
   */
  getStatus() {
    return {
      status: this.status,
      phoneNumber: this.connectedPhone,
      botName: this.connectedName,
      qrCodeUrl: this.qrCodeDataUrl,
      isAiEnabled: this.isAiEnabled,
      hasSession: fs.existsSync(path.join(this.sessionDir, 'creds.json')),
      stats: this.stats,
    };
  }

  /**
   * Toggle AI auto-reply on/off
   */
  toggleAi(enabled?: boolean) {
    this.isAiEnabled = enabled !== undefined ? enabled : !this.isAiEnabled;
    return { isAiEnabled: this.isAiEnabled };
  }

  /**
   * Reset / Logout session
   */
  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
      }
    } catch {}

    this.status = 'DISCONNECTED';
    this.connectedPhone = null;
    this.connectedName = null;
    this.qrCodeDataUrl = null;
    this.clearSessionFolder();

    this.logger.log('WhatsApp Bot logged out and session wiped.');
    return { success: true, message: 'WhatsApp session disconnected' };
  }

  /**
   * Force disconnect & cleanup
   */
  async disconnect() {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
    this.status = 'DISCONNECTED';
  }

  private clearSessionFolder() {
    if (fs.existsSync(this.sessionDir)) {
      try {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(`Failed to clear session folder: ${err}`);
      }
    }
  }
}
