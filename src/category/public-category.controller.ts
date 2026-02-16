import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';

@Controller('categories')
export class PublicCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }
}
