import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { EventWatchService } from './event-watch.service';
import { LocalhostOnlyGuard } from './localhost-only.guard';

// Consumed by .github/workflows/deploy.yml via `docker exec` (deploy gate).
@ApiExcludeController()
@Controller('internal')
@UseGuards(LocalhostOnlyGuard)
export class EventWatchInternalController {
  constructor(private readonly service: EventWatchService) {}

  @Get('upcoming-events')
  getUpcoming(
    @Query('days', new DefaultValuePipe(1), ParseIntPipe) days: number,
  ) {
    if (days < 0 || days > 60) {
      throw new BadRequestException('days must be an integer between 0 and 60');
    }
    return this.service.getDeployGateEvents(days);
  }
}
