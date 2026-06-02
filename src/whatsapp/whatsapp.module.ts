import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationModule } from '../invitation/invitation.module';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';
import { WhatsappBotSession } from './whatsapp-bot-session.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappBotSession, User, TemplateDesign]),
    InvitationModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
