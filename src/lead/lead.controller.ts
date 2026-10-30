import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LeadService, LeadFindAllQuery } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Leads')
@Controller()
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post('leads')
  @ApiOperation({ summary: 'Submit a new lead (public)' })
  @ApiResponse({ status: 201, description: 'Lead successfully created' })
  async createLead(@Body() dto: CreateLeadDto) {
    const lead = await this.leadService.create(dto);
    return {
      success: true,
      message: 'Lead created successfully',
      data: lead,
    };
  }

  @Get('admin/leads')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all leads with filters & pagination (Admin only)' })
  async findAll(@Query() query: LeadFindAllQuery) {
    const result = await this.leadService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('admin/leads/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get lead detail by ID (Admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const lead = await this.leadService.findOne(id);
    return {
      success: true,
      data: lead,
    };
  }

  @Patch('admin/leads/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a lead by ID (Admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadDto,
  ) {
    const lead = await this.leadService.update(id, dto);
    return {
      success: true,
      message: 'Lead updated successfully',
      data: lead,
    };
  }

  @Delete('admin/leads/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a lead by ID (Admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.leadService.remove(id);
    return result;
  }
}
