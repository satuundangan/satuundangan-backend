import { Controller, Post, Body, Res, Get, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post('create')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Create a new payment transaction' })
  async createSnap(
    @Body()
    body: {
      invitation_id: number;
    },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.paymentService.createTransaction(body.invitation_id);
  }

  @Get('/success')
  @ApiTags('Payment')
  @ApiOperation({
    summary: 'Handle webhook for successful payment for midtrans',
  })
  handleSuccess(@Res() res: Response) {
    return res.status(200).send('Payment successful!');
  }

  @Get('/finish')
  @ApiTags('Payment')
  @ApiOperation({
    summary: 'Handle webhook for finished payment for midtrans',
  })
  handleFinish(@Res() res: Response) {
    return res.status(200).send('Payment finished!');
  }

  @Post('notification')
  async handleNotification(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.paymentService.handleMidtransNotification(
      req.body,
    );
    return { message: 'Notification received', result };
  }
}
