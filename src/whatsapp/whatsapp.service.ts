import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import slugify from 'slugify';
import { Repository } from 'typeorm';
import { CreateInvitationDto } from '../invitation/dto/create-invitation.dto';
import { InvitationService } from '../invitation/invitation.service';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';
import {
  WhatsappBotSession,
  WhatsappBotStep,
} from './whatsapp-bot-session.entity';
import {
  InvitationBotDraft,
  WhatsappIncomingMessage,
  WhatsappWebhookBody,
} from './whatsapp.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsappBotSession)
    private readonly sessionRepo: Repository<WhatsappBotSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
    private readonly invitationService: InvitationService,
  ) {}

  verifyWebhook(mode: string, verifyToken: string): boolean {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    return Boolean(
      expectedToken && mode === 'subscribe' && verifyToken === expectedToken,
    );
  }

  async handleWebhook(body: WhatsappWebhookBody): Promise<void> {
    const messages = this.extractMessages(body);

    for (const message of messages) {
      await this.handleIncomingMessage(message);
    }
  }

  private extractMessages(
    body: WhatsappWebhookBody,
  ): WhatsappIncomingMessage[] {
    return (
      body.entry?.flatMap(
        (entry) =>
          entry.changes?.flatMap((change) => change.value?.messages || []) ||
          [],
      ) || []
    );
  }

  private async handleIncomingMessage(
    message: WhatsappIncomingMessage,
  ): Promise<void> {
    if (!message.from || !message.id) return;

    const text = this.getMessageText(message).trim();
    if (!text) {
      await this.sendText(
        message.from,
        'Saat ini bot hanya menerima pesan teks. Ketik "mulai" untuk membuat undangan.',
      );
      return;
    }

    const session = await this.getOrCreateSession(message.from);
    if (session.lastMessageId === message.id) return;

    session.lastMessageId = message.id;

    if (this.isRestartCommand(text)) {
      session.step = WhatsappBotStep.GROOM_NAME;
      session.draft = {};
      session.invitationId = null;
      session.invitationSlug = null;
      session.completedAt = null;
      await this.sessionRepo.save(session);
      await this.sendText(
        message.from,
        this.getPrompt(WhatsappBotStep.GROOM_NAME),
      );
      return;
    }

    if (this.isHelpCommand(text)) {
      await this.sendText(
        message.from,
        [
          'Bot SatuUndangan bisa membuat link undangan gratis dari WhatsApp.',
          'Ketik "mulai" untuk mulai ulang.',
          'Ketik "-" kalau ingin melewati pertanyaan opsional.',
        ].join('\n'),
      );
      await this.sessionRepo.save(session);
      return;
    }

    const response = await this.advanceSession(session, text);
    await this.sessionRepo.save(session);
    await this.sendText(message.from, response);
  }

  private async getOrCreateSession(
    phoneNumber: string,
  ): Promise<WhatsappBotSession> {
    const existing = await this.sessionRepo.findOne({ where: { phoneNumber } });
    if (existing) return existing;

    return this.sessionRepo.save(
      this.sessionRepo.create({
        phoneNumber,
        step: WhatsappBotStep.GROOM_NAME,
        draft: {},
      }),
    );
  }

  private async advanceSession(
    session: WhatsappBotSession,
    rawText: string,
  ): Promise<string> {
    const text = rawText.trim();
    const draft = { ...(session.draft || {}) } as InvitationBotDraft;

    if (session.step === WhatsappBotStep.COMPLETED) {
      return [
        'Undangan kamu sudah dibuat.',
        session.invitationSlug
          ? `Link: ${this.buildInvitationUrl(session.invitationSlug)}`
          : '',
        'Ketik "mulai" untuk membuat undangan baru.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (session.step === WhatsappBotStep.GROOM_NAME) {
      draft.groomName = text;
      session.step = WhatsappBotStep.BRIDE_NAME;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.BRIDE_NAME) {
      draft.brideName = text;
      session.step = WhatsappBotStep.EVENT_DATETIME;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.EVENT_DATETIME) {
      const parsedDate = this.parseDateTime(text);
      if (!parsedDate) {
        return 'Format tanggal belum terbaca. Contoh: 20-12-2026 09:00';
      }

      draft.eventDateTime = parsedDate.toISOString();
      session.step = WhatsappBotStep.EVENT_LOCATION;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.EVENT_LOCATION) {
      draft.eventLocation = text;
      session.step = WhatsappBotStep.MAP_URL;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.MAP_URL) {
      draft.mapUrl = this.normalizeOptionalText(text);
      session.step = WhatsappBotStep.BRIDE_PARENTS;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.BRIDE_PARENTS) {
      draft.brideParents = this.normalizeOptionalText(text);
      session.step = WhatsappBotStep.GROOM_PARENTS;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.GROOM_PARENTS) {
      draft.groomParents = this.normalizeOptionalText(text);
      session.step = WhatsappBotStep.QUOTE_TEXT;
      session.draft = draft;
      return this.getPrompt(session.step);
    }

    if (session.step === WhatsappBotStep.QUOTE_TEXT) {
      draft.quoteText = this.normalizeOptionalText(text);
      session.step = WhatsappBotStep.CONFIRMATION;
      session.draft = draft;
      return this.buildConfirmationMessage(draft);
    }

    if (session.step === WhatsappBotStep.CONFIRMATION) {
      if (!this.isYes(text)) {
        session.step = WhatsappBotStep.GROOM_NAME;
        session.draft = {};
        return `Baik, kita ulang dari awal.\n${this.getPrompt(session.step)}`;
      }

      const invitation = await this.createFreeInvitation(draft);
      session.step = WhatsappBotStep.COMPLETED;
      session.invitationId = invitation.id;
      session.invitationSlug = invitation.slug;
      session.completedAt = new Date();

      return [
        'Undangan gratis kamu sudah jadi.',
        `Link preview: ${this.buildInvitationUrl(invitation.slug)}`,
        'Ketik "mulai" kalau ingin membuat undangan baru.',
      ].join('\n');
    }

    session.step = WhatsappBotStep.GROOM_NAME;
    session.draft = {};
    return this.getPrompt(session.step);
  }

  private getPrompt(step: WhatsappBotStep): string {
    const prompts: Record<WhatsappBotStep, string> = {
      [WhatsappBotStep.GROOM_NAME]:
        'Halo, ketik nama mempelai pria untuk mulai membuat undangan.',
      [WhatsappBotStep.BRIDE_NAME]: 'Ketik nama mempelai wanita.',
      [WhatsappBotStep.EVENT_DATETIME]:
        'Ketik tanggal dan jam acara. Contoh: 20-12-2026 09:00',
      [WhatsappBotStep.EVENT_LOCATION]:
        'Ketik lokasi acara. Contoh: Gedung Serbaguna, Jakarta',
      [WhatsappBotStep.MAP_URL]:
        'Kirim link Google Maps lokasi acara, atau ketik "-" untuk lewati.',
      [WhatsappBotStep.BRIDE_PARENTS]:
        'Ketik nama orang tua mempelai wanita, atau "-" untuk lewati.',
      [WhatsappBotStep.GROOM_PARENTS]:
        'Ketik nama orang tua mempelai pria, atau "-" untuk lewati.',
      [WhatsappBotStep.QUOTE_TEXT]:
        'Ketik quote pembuka undangan, atau "-" untuk pakai default.',
      [WhatsappBotStep.CONFIRMATION]:
        'Ketik "ya" untuk membuat undangan, atau "ulang" untuk mengisi ulang.',
      [WhatsappBotStep.COMPLETED]:
        'Undangan sudah dibuat. Ketik "mulai" untuk membuat undangan baru.',
    };

    return prompts[step];
  }

  private buildConfirmationMessage(draft: InvitationBotDraft): string {
    return [
      'Cek data undangan:',
      `Mempelai: ${draft.groomName} & ${draft.brideName}`,
      `Tanggal: ${this.formatDateForChat(draft.eventDateTime)}`,
      `Lokasi: ${draft.eventLocation}`,
      draft.mapUrl ? `Maps: ${draft.mapUrl}` : null,
      draft.brideParents ? `Orang tua wanita: ${draft.brideParents}` : null,
      draft.groomParents ? `Orang tua pria: ${draft.groomParents}` : null,
      '',
      this.getPrompt(WhatsappBotStep.CONFIRMATION),
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  private async createFreeInvitation(draft: InvitationBotDraft) {
    const botUser = await this.getOrCreateBotUser();
    const template = await this.findDefaultTemplate();
    const coupleName = `${draft.groomName} & ${draft.brideName}`;
    const eventDateTime = draft.eventDateTime || new Date().toISOString();
    const templateSlug =
      template?.slug ||
      process.env.WHATSAPP_BOT_DEFAULT_TEMPLATE_SLUG ||
      'dark-elegant';

    const dto: CreateInvitationDto = {
      title: `Undangan ${coupleName}`,
      slug: this.buildBaseSlug(draft),
      coupleName,
      groomName: draft.groomName || 'Mempelai Pria',
      brideName: draft.brideName || 'Mempelai Wanita',
      templateName: templateSlug,
      isPublished: true,
      quoteSource: 'bebas',
      quoteType: 'bebas',
      quoteText:
        draft.quoteText ||
        'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu.',
      loveStory: [],
      musicChoice: 'default1.mp3',
      isCustomMusic: false,
      audioStart: 0,
      audioEnd: 0,
      bridePhotoUrl: '',
      groomPhotoUrl: '',
      photoCoupleUrl: '',
      videoPrewedding: '',
      dateTime: eventDateTime,
      akadLocation: {
        mapUrl: draft.mapUrl || '',
        description: draft.eventLocation || '',
        dateTime: eventDateTime,
      },
      resepsiLocation: {
        mapUrl: draft.mapUrl || '',
        description: draft.eventLocation || '',
        dateTime: eventDateTime,
      },
      isSingleEvent: true,
      mergeEvents: true,
      encryptedGuestName: false,
      floorPlanImageUrl: '',
      menu: { title: 'Menu Makanan', items: [] },
      galleryImages: [],
      giftDeliveryAddress: [],
      eWalletLink: [],
      bankAccounts: [],
      socialMedia: {},
      socialMediaBrides: {},
      socialMediaGroom: {},
      parents: {
        brideParents: draft.brideParents || '',
        groomParents: draft.groomParents || '',
      },
      turutMengundang: '',
      liveStreamingLink: '',
      footerText:
        'Merupakan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir.',
      enableCover: true,
      healthProtocol: true,
      selectedSections: ['cover', 'couple', 'event', 'quote', 'guest-message'],
      enableGuestMessage: true,
      templateDesignId: template?.id || null,
      whatsappMessageTemplate:
        'Halo [GuestName], berikut link undangan kami: [Link]',
    } as CreateInvitationDto;

    return this.invitationService.create(dto, botUser);
  }

  private async getOrCreateBotUser(): Promise<User> {
    const email =
      process.env.WHATSAPP_BOT_USER_EMAIL || 'whatsapp-bot@satuundangan.local';
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) return existing;

    const user = this.userRepo.create({
      name: 'WhatsApp Bot',
      email,
      provider: 'whatsapp-bot',
      password: null,
      isApproved: true,
      emailVerifiedAt: new Date(),
    });

    return this.userRepo.save(user);
  }

  private async findDefaultTemplate(): Promise<TemplateDesign | null> {
    const defaultTemplateId = Number(
      process.env.WHATSAPP_BOT_DEFAULT_TEMPLATE_ID,
    );
    if (Number.isInteger(defaultTemplateId) && defaultTemplateId > 0) {
      const template = await this.templateRepo.findOne({
        where: { id: defaultTemplateId, isPublished: true },
      });
      if (template) return template;
    }

    const defaultSlug =
      process.env.WHATSAPP_BOT_DEFAULT_TEMPLATE_SLUG || 'dark-elegant';
    const bySlug = await this.templateRepo.findOne({
      where: { slug: defaultSlug, isPublished: true },
    });
    if (bySlug) return bySlug;

    return this.templateRepo.findOne({
      where: { isPublished: true, isPremium: false },
      order: { id: 'ASC' },
    });
  }

  private async sendText(to: string, body: string): Promise<void> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      this.logger.warn(
        `WhatsApp credentials are not configured. Skipping reply to ${to}: ${body}`,
      );
      return;
    }

    try {
      const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

      await axios.post(
        `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${message}`);
    }
  }

  private getMessageText(message: WhatsappIncomingMessage): string {
    return (
      message.text?.body ||
      message.button?.text ||
      message.button?.payload ||
      message.interactive?.button_reply?.title ||
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.title ||
      message.interactive?.list_reply?.id ||
      ''
    );
  }

  private parseDateTime(input: string): Date | null {
    const normalized = input.trim();
    const direct = new Date(normalized);
    if (!Number.isNaN(direct.getTime())) return direct;

    const match = normalized.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?$/,
    );
    if (!match) return null;

    const [, day, month, year, hour = '0', minute = '0'] = match;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeOptionalText(value: string): string {
    const trimmed = value.trim();
    return trimmed === '-' ? '' : trimmed;
  }

  private isRestartCommand(value: string): boolean {
    return ['mulai', 'start', 'reset', 'ulang'].includes(value.toLowerCase());
  }

  private isHelpCommand(value: string): boolean {
    return ['help', 'bantuan', '?'].includes(value.toLowerCase());
  }

  private isYes(value: string): boolean {
    return ['ya', 'y', 'yes', 'ok', 'oke', 'lanjut', 'buat'].includes(
      value.toLowerCase(),
    );
  }

  private buildBaseSlug(draft: InvitationBotDraft): string {
    const couple = `${draft.groomName || 'mempelai'}-${draft.brideName || 'undangan'}`;
    return slugify(couple, {
      lower: true,
      strict: true,
    });
  }

  private buildInvitationUrl(slug: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${frontendUrl.replace(/\/$/, '')}/${slug}`;
  }

  private formatDateForChat(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(date);
  }
}
