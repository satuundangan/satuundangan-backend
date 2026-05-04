import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AiService } from './ai.service'
import { AiController } from './ai.controller'
import { User } from '../user/user.entity'
import { PaymentModule } from '../payment/payment.module'

@Module({
  imports: [TypeOrmModule.forFeature([User]), PaymentModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
