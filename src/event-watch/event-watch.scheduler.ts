import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EventWatchService } from './event-watch.service';

@Injectable()
export class EventWatchScheduler {
  private readonly logger = new Logger(EventWatchScheduler.name);

  constructor(
    private readonly service: EventWatchService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * *', {
    name: 'eventWatch.dailyDigest',
    timeZone: 'Asia/Jakarta',
  })
  async handleDailyDigest(): Promise<void> {
    if (this.config.get<string>('EVENT_WATCH_ENABLED') !== 'true') {
      this.logger.log(
        'eventWatch.dailyDigest skipped (EVENT_WATCH_ENABLED != true)',
      );
      return;
    }
    try {
      // 1. Send daily morning system health report
      const healthResult = await this.service.runDailyHealthReport();
      this.logger.log(
        `eventWatch.dailyHealth done: sent=${healthResult.sent} channel=${healthResult.channel}`,
      );

      // 2. Send customer events digest (H-7/H-1/Hari-H)
      const eventResult = await this.service.runDailyDigest();
      this.logger.log(
        `eventWatch.dailyDigest done: sent=${eventResult.sent} count=${eventResult.count} channel=${eventResult.channel}`,
      );
    } catch (err) {
      this.logger.error('eventWatch.dailyDigest failed', err as Error);
    }
  }
}
