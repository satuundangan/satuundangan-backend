import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  SupportTicketService,
  SupportTicketFindAllQuery,
} from './support-ticket.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Support Tickets')
@Controller()
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Post('support-tickets')
  @ApiOperation({ summary: 'Submit a new support ticket (public / customer)' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  async createTicket(@Body() dto: CreateSupportTicketDto) {
    const ticket = await this.ticketService.create(dto);
    return {
      success: true,
      message: 'Support ticket submitted successfully',
      data: ticket,
    };
  }

  @Get('admin/support-tickets/metrics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support ticket SLA & operational metrics (Admin only)' })
  async getMetrics() {
    const metrics = await this.ticketService.getMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('admin/support-tickets')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all support tickets with filters & pagination (Admin only)' })
  async findAll(@Query() query: SupportTicketFindAllQuery) {
    const result = await this.ticketService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('admin/support-tickets/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support ticket detail by ID (Admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const ticket = await this.ticketService.findOne(id);
    return {
      success: true,
      data: ticket,
    };
  }

  @Patch('admin/support-tickets/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update or reply to a support ticket (Admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    const ticket = await this.ticketService.update(id, dto);
    return {
      success: true,
      message: 'Support ticket updated successfully',
      data: ticket,
    };
  }
}
