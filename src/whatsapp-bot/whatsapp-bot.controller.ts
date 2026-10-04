import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WhatsappBotService } from './whatsapp-bot.service';

@ApiTags('Admin WhatsApp Bot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/whatsapp-bot')
export class WhatsappBotController {
  constructor(private readonly botService: WhatsappBotService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get WhatsApp bot connection status, QR code, and stats' })
  getStatus() {
    return this.botService.getStatus();
  }

  @Post('connect')
  @ApiOperation({ summary: 'Initiate WhatsApp connection and generate QR code' })
  async connect() {
    await this.botService.connectToWhatsApp();
    return this.botService.getStatus();
  }

  @Post('logout')
  @ApiOperation({ summary: 'Disconnect WhatsApp session and wipe credentials' })
  async logout() {
    return this.botService.logout();
  }

  @Post('toggle-ai')
  @ApiOperation({ summary: 'Toggle Gemini AI auto-reply on/off' })
  toggleAi(@Body('enabled') enabled?: boolean) {
    return this.botService.toggleAi(enabled);
  }

  @Post('test-ai')
  @ApiOperation({ summary: 'Simulate Gemini AI response for a test question' })
  async testAiResponse(@Body('message') message: string) {
    if (!message || !message.trim()) {
      throw new BadRequestException('Pesan pengujian tidak boleh kosong');
    }
    const reply = await this.botService.generateGeminiReply(message.trim(), 'TEST-USER');
    return {
      query: message,
      reply,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post('send-message')
  @ApiOperation({ summary: 'Send a manual test message to specific phone number' })
  async sendMessage(
    @Body('phone') phone: string,
    @Body('message') message: string,
  ) {
    if (!phone || !message) {
      throw new BadRequestException('Nomor telepon dan pesan wajib diisi');
    }

    // Sanitize phone number to WhatsApp JID
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.startsWith('0')) {
      sanitized = '62' + sanitized.slice(1);
    } else if (sanitized.startsWith('8')) {
      sanitized = '62' + sanitized;
    }
    const jid = `${sanitized}@s.whatsapp.net`;

    await this.botService.sendMessage(jid, message);
    return { success: true, target: jid, message: 'Pesan berhasil dikirim' };
  }
}
