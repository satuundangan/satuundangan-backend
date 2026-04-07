import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { DeepPartial, Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FlipWebhookPayload, PaymentStatus } from './types/payment.type';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { PromoService } from '../promo/promo.service';
import { PromoCode } from '../promo/promo-code.entity';

@Injectable()
export class PaymentService {
  private readonly flipBaseUrl: string;
  private readonly flipAuthHeader: string;
  private readonly flipValidationToken: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    private readonly promoService: PromoService,
  ) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    this.flipBaseUrl = isProduction
      ? 'https://bigflip.id/api/v3'
      : 'https://bigflip.id/big_sandbox_api/v3';

    const secretKey = this.configService.get<string>('FLIP_SECRET_KEY')!;
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');
    this.flipAuthHeader = `Basic ${encoded}`;

    this.flipValidationToken = this.configService.get<string>('FLIP_VALIDATION_TOKEN')!;
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

    if (invitation.user.id !== user.id) {
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

    // Jika GRATIS (0), langsung aktifkan tanpa ke Flip
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
        fraudStatus: null,
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

    const orderId = `INV-${invitation.id}-${Date.now()}`;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;

    let flipResponse: { link_id: number; link_url: string };
    try {
      const { data } = await axios.post(
        `${this.flipBaseUrl}/pwf/bill`,
        new URLSearchParams({
          title: `Undangan Digital: ${invitation.title}`,
          amount: String(grossAmount),
          type: 'SINGLE',
          expired_date: this.getExpiredDate(),
          redirect_url: `${frontendUrl}/payment/finish?order_id=${orderId}`,
          sender_name: invitation.user?.name || 'Customer',
          sender_email: invitation.user?.email || 'customer@example.com',
        }),
        {
          headers: {
            Authorization: this.flipAuthHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      flipResponse = data;
    } catch (err) {
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
      paymentMethod: 'flip',
      status: PaymentStatus.PENDING,
      paymentType: null,
      fraudStatus: null,
      invitationId: invitation.id,
      transactionId: String(flipResponse.link_id),
      promoCodeId: appliedPromo?.id ?? null,
      discountAmount: discountAmount || null,
    } as DeepPartial<Payment>);

    await this.paymentRepo.save(payment);

    return {
      token: null,
      redirect_url: flipResponse.link_url,
      order_id: orderId,
      is_free: false,
    };
  }

  async handleFlipNotification(
    payload: FlipWebhookPayload,
    callbackToken: string,
  ) {
    // Verifikasi token dari header x-callback-token
    if (callbackToken !== this.flipValidationToken) {
      throw new UnauthorizedException('Invalid callback token');
    }

    // Cari payment berdasarkan flip bill_link_id yang tersimpan di transactionId
    const payment = await this.paymentRepo.findOne({
      where: { transactionId: String(payload.bill_link_id) },
      relations: ['invitation'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with bill_link_id ${payload.bill_link_id} not found`);
    }

    const status = payload.status;

    if (status === 'SUCCESSFUL') {
      payment.status = PaymentStatus.SUCCESS;
      payment.settlementTime = new Date(payload.created_at);
      payment.paymentType = payload.sender_bank_type || null;

      if (payment.invitation) {
        payment.invitation.isPublished = true;
        await this.invitationRepo.save(payment.invitation);
      }
    } else if (status === 'CANCELLED') {
      payment.status = PaymentStatus.EXPIRED;
    } else if (status === 'FAILED') {
      payment.status = PaymentStatus.FAILURE;
    }

    await this.paymentRepo.save(payment);

    return { orderId: payment.orderId, updatedStatus: payment.status };
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

  private getExpiredDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1); // expired 24 jam
    // Format: YYYY-MM-DD HH:mm:ss
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
}
