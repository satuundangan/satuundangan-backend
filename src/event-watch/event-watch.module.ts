import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { WhatsappBotModule } from '../whatsapp-bot/whatsapp-bot.module';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EventWatchService } from './event-watch.service';
import { EventWatchScheduler } from './event-watch.scheduler';
import { EventWatchController } from './event-watch.controller';
import { EventWatchInternalController } from './event-watch-internal.controller';
import { LocalhostOnlyGuard } from './localhost-only.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, User]),
    WhatsappBotModule,
    AuthModule,
  ],
  controllers: [EventWatchController, EventWatchInternalController],
  providers: [
    EventWatchService,
    EventWatchScheduler,
    AdminGuard,
    LocalhostOnlyGuard,
  ],
})
export class EventWatchModule {}
