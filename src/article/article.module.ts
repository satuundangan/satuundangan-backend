import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { User } from '../user/user.entity';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { AdminGuard } from '../auth/guards/admin.guard';

import { ArticleBotService } from './article-bot.service';
import { ActivityLog } from '../admin/entities/activity-log.entity';
import { AdminAnalyticsModule } from '../admin-analytics/admin-analytics.module';
import { ArticleEditorialService } from './article-editorial.service';
import { LinkCheckService } from './link-check.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article, User, ActivityLog]), AdminAnalyticsModule],
  controllers: [ArticleController],
  providers: [ArticleService, ArticleBotService, ArticleEditorialService, LinkCheckService, AdminGuard],
  exports: [ArticleService, ArticleBotService],
})
export class ArticleModule {}
