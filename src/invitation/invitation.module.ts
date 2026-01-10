import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { InvitationActivity } from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invitation,
      Guest,
      InvitationActivity,
      TemplateDesign,
    ]),
  ],
  providers: [InvitationService],
  controllers: [InvitationController],
  exports: [InvitationService],
})
export class InvitationModule {}
