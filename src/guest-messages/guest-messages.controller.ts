import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  GuestMessagesService,
  AdminGuestMessagesQuery,
} from './guest-messages.service';
import { CreateGuestMessageDto } from './dto/create-guest-message.dto';
import { ModerateGuestMessageDto } from './dto/moderate-guest-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
@ApiTags('Guest Messages')
export class GuestMessagesController {
  constructor(private readonly guestMessagesService: GuestMessagesService) {}

  @Post('guest-messages')
  @ApiOperation({ summary: 'Create a new guest message' })
  @ApiBody({ type: CreateGuestMessageDto })
  @ApiResponse({
    status: 201,
    description: 'The guest message has been successfully created.',
  })
  async createMessage(@Body() dto: CreateGuestMessageDto) {
    const created = await this.guestMessagesService.create(dto);
    return {
      success: true,
      message: 'Message created successfully',
      data: created,
    };
  }

  @Get('guest-messages/drilldown/:invitationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get guest RSVP drilldown stats and messages for an invitation',
  })
  @ApiParam({ name: 'invitationId', type: Number, example: 1 })
  async getGuestDrilldown(
    @CurrentUser() user: { id: number; email: string; isAdmin: boolean },
    @Param('invitationId', ParseIntPipe) invitationId: number,
  ) {
    const data = await this.guestMessagesService.getGuestDrilldown(
      invitationId,
      user,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('guest-messages/invitation/:invitationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get published guest messages by invitation ID' })
  @ApiParam({ name: 'invitationId', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'List of published guest messages for the invitation',
  })
  async getMessagesByInvitation(
    @CurrentUser() user: { id: number; email: string; isAdmin: boolean },
    @Param('invitationId', ParseIntPipe) invitationId: number,
  ) {
    await this.guestMessagesService.verifyOwnerOrAdmin(invitationId, user);
    const messages =
      await this.guestMessagesService.findByInvitationId(invitationId);
    return {
      success: true,
      data: messages,
    };
  }

  @Get('admin/guest-messages')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin overview list of guest messages with filters',
  })
  async adminGetMessages(@Query() query: AdminGuestMessagesQuery) {
    const result = await this.guestMessagesService.adminGetMessages(query);
    return {
      success: true,
      ...result,
    };
  }

  @Patch('admin/guest-messages/:id/moderate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate a guest message status (Admin only)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  async moderateMessage(
    @CurrentUser() user: { id: number; email: string; isAdmin: boolean },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModerateGuestMessageDto,
  ) {
    const message = await this.guestMessagesService.moderateMessage(
      id,
      dto.status,
      user,
    );
    return {
      success: true,
      message: `Message status updated to ${dto.status}`,
      data: message,
    };
  }

  @Get('guest-messages')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all guest messages' })
  @ApiResponse({
    status: 200,
    description: 'List of all guest messages',
  })
  async getAllMessages(): Promise<{ success: boolean; data: any[] }> {
    const messages = await this.guestMessagesService.getAll();
    return {
      success: true,
      data: messages,
    };
  }

  @Delete('guest-messages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a guest message by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'The guest message has been successfully deleted.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. You are not allowed to delete this message.',
  })
  @ApiResponse({
    status: 404,
    description: 'Guest message not found.',
  })
  async deleteMessage(
    @CurrentUser() user: { id: number; email: string; isAdmin: boolean },
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.guestMessagesService.delete(id, user);
    return {
      success: true,
      message: 'Guest message deleted successfully',
    };
  }
}
