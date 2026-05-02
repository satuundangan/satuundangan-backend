import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { User } from '../user/user.entity'
import { AiService } from './ai.service'
import { ChatDto, PurchaseCreditsDto } from './dto/chat.dto'
import { PaymentService } from '../payment/payment.service'

@ApiTags('AI Nova')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('credits')
  @ApiOperation({ summary: 'Get remaining Nova credits' })
  getCredits(@CurrentUser() user: User) {
    return this.aiService.getCredits(user.id)
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with Nova AI' })
  chat(@Body() dto: ChatDto, @CurrentUser() user: User) {
    return this.aiService.chat(user.id, dto.messages, dto.currentData)
  }

  @Post('credits/purchase')
  @ApiOperation({ summary: 'Buy Nova credit package' })
  purchaseCredits(@Body() dto: PurchaseCreditsDto, @CurrentUser() user: User) {
    return this.paymentService.createAiCreditTransaction(dto.packageId, user)
  }
}
