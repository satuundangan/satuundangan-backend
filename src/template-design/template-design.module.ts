import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateDesign } from './template-design.entity';
import { TemplateDesignSection } from './template-design-section.entity';
import { TemplateDesignService } from './template-design.service';
import { TemplateDesignController } from './template-design.controller';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TemplateDesign, TemplateDesignSection, User]),
  ],
  controllers: [TemplateDesignController],
  providers: [TemplateDesignService, AdminGuard],
  exports: [TemplateDesignService],
})
export class TemplateDesignModule {}
