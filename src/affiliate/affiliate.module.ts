import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { WithdrawRequest } from './entities/withdraw-request.entity';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { AffiliateConfigAudit } from './entities/affiliate-config-audit.entity';
import { AffiliateJobRun } from './entities/affiliate-job-run.entity';
import { Payment } from '../payment/payment.entity';
import { User } from '../user/user.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateConfigService } from './affiliate-config.service';
import { AffiliateController } from './affiliate.controller';
import { AdminAffiliateController } from './admin-affiliate.controller';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AffiliateScheduler } from './affiliate.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateProfile,
      CommissionTransaction,
      WithdrawRequest,
      TierConfig,
      SystemConfig,
      AffiliateConfigAudit,
      AffiliateJobRun,
      Payment,
      User,
    ]),
  ],
  providers: [
    AffiliateService,
    AffiliateScheduler,
    AffiliateConfigService,
    EmailVerifiedGuard,
    AdminGuard,
  ],
  controllers: [AffiliateController, AdminAffiliateController],
  exports: [AffiliateService],
})
export class AffiliateModule {}
