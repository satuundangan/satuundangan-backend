import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Invitation } from '../invitation/invitation.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation, GuestMessage])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
