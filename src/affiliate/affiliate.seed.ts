import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { AffiliateTier } from './types/affiliate.type';

@Injectable()
export class AffiliateSeed implements OnModuleInit {
  private readonly logger = new Logger(AffiliateSeed.name);

  constructor(
    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,
    @InjectRepository(SystemConfig)
    private readonly systemRepo: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    await this.seedTierConfigs();
    await this.seedSystemConfigs();
  }

  private async seedTierConfigs() {
    const existing = await this.tierRepo.count();
    if (existing > 0) {
      this.logger.log(`TierConfig already seeded (${existing} rows) — skip`);
      return;
    }
    await this.tierRepo.save([
      { tier: AffiliateTier.BRONZE, minSales: 0, commissionRate: 0.10 },
      { tier: AffiliateTier.SILVER, minSales: 5, commissionRate: 0.15 },
      { tier: AffiliateTier.GOLD, minSales: 15, commissionRate: 0.20 },
    ]);
    this.logger.log('TierConfig seeded with default Bronze/Silver/Gold rows');
  }

  private async seedSystemConfigs() {
    const defaults: Array<{ configKey: string; configValue: string; description: string }> = [
      {
        configKey: 'minWithdrawalAmount',
        configValue: '100000',
        description: 'Minimum withdrawal amount in IDR (ADM-06)',
      },
      {
        configKey: 'clearingPeriodDays',
        configValue: '7',
        description: 'Days from PENDING to CLEARED (ADM-07, COM-05)',
      },
      {
        configKey: 'inactivityDowngradeMonths',
        configValue: '3',
        description: 'Months of zero sales before tier downgrade (ADM-08, TIER-03)',
      },
    ];
    for (const def of defaults) {
      const found = await this.systemRepo.findOne({ where: { configKey: def.configKey } });
      if (!found) {
        await this.systemRepo.save(def);
        this.logger.log(`SystemConfig seeded ${def.configKey}=${def.configValue}`);
      }
    }
  }
}
