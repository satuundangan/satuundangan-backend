import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './support-ticket.entity';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketController } from './support-ticket.controller';
import { User } from '../user/user.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, User])],
  controllers: [SupportTicketController],
  providers: [SupportTicketService, AdminGuard],
  exports: [SupportTicketService],
})
export class SupportTicketModule {}
