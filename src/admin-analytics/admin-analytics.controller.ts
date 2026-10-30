import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsReportsService } from './analytics-reports.service';

export class CreateAnnotationDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsIn(['release', 'campaign', 'note']) kind: 'release' | 'campaign' | 'note';
  @IsString() @MinLength(3) @MaxLength(200) label: string;
}

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AdminAnalyticsService,
    private readonly reports: AnalyticsReportsService,
  ) {}

  @Get()
  getReport(@Query() query: DashboardQueryDto) { return this.analytics.getReport(query); }

  @Get('funnel')
  funnel(@Query() query: DashboardQueryDto) { return this.reports.funnel(query); }

  @Get('purchases')
  purchases(@Query() query: DashboardQueryDto) { return this.reports.purchases(query); }

  @Get('attribution')
  attribution(@Query() query: DashboardQueryDto) { return this.reports.attribution(query); }

  @Get('quality')
  quality() { return this.reports.quality(); }

  @Get('insights')
  insights(@Query() query: DashboardQueryDto) { return this.reports.listInsights(query); }

  @Post('insights/refresh')
  refreshInsights(@Query() query: DashboardQueryDto) { return this.reports.refreshInsights(query); }

  @Post('annotations')
  addAnnotation(@Body() dto: CreateAnnotationDto, @Req() req: { user: { id: number } }) {
    return this.reports.addAnnotation(dto, req.user.id);
  }

  @Delete('annotations/:id')
  removeAnnotation(@Param('id', ParseIntPipe) id: number) { return this.reports.removeAnnotation(id); }
}
