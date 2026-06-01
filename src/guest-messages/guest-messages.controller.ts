import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GuestMessagesService } from './guest-messages.service';
import { CreateGuestMessageDto } from './dto/create-guest-message.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('guest-messages')
@ApiTags('Guest Messages')
export class GuestMessagesController {
  constructor(private readonly guestMessagesService: GuestMessagesService) {}

  @Post()
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

  @Get('invitation/:invitationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get guest messages by invitation ID' })
  @ApiParam({ name: 'invitationId', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'List of guest messages for the invitation',
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

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
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
}
