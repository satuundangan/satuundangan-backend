import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TemplateDesignService } from './template-design.service';
import { TemplateDesign } from './template-design.entity';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Template Design')
@Controller('template-design')
export class TemplateDesignController {
  constructor(private readonly templateService: TemplateDesignService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new template design' })
  @ApiBody({
    description: 'Template design details',
    type: TemplateDesign,
  })
  create(@Body() dto: Partial<TemplateDesign>) {
    return this.templateService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all template designs' })
  findAll(@Query('category') category?: string) {
    if (category) {
      return this.templateService.findByCategory(category);
    }
    return this.templateService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template design by ID' })
  findById(@Param('id') id: string) {
    return this.templateService.findById(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update a template design' })
  @ApiBody({
    description: 'Partial template design details to update',
    type: TemplateDesign,
  })
  update(@Param('id') id: string, @Body() dto: Partial<TemplateDesign>) {
    return this.templateService.update(+id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete a template design' })
  remove(@Param('id') id: string) {
    return this.templateService.remove(+id);
  }
}
