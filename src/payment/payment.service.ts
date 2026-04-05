import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Snap } from 'midtrans-client';
import { ConfigService } from '@nestjs/config';
import { DeepPartial, Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MidtransNotificationPayload,
  PaymentStatus,
} from './types/payment.type';
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
      isProduction: false,
      serverKey: this.configService.get('SERVER_KEY')!,
      clientKey: this.configService.get('CLIENT_KEY')!,
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

    // 1. Security Check: Pastikan user adalah pemilik undangan
    if (invitation.user.id !== user.id) {
      throw new ForbiddenException('You are not the owner of this invitation');
    }

    // 2. Handle Price Decimal & resolve promo code server-side
    const rawPrice = invitation.templateDesign?.price || 0;
    let grossAmount = Number(rawPrice);
    let appliedPromo: PromoCode | undefined;
    let discountAmount = 0;

    if (promoCode) {
      const promoResult = await this.promoService.validate(
        promoCode,
        invitationId,
      );
      if (!promoResult.valid) {
        throw new BadRequestException(
          promoResult.message || 'Kode promo tidak valid',
        );
      }
      appliedPromo = promoResult.promoCode!;
      discountAmount = promoResult.discountAmount!;
      grossAmount = promoResult.finalPrice!;
    }

    // Atomically reserve a promo slot BEFORE any external call.
    // This single DB UPDATE with a conditional WHERE prevents two concurrent
    // requests from both "winning" the last available slot.
    if (appliedPromo) {
      const reserved = await this.promoService.tryReserve(appliedPromo.id);
      if (!reserved) {
        throw new BadRequestException(
          'Kode promo sudah habis atau tidak berlaku',
        );
      }
    }

    // Jika GRATIS (0), langsung aktifkan tanpa ke Midtrans
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

    // Generate unique order ID
    const orderId = `INV-${invitation.id}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: invitation.user?.name || 'Customer',
        email: invitation.user?.email || 'customer@example.com',
      },
      credit_card: {
        secure: true,
      },
      item_details: [
        {
          id: `INV-${invitation.id}`,
          price: grossAmount,
          quantity: 1,
          name: `Undangan Digital: ${invitation.title}`,
        },
      ],
    };

    let transaction: { token: string; redirect_url: string };
    try {
      transaction = await this.snap.createTransaction(parameter);
    } catch (err) {
      // Midtrans failed — release the promo slot we reserved above.
      if (appliedPromo) {
        await this.promoService.release(appliedPromo.id);
      }
      throw err;
    }

    const payment = this.paymentRepo.create({
      orderId,
      amount: grossAmount,
      name: invitation.user?.name || 'Customer',
      email: invitation.user?.email || 'customer@example.com',
      paymentMethod: 'midtrans',
      status: PaymentStatus.PENDING,
      paymentType: null,
      fraudStatus: null,
      invitationId: invitation.id,
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
    const {
      order_id,
      transaction_status,
      payment_type,
      gross_amount,
      fraud_status,
      signature_key,
      status_code,
      settlement_time,
    } = payload;

    // ✅ Kalau order_id dari test notif Midtrans, jangan paksa cek DB
    if (order_id.startsWith('payment_notif_test')) {
      console.log('📩 Received Midtrans TEST notification:', payload);
      return {
        orderId: order_id,
        status: transaction_status,
        note: 'Test notification',
      };
    }

    const serverKey: string = this.configService.get('SERVER_KEY')!;
    const input: string = order_id + status_code + gross_amount + serverKey;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(input)
      .digest('hex');

    const isValid = expectedSignature === signature_key;
    if (!isValid) {
      // 👉 Tambahin ini biar test notif dari Midtrans gak bikin error 500
      console.warn(
        '⚠️ Signature tidak valid (mungkin test notification dari Midtrans)',
      );
      return { orderId: order_id, status: 'signature_invalid_test_mode' };
    }

    const payment = await this.paymentRepo.findOne({
      where: { orderId: order_id },
      relations: ['invitation'],
    });
    if (!payment) {
      throw new Error(`Payment with order_id ${order_id} not found`);
    }

    const isSuccess =
      (transaction_status === 'settlement' || transaction_status === 'capture') &&
      fraud_status === 'accept';

    if (isSuccess) {
      payment.status = PaymentStatus.SUCCESS;
      payment.settlementTime = settlement_time
        ? new Date(settlement_time)
        : new Date();

      if (payment.invitation) {
        payment.invitation.isPublished = true;
        await this.invitationRepo.save(payment.invitation);
      }
    } else if (transaction_status === 'expire') {
      payment.status = PaymentStatus.EXPIRED;
    } else if (['deny', 'cancel'].includes(transaction_status)) {
      payment.status = PaymentStatus.FAILURE;
    } else if (transaction_status === 'pending') {
      payment.status = PaymentStatus.PENDING;
    } else {
      payment.status = transaction_status;
    }

    payment.paymentType = payment_type;
    payment.fraudStatus = fraud_status;

    await this.paymentRepo.save(payment);

    return { orderId: order_id, updatedStatus: payment.status };
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

    // Security Check: Only the owner can simulate payment
    if (payment.invitation.user.id !== user.id) {
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
}
