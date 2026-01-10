import { Controller, Get, Param } from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('categories')
export class PublicCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }
}
