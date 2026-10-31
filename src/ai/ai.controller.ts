import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { AiService, AdminAiLogsQuery } from './ai.service';
import { ChatDto, PurchaseCreditsDto } from './dto/chat.dto';
import { PaymentService } from '../payment/payment.service';

@ApiTags('AI Nova')
@Controller()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('ai/credits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get remaining Nova credits' })
  getCredits(@CurrentUser() user: User) {
    return this.aiService.getCredits(user.id);
  }

  @Post('ai/chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat with Nova AI' })
  chat(@Body() dto: ChatDto, @CurrentUser() user: User) {
    return this.aiService.chat(user.id, dto.messages, dto.currentData);
  }

  @Post('ai/credits/purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy Nova credit package' })
  purchaseCredits(@Body() dto: PurchaseCreditsDto, @CurrentUser() user: User) {
    return this.paymentService.createAiCreditTransaction(dto.packageId, user);
  }

  @Get('admin/ai/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI Nova usage and credit metrics (Admin only)' })
  async getAdminStats() {
    const stats = await this.aiService.getAdminStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('admin/ai/logs')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI Nova credit ledger logs (Admin only)' })
  async getAdminLogs(@Query() query: AdminAiLogsQuery) {
    const result = await this.aiService.getAdminLogs(query);
    return {
      success: true,
      ...result,
    };
  }
}
