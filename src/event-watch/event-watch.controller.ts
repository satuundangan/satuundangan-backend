import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EventWatchService } from './event-watch.service';

// `upcoming-events` is not in the admin role matrix, so it is superadmin-only
// ("closed by default") via canAccessAdminPath.
@ApiTags('Admin - Event Watch')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class EventWatchController {
  constructor(private readonly service: EventWatchService) {}

  @Get('upcoming-events')
  getUpcoming(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    if (days < 0 || days > 60) {
      throw new BadRequestException('days must be an integer between 0 and 60');
    }
    return this.service.getUpcomingEvents(days);
  }

  @Post('event-watch/test-message')
  sendTestMessage() {
    return this.service.sendTestMessage();
  }
}
