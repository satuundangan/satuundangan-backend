import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminHealthService } from '../admin/admin-health.service';
import { EventWatchService } from './event-watch.service';
import { EventWatchScheduler } from './event-watch.scheduler';
import { EventWatchController } from './event-watch.controller';
import { EventWatchInternalController } from './event-watch-internal.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LocalhostOnlyGuard } from './localhost-only.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation, User]), AuthModule],
  controllers: [
    EventWatchController,
    EventWatchInternalController,
    TelegramWebhookController,
  ],
  providers: [
    EventWatchService,
    EventWatchScheduler,
    AdminHealthService,
    AdminGuard,
    LocalhostOnlyGuard,
  ],
})
export class EventWatchModule {}
