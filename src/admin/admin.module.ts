import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { Category } from '../category/category.entity';
import { Payment } from '../payment/payment.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PublicSectionController } from './public-section.controller';
import { PublicAudioController } from './public-audio.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import { TemplateDesignRevision } from './entities/template-design-revision.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { TelemetryController } from './telemetry.controller';
import { PromoModule } from '../promo/promo.module';
import { UploadModule } from '../modules/upload/upload.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AffiliateProfile } from '../affiliate/entities/affiliate-profile.entity';
import { WithdrawRequest } from '../affiliate/entities/withdraw-request.entity';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminHealthService } from './admin-health.service';
import { AdminAuditLog } from './security/admin-audit-log.entity';
import { AdminAuditService } from './security/admin-audit.service';
import { AdminAuditInterceptor } from './security/admin-audit.interceptor';
import { SystemSetting } from './security/system-setting.entity';
import { MaintenanceService } from './security/maintenance.service';
import { MaintenanceGuard } from './security/maintenance.guard';
import { MaintenanceController } from './security/maintenance.controller';

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
      Payment,
      Section,
      Audio,
      Bank,
      PaletteColor,
      TemplateDesignRevision,
      ActivityLog,
      AffiliateProfile,
      WithdrawRequest,
      AdminAuditLog,
      SystemSetting,
    ]),
    PromoModule,
    UploadModule,
  ],
  providers: [
    AdminService,
    AdminDashboardService,
    AdminGuard,
    AdminHealthService,
    AdminAuditService,
    MaintenanceService,
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
  controllers: [
    AdminController,
    AdminDashboardController,
    MaintenanceController,
    PublicSectionController,
    PublicAudioController,
    TelemetryController,
  ],
})
export class AdminModule {}
