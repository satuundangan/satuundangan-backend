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
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Articles')
@Controller()
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/articles')
  findAllAdmin(@Query() query: PaginationQueryDto) {
    return this.articleService.findAll(
      query.page,
      query.limit,
      query.q,
      query.sortBy,
      query.sortOrder,
    );
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
  ) {
    return this.articleService.update(id, updateArticleDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/articles/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id);
  }

  @Get('articles')
  findAllPublished(@Query() query: PaginationQueryDto) {
    return this.articleService.findAllPublished(query.page, query.limit);
  }

  @Get('articles/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articleService.findBySlug(slug);
  }
}
