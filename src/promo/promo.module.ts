import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from './promo-code.entity';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { Invitation } from '../invitation/invitation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, Invitation])],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService],
})
export class PromoModule {}
