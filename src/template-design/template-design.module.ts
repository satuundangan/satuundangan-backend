import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateDesign } from './template-design.entity';
import { TemplateDesignSection } from './template-design-section.entity';
import { TemplateDesignService } from './template-design.service';
import { TemplateDesignController } from './template-design.controller';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

import { Category } from '../category/category.entity';
import { Section } from '../admin/entities/section.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TemplateDesign,
      TemplateDesignSection,
      User,
      Category,
      Section,
    ]),
  ],
  controllers: [TemplateDesignController],
  providers: [TemplateDesignService, AdminGuard],
  exports: [TemplateDesignService],
})
export class TemplateDesignModule {}
