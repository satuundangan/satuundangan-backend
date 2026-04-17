import { createHash } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { Snap } from 'midtrans-client';
import { ConfigService } from '@nestjs/config';
import { DeepPartial, Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MidtransNotificationPayload, PaymentStatus } from './types/payment.type';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { PromoService } from '../promo/promo.service';
import { PromoCode } from '../promo/promo-code.entity';

@Injectable()
export class PaymentService {
  private snap: Snap;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    private readonly promoService: PromoService,
  ) {
    this.snap = new Snap({
      isProduction: this.getMidtransIsProduction(),
      serverKey: this.getMidtransServerKey() || '',
      clientKey: this.getMidtransClientKey() || '',
    });
  }

  async createTransaction(
    invitationId: number,
    user: User,
    promoCode?: string,
  ) {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!invitation.user) {
      throw new BadRequestException('Invitation owner is missing');
    }

    if (Number(invitation.user.id) !== Number(user.id)) {
      throw new ForbiddenException('You are not the owner of this invitation');
    }

    const rawPrice = invitation.templateDesign?.price || 0;
    let grossAmount = Number(rawPrice);
    let appliedPromo: PromoCode | undefined;
    let discountAmount = 0;

    if (promoCode) {
      const promoResult = await this.promoService.validate(promoCode, invitationId);
      if (!promoResult.valid) {
        throw new BadRequestException(promoResult.message || 'Kode promo tidak valid');
      }
      appliedPromo = promoResult.promoCode!;
      discountAmount = promoResult.discountAmount!;
      grossAmount = promoResult.finalPrice!;
    }

    if (appliedPromo) {
      const reserved = await this.promoService.tryReserve(appliedPromo.id);
      if (!reserved) {
        throw new BadRequestException('Kode promo sudah habis atau tidak berlaku');
      }
    }

    if (grossAmount === 0) {
      invitation.isPublished = true;
      await this.invitationRepo.save(invitation);

      const payment = this.paymentRepo.create({
        orderId: `FREE-${invitation.id}-${Date.now()}`,
        amount: 0,
        name: invitation.user?.name || user.email,
        email: invitation.user?.email || user.email,
        paymentMethod: 'FREE_ACTIVATION',
        status: PaymentStatus.SUCCESS,
        paymentType: 'free',
        fraudStatus: 'accept',
        invitationId: invitation.id,
        settlementTime: new Date(),
        promoCodeId: appliedPromo?.id ?? null,
        discountAmount: discountAmount || null,
      } as DeepPartial<Payment>);

      await this.paymentRepo.save(payment);

      return {
        status: 'success',
        message: 'Invitation activated successfully (Free Template)',
        amount: 0,
        is_free: true,
        token: null,
        redirect_url: null,
      };
    }

    const serverKey = this.getMidtransServerKey();
    if (!serverKey) {
      if (appliedPromo) {
        await this.promoService.release(appliedPromo.id);
      }
      throw new UnauthorizedException('Midtrans server key is not configured');
    }

    const orderId = `INV-${invitation.id}-${Date.now()}`;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
    const customerName = this.sanitizeMidtransText(
      invitation.user?.name || user.email || 'Customer',
      'Customer',
      255,
    );
    const customerEmail = this.sanitizeEmail(
      invitation.user?.email || user.email,
    );
    const itemName = this.sanitizeMidtransText(
      `Undangan Digital: ${invitation.title || invitation.slug || invitation.id}`,
      `Undangan Digital ${invitation.id}`,
      50,
    );

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(grossAmount),
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      credit_card: {
        secure: true,
      },
      item_details: [
        {
          id: `invitation-${invitation.id}`,
          price: Math.round(grossAmount),
          quantity: 1,
          name: itemName,
        },
      ],
      callbacks: {
        finish: `${frontendUrl}/payment/finish`,
        error: `${frontendUrl}/payment/finish`,
        pending: `${frontendUrl}/payment/finish`,
      },
    };

    let transaction: { token: string; redirect_url: string };
    try {
      transaction = await this.snap.createTransaction(parameter);
    } catch (err) {
      if (appliedPromo) {
        await this.promoService.release(appliedPromo.id);
      }
      throw new BadGatewayException(this.getMidtransErrorMessage(err));
    }

    const payment = this.paymentRepo.create({
      orderId,
      amount: grossAmount,
      name: customerName,
      email: customerEmail,
      paymentMethod: 'midtrans',
      status: PaymentStatus.PENDING,
      paymentType: null,
      fraudStatus: null,
      invitationId: invitation.id,
      transactionId: null,
      promoCodeId: appliedPromo?.id ?? null,
      discountAmount: discountAmount || null,
    } as DeepPartial<Payment>);

    await this.paymentRepo.save(payment);

    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id: orderId,
      is_free: false,
    };
  }

  async handleMidtransNotification(payload: MidtransNotificationPayload) {
    const serverKey = this.getMidtransServerKey();
    if (!serverKey) {
      throw new UnauthorizedException('Midtrans server key is not configured');
    }

    const expectedSignature = createHash('sha512')
      .update(
        `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`,
      )
      .digest('hex');

    if (payload.signature_key !== expectedSignature) {
      throw new UnauthorizedException('Invalid Midtrans signature');
    }

    const payment = await this.paymentRepo.findOne({
      where: { orderId: payload.order_id },
      relations: ['invitation'],
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment with order_id ${payload.order_id} not found`,
      );
    }

    payment.transactionId = payload.transaction_id ?? payment.transactionId ?? null;
    payment.paymentMethod = 'midtrans';
    payment.paymentType = payload.payment_type ?? payment.paymentType ?? null;
    payment.fraudStatus = payload.fraud_status ?? null;

    const mappedStatus = this.mapMidtransStatus(payload);
    payment.status = mappedStatus;

    if (mappedStatus === PaymentStatus.SUCCESS) {
      const settlementAt =
        payload.settlement_time || payload.transaction_time || null;
      payment.settlementTime = settlementAt ? new Date(settlementAt) : new Date();

      if (payment.invitation) {
        payment.invitation.isPublished = true;
        await this.invitationRepo.save(payment.invitation);
      }
    }

    await this.paymentRepo.save(payment);

    return { orderId: payment.orderId, updatedStatus: payment.status };
  }

  async getPaymentStatus(orderId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { orderId },
      relations: ['invitation'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with order_id ${orderId} not found`);
    }

    return {
      orderId: payment.orderId,
      status: payment.status,
      invitationSlug: payment.invitation?.slug ?? null,
    };
  }

  async simulatePayment(
    invitationId: number,
    status: PaymentStatus,
    user: User,
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { invitationId },
      order: { createdAt: 'DESC' },
      relations: ['invitation', 'invitation.user'],
    });

    if (!payment) {
      throw new NotFoundException(
        'No payment record found for this invitation to simulate.',
      );
    }

    if (Number(payment.invitation.user.id) !== Number(user.id)) {
      throw new ForbiddenException('You are not the owner of this invitation');
    }

    payment.status = status;
    payment.paymentType = 'simulation';

    if (status === PaymentStatus.SUCCESS) {
      payment.settlementTime = new Date();
      if (payment.invitation) {
        payment.invitation.isPublished = true;
        await this.invitationRepo.save(payment.invitation);
      }
    }

    return this.paymentRepo.save(payment);
  }

  private mapMidtransStatus(
    payload: MidtransNotificationPayload,
  ): PaymentStatus {
    if (payload.transaction_status === 'capture') {
      if (
        payload.payment_type === 'credit_card' &&
        payload.fraud_status === 'challenge'
      ) {
        return PaymentStatus.PENDING;
      }

      return PaymentStatus.SUCCESS;
    }

    if (payload.transaction_status === 'settlement') {
      return PaymentStatus.SUCCESS;
    }

    if (
      payload.transaction_status === 'pending' ||
      payload.transaction_status === 'authorize'
    ) {
      return PaymentStatus.PENDING;
    }

    if (payload.transaction_status === 'expire') {
      return PaymentStatus.EXPIRED;
    }

    if (
      payload.transaction_status === 'deny' ||
      payload.transaction_status === 'cancel' ||
      payload.transaction_status === 'failure'
    ) {
      return PaymentStatus.FAILURE;
    }

    return PaymentStatus.PENDING;
  }

  private getMidtransServerKey(): string | null {
    return (
      this.configService.get<string>('MIDTRANS_SERVER_KEY') ||
      this.configService.get<string>('MERCHANT_SERVER_KEY') ||
      this.configService.get<string>('SERVER_KEY') ||
      null
    );
  }

  private getMidtransClientKey(): string | null {
    return (
      this.configService.get<string>('MIDTRANS_CLIENT_KEY') ||
      this.configService.get<string>('MERCHANT_CLIENT_KEY') ||
      this.configService.get<string>('CLIENT_KEY') ||
      null
    );
  }

  private getMidtransIsProduction(): boolean {
    return (
      this.configService.get<string>('MIDTRANS_IS_PRODUCTION') === 'true' ||
      this.configService.get('NODE_ENV') === 'production'
    );
  }

  private sanitizeMidtransText(
    value: unknown,
    fallback: string,
    maxLength: number,
  ): string {
    const text = String(value ?? '')
      .replace(/[^\p{L}\p{N}\s.,&'()/-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return (text || fallback).slice(0, maxLength);
  }

  private sanitizeEmail(value: unknown): string {
    const email = String(value ?? '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? email.slice(0, 255)
      : 'customer@satuundangan.id';
  }

  private getMidtransErrorMessage(err: unknown): string {
    const response = err as {
      ApiResponse?: { error_messages?: string[] };
      response?: { data?: { error_messages?: string[]; message?: string } };
      message?: string;
    };

    const messages =
      response?.ApiResponse?.error_messages ||
      response?.response?.data?.error_messages;

    if (Array.isArray(messages) && messages.length) {
      return `Gagal membuat transaksi Midtrans: ${messages.join(', ')}`;
    }

    const message = response?.response?.data?.message || response?.message;
    return message
      ? `Gagal membuat transaksi Midtrans: ${message}`
      : 'Gagal membuat transaksi Midtrans';
  }
}
