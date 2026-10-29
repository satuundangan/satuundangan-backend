import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Payment } from '../payment/payment.entity';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsReportsService } from './analytics-reports.service';
import { AnalyticsAnnotation, AnalyticsInsight } from './analytics-insight.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Invitation, Payment, AnalyticsInsight, AnalyticsAnnotation])],
  providers: [AdminAnalyticsService, AnalyticsReportsService, AdminGuard],
  controllers: [AdminAnalyticsController],
})
export class AdminAnalyticsModule {}
