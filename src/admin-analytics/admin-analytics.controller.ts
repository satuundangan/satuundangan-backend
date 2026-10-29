import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get()
  getReport(@Query() query: DashboardQueryDto) { return this.analytics.getReport(query); }
}
