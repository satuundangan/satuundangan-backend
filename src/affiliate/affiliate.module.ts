import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { WithdrawRequest } from './entities/withdraw-request.entity';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { Payment } from '../payment/payment.entity';
import { AffiliateSeed } from './affiliate.seed';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateProfile,
      CommissionTransaction,
      WithdrawRequest,
      TierConfig,
      SystemConfig,
      Payment,
    ]),
  ],
  providers: [AffiliateSeed, AffiliateService],
  controllers: [AffiliateController],
  exports: [AffiliateService],
})
export class AffiliateModule {}
