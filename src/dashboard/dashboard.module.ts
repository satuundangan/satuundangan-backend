import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Invitation } from '../invitation/invitation.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { InvitationActivity } from './invitation-activity.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invitation,
      GuestMessage,
      InvitationActivity,
      Guest,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
