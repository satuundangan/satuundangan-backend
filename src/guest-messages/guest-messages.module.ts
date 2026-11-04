import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestMessage } from './guest-message.entity';
import { GuestMessagesService } from './guest-messages.service';
import { GuestMessagesController } from './guest-messages.controller';
import { NormalizeGuestMessageMiddleware } from './middleware/normalize-guest-message.middleware';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([GuestMessage, Invitation, Guest, User])],
  controllers: [GuestMessagesController],
  providers: [GuestMessagesService, AdminGuard],
  exports: [GuestMessagesService],
})
export class GuestMessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NormalizeGuestMessageMiddleware)
      .forRoutes({ path: 'guest-messages', method: RequestMethod.POST });
  }
}
