import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { PublicCategoryController } from './public-category.controller';
import { Category } from './category.entity';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Category, User])],
  controllers: [CategoryController, PublicCategoryController],
  providers: [CategoryService, AdminGuard],
  exports: [CategoryService],
})
export class CategoryModule {}
