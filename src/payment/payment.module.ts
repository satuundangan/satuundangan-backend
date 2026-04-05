import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Invitation } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Invitation, PromoCode]),
    PromoModule,
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
