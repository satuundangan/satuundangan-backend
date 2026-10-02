import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { InvitationActivity } from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';
import { AffiliateProfile } from '../affiliate/entities/affiliate-profile.entity';
import { Payment } from '../payment/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invitation,
      Guest,
      InvitationActivity,
      TemplateDesign,
      User,
      AffiliateProfile,
      Payment,
    ]),
  ],
  providers: [InvitationService],
  controllers: [InvitationController],
  exports: [InvitationService],
})
export class InvitationModule {}
