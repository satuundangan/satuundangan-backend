import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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

@Injectable()
export class PaymentService {
  private snap: Snap;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
  ) {
    this.snap = new Snap({
      isProduction: false,
      serverKey: this.configService.get('SERVER_KEY')!,
      clientKey: this.configService.get('CLIENT_KEY')!,
    });
  }

  async createTransaction(invitationId: number, user: User) {
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

    // 2. Handle Price Decimal & Free Template
    const rawPrice = invitation.templateDesign?.price || 0;
    const grossAmount = Number(rawPrice);

    // Jika GRATIS (0), langsung aktifkan tanpa ke Midtrans
    if (grossAmount === 0) {
      invitation.isActive = true;
      await this.invitationRepo.save(invitation);

      // (Opsional) Catat history pembayaran "FREE"
      const payment = this.paymentRepo.create({
        orderId: `FREE-${invitation.id}-${Date.now()}`,
        amount: 0,
        name: user.name,
        email: user.email,
        paymentMethod: 'FREE_ACTIVATION',
        status: PaymentStatus.SUCCESS,
        paymentType: 'free',
        fraudStatus: 'accept',
        invitationId: invitation.id,
        settlementTime: new Date(),
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

    const transaction = await this.snap.createTransaction(parameter);

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

    if (transaction_status === 'settlement' && fraud_status === 'accept') {
      payment.status = PaymentStatus.SUCCESS;
      payment.settlementTime = settlement_time
        ? new Date(settlement_time)
        : new Date();

      if (payment.invitation) {
        payment.invitation.isActive = true;
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
        payment.invitation.isActive = true;
        await this.invitationRepo.save(payment.invitation);
      }
    }

    return this.paymentRepo.save(payment);
  }
}
