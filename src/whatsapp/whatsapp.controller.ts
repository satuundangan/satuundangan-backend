import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookBody } from './whatsapp.types';

@Controller('whatsapp/webhook')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (this.whatsappService.verifyWebhook(mode, verifyToken)) {
      return challenge;
    }

    throw new ForbiddenException('Invalid WhatsApp webhook verify token');
  }

  @Post()
  @HttpCode(200)
  async receiveWebhook(@Body() body: WhatsappWebhookBody) {
    await this.whatsappService.handleWebhook(body);
    return { ok: true };
  }
}
