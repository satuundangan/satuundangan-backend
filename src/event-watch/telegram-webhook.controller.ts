import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { EventWatchService } from './event-watch.service';

@ApiExcludeController()
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly eventWatch: EventWatchService) {}

  @Get('webhook')
  getWebhookInfo() {
    return {
      ok: true,
      service: 'SatuUndangan Telegram Bot Webhook',
      status: 'active',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    return this.eventWatch.handleTelegramWebhook(body, secretToken);
  }
}
