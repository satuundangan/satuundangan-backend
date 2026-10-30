import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateService } from './affiliate.service';
import { AffiliateJobRun } from './entities/affiliate-job-run.entity';

@Injectable()
export class AffiliateScheduler {
  private readonly logger = new Logger(AffiliateScheduler.name);

  constructor(
    private readonly affiliateService: AffiliateService,
    @InjectRepository(AffiliateJobRun)
    private readonly jobRunRepo: Repository<AffiliateJobRun>,
  ) {}

  /**
   * COM-05: daily transition PENDING -> CLEARED after `clearingPeriodDays` elapsed.
   * Runs at 02:00 server time daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'affiliate.clearPendingCommissions',
    timeZone: 'Asia/Jakarta',
  })
  async handleClearPending(): Promise<void> {
    const run = await this.jobRunRepo.save(
      this.jobRunRepo.create({
        jobName: 'affiliate.clearPendingCommissions',
        startedAt: new Date(),
        finishedAt: null,
        succeeded: null,
        affectedCount: null,
        errorMessage: null,
      }),
    );
    try {
      const count = await this.affiliateService.clearPendingCommissions();
      await this.jobRunRepo.update(run.id, {
        finishedAt: new Date(),
        succeeded: true,
        affectedCount: count,
      });
      this.logger.log(
        `Cron clearPendingCommissions completed cleared=${count}`,
      );
    } catch (err) {
      await this.jobRunRepo.update(run.id, {
        finishedAt: new Date(),
        succeeded: false,
        affectedCount: 0,
        errorMessage: String((err as Error)?.message || err).slice(0, 1000),
      });
      this.logger.error(`Cron clearPendingCommissions failed`, err as Error);
    }
  }

  /**
   * TIER-03: daily downgrade tier for resellers inactive beyond `inactivityDowngradeMonths`.
   * Runs at 03:00 server time daily (offset from clearing job to avoid simultaneous DB load).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'affiliate.downgradeInactive',
    timeZone: 'Asia/Jakarta',
  })
  async handleDowngradeInactive(): Promise<void> {
    const run = await this.jobRunRepo.save(
      this.jobRunRepo.create({
        jobName: 'affiliate.downgradeInactive',
        startedAt: new Date(),
        finishedAt: null,
        succeeded: null,
        affectedCount: null,
        errorMessage: null,
      }),
    );
    try {
      const count = await this.affiliateService.downgradeInactiveResellers();
      await this.jobRunRepo.update(run.id, {
        finishedAt: new Date(),
        succeeded: true,
        affectedCount: count,
      });
      this.logger.log(
        `Cron downgradeInactiveResellers completed downgraded=${count}`,
      );
    } catch (err) {
      await this.jobRunRepo.update(run.id, {
        finishedAt: new Date(),
        succeeded: false,
        affectedCount: 0,
        errorMessage: String((err as Error)?.message || err).slice(0, 1000),
      });
      this.logger.error(`Cron downgradeInactiveResellers failed`, err as Error);
    }
  }
}
