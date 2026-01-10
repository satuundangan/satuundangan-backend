import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { Category } from '../category/category.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Invitation,
      Guest,
      GuestMessage,
      TemplateDesign,
      Category,
      Section,
      Audio,
      Bank,
    ]),
  ],
  providers: [AdminService, AdminGuard],
  controllers: [AdminController],
})
export class AdminModule {}
