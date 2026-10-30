import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Body,
  Res,
  Query,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import {
  PaymentStatus,
  MidtransNotificationPayload,
} from './types/payment.type';
import {
  InvitationPackage,
  PACKAGE_PRICES,
  PACKAGE_LABELS,
  PACKAGE_FEATURES,
} from '../invitation/invitation.entity';

/** Browser-supplied analytics context is optional and untrusted: keep only well-formed values. */
export function sanitizeAnalyticsContext(
  clientId?: unknown,
  acquisition?: unknown,
): { gaClientId: string | null; acquisition: Record<string, string> | null } {
  const gaClientId =
    typeof clientId === 'string' && /^\d{5,12}\.\d{5,12}$/.test(clientId) ? clientId : null;
  let cleaned: Record<string, string> | null = null;
  if (acquisition && typeof acquisition === 'object' && !Array.isArray(acquisition)) {
    const entries = ['source', 'medium', 'campaign']
      .map((key) => [key, (acquisition as Record<string, unknown>)[key]] as const)
      .filter(([, value]) => typeof value === 'string' && /^[\w .\-:/+()%]{1,100}$/.test(value as string))
      .map(([key, value]) => [key, (value as string).trim()]);
    if (entries.length) cleaned = Object.fromEntries(entries);
  }
  return { gaClientId, acquisition: cleaned };
}

@Controller('payment')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {}

  @Get('packages')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'List pricing tiers (id, label, price)' })
  getPackages() {
    return Object.values(InvitationPackage).map((id) => ({
      id,
      label: PACKAGE_LABELS[id],
      price: PACKAGE_PRICES[id],
      features: PACKAGE_FEATURES[id],
    }));
  }

  @Post('create')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Create a new payment transaction' })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async createSnap(
    @Body()
    body: {
      invitation_id: number;
      package: InvitationPackage;
      promo_code?: string;
      affiliate_code?: string;
      ga_client_id?: string;
      acquisition?: { source?: string; medium?: string; campaign?: string };
    },
    @CurrentUser() user: User,
  ) {
    return this.paymentService.createTransaction(
      body.invitation_id,
      user,
      body.package,
      body.promo_code,
      body.affiliate_code,
      sanitizeAnalyticsContext(body.ga_client_id, body.acquisition),
    );
  }

  @Post('simulate')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Simulate payment status (Dev only)' })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
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
  handleFinish(
    @Query() query: Record<string, string | string[]>,
    @Res() res: Response,
  ) {
    return res.redirect(this.buildPaymentRedirectUrl('/payment/finish', query));
  }

  @Get('/pending')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Redirect page after payment is pending' })
  handlePending(
    @Query() query: Record<string, string | string[]>,
    @Res() res: Response,
  ) {
    return res.redirect(
      this.buildPaymentRedirectUrl('/payment/pending', query),
    );
  }

  @Get('/error')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Redirect page after payment error' })
  handleError(
    @Query() query: Record<string, string | string[]>,
    @Res() res: Response,
  ) {
    return res.redirect(this.buildPaymentRedirectUrl('/payment/error', query));
  }

  @Post('notification')
  @ApiTags('Payment')
  @ApiOperation({ summary: 'Handle Midtrans webhook notification' })
  async handleNotification(@Body() body: MidtransNotificationPayload) {
    const result = await this.paymentService.handleMidtransNotification(body);
    return { message: 'Notification received', result };
  }

  private buildPaymentRedirectUrl(
    path: '/payment/finish' | '/payment/pending' | '/payment/error',
    query: Record<string, string | string[]>,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://satuundangan.id';
    const url = new URL(path, frontendUrl);

    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, item));
        return;
      }

      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }
}
