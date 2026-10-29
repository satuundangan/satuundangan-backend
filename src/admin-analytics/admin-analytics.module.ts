import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AdminAnalyticsService, AdminGuard],
  controllers: [AdminAnalyticsController],
})
export class AdminAnalyticsModule {}
