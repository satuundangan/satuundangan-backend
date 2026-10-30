import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { User } from '../user/user.entity';
import { AiCreditLog } from './ai-credit-log.entity';
import { PaymentModule } from '../payment/payment.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, AiCreditLog]), PaymentModule],
  providers: [AiService, AdminGuard],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
