import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappBotController } from './whatsapp-bot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [WhatsappBotController],
  providers: [WhatsappBotService],
  exports: [WhatsappBotService],
})
export class WhatsappBotModule {}
