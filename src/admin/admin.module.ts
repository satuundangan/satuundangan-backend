import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { Category } from '../category/category.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PublicSectionController } from './public-section.controller';
import { PublicAudioController } from './public-audio.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { TelemetryController } from './telemetry.controller';
import { PromoModule } from '../promo/promo.module';
import { UploadModule } from '../modules/upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Invitation,
      Guest,
      GuestMessage,
      TemplateDesign,
      TemplateDesignSection,
      Category,
      Section,
      Audio,
      Bank,
      PaletteColor,
      ActivityLog,
    ]),
    PromoModule,
    UploadModule,
  ],
  providers: [AdminService, AdminGuard],
  controllers: [
    AdminController,
    PublicSectionController,
    PublicAudioController,
    TelemetryController,
  ],
})
export class AdminModule {}
