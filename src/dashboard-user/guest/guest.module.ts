import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guest } from './guest.entity';
import { GuestService } from './guest.service';
import { GuestController } from './guest.controller';
import { Invitation } from '../../invitation/invitation.entity';
import { InvitationModule } from '../../invitation/invitation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Guest, Invitation]), InvitationModule],
  providers: [GuestService],
  controllers: [GuestController],
  exports: [GuestService],
})
export class GuestModule {}
