import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleBotService } from './article-bot.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';
import { ApiTags } from '@nestjs/swagger';
import { RestoreArticleRevisionDto } from './dto/restore-article-revision.dto';
import { ArticleEditorialService } from './article-editorial.service';
import { DashboardQueryDto } from '../admin/dto/dashboard-query.dto';

@ApiTags('Articles')
@Controller()
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleBotService: ArticleBotService,
    private readonly editorial: ArticleEditorialService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/bot-status')
  getBotStatus() {
    return this.articleBotService.getStatus();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/articles/cleanup-duplicates')
  cleanupDuplicates() {
    return this.articleBotService.cleanupDuplicateLegacyArticles();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/articles/auto-generate')
  autoGenerateArticle(
    @Body() body: { topic?: string; status?: 'published' | 'draft' },
    @CurrentUser() user: { id: number },
  ) {
    return this.articleBotService.generateAndPublishNextArticle(
      body?.topic,
      'draft',
      'manual',
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles')
  findAllAdmin(@Query() query: PaginationQueryDto) {
    return this.articleService.findAll(
      query.page,
      query.limit,
      query.q,
      query.sortBy,
      query.sortOrder,
      query.filters,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/editorial/overview')
  editorialOverview() {
    return this.editorial.overview();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/editorial/performance')
  editorialPerformance(@Query() query: DashboardQueryDto) {
    return this.editorial.performance(query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/articles/:id/check-links')
  checkLinks(@Param('id', ParseIntPipe) id: number) {
    return this.editorial.checkLinks(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/:id')
  findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/articles')
  create(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.articleService.create(createArticleDto, user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/articles/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.articleService.update(id, updateArticleDto, user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/:id/revisions')
  listRevisions(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.listRevisions(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles/:id/revisions/:revisionId')
  getRevision(@Param('id', ParseIntPipe) id: number, @Param('revisionId') revisionId: string) {
    return this.articleService.getRevision(id, revisionId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/articles/:id/revisions/:revisionId/restore')
  restoreRevision(@Param('id', ParseIntPipe) id: number, @Param('revisionId') revisionId: string, @Body() dto: RestoreArticleRevisionDto, @CurrentUser() user: { id: number }) {
    return this.articleService.restoreRevision(id, revisionId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/articles/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id);
  }

  @Get('articles')
  findAllPublished(@Query() query: PaginationQueryDto) {
    return this.articleService.findAllPublished(
      query.page,
      query.limit,
      query.q,
    );
  }

  @Get('articles/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articleService.findBySlug(slug);
  }
}
