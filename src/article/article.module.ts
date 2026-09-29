import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { User } from '../user/user.entity';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { AdminGuard } from '../auth/guards/admin.guard';

import { ArticleBotService } from './article-bot.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article, User])],
  controllers: [ArticleController],
  providers: [ArticleService, ArticleBotService, AdminGuard],
  exports: [ArticleService, ArticleBotService],
})
export class ArticleModule {}
