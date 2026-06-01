import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { User } from '../user/user.entity';
import { PromoModule } from '../promo/promo.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Invitation, PromoCode, User]),
    PromoModule,
    AffiliateModule,
  ],
  providers: [PaymentService, EmailVerifiedGuard],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
