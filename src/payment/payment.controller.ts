import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { PaymentStatus, MidtransNotificationPayload } from './types/payment.type';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post('create')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Create a new payment transaction' })
  @UseGuards(JwtAuthGuard)
  async createSnap(
    @Body()
    body: {
      invitation_id: number;
      promo_code?: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.paymentService.createTransaction(
      body.invitation_id,
      user,
      body.promo_code,
    );
  }

  @Post('simulate')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Simulate payment status (Dev only)' })
  @UseGuards(JwtAuthGuard)
  async simulate(
    @Body()
    body: {
      invitation_id: number;
      status: PaymentStatus;
    },
    @CurrentUser() user: User,
  ) {
    return this.paymentService.simulatePayment(
      body.invitation_id,
      body.status,
      user,
    );
  }

  @Get('status/:orderId')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Get payment status by order ID' })
  async getStatus(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId);
  }

  @Get('/finish')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Redirect page after payment finished' })
  handleFinish(@Res() res: Response) {
    return res.status(200).send('Payment finished!');
  }

  @Post('notification')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Handle Midtrans webhook notification' })
  async handleNotification(
    @Body() payload: MidtransNotificationPayload,
  ) {
    const result = await this.paymentService.handleMidtransNotification(payload);
    return { message: 'Notification received', result };
  }
}
