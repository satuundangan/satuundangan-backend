import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { WithdrawRequest } from './entities/withdraw-request.entity';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { AffiliateSeed } from './affiliate.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateProfile,
      CommissionTransaction,
      WithdrawRequest,
      TierConfig,
      SystemConfig,
    ]),
  ],
  providers: [AffiliateSeed],
  controllers: [],
  exports: [],
})
export class AffiliateModule {}
