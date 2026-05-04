import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AffiliateService } from './affiliate.service';

@Injectable()
export class AffiliateScheduler {
  private readonly logger = new Logger(AffiliateScheduler.name);

  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * COM-05: daily transition PENDING -> CLEARED after `clearingPeriodDays` elapsed.
   * Runs at 02:00 server time daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'affiliate.clearPendingCommissions' })
  async handleClearPending(): Promise<void> {
    try {
      const count = await this.affiliateService.clearPendingCommissions();
      this.logger.log(`Cron clearPendingCommissions completed cleared=${count}`);
    } catch (err) {
      this.logger.error(`Cron clearPendingCommissions failed`, err as Error);
    }
  }

  /**
   * TIER-03: daily downgrade tier for resellers inactive beyond `inactivityDowngradeMonths`.
   * Runs at 03:00 server time daily (offset from clearing job to avoid simultaneous DB load).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'affiliate.downgradeInactive' })
  async handleDowngradeInactive(): Promise<void> {
    try {
      const count = await this.affiliateService.downgradeInactiveResellers();
      this.logger.log(`Cron downgradeInactiveResellers completed downgraded=${count}`);
    } catch (err) {
      this.logger.error(`Cron downgradeInactiveResellers failed`, err as Error);
    }
  }
}
