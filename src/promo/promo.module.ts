import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from './promo-code.entity';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { Invitation } from '../invitation/invitation.entity';
import { User } from '../user/user.entity';
import { Payment } from '../payment/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, Invitation, User, Payment])],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService],
})
export class PromoModule {}
