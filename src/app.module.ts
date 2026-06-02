import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InvitationModule } from './invitation/invitation.module';
import { TemplateDesignModule } from './template-design/template-design.module';
import { PaymentModule } from './payment/payment.module';
import { GuestMessagesModule } from './guest-messages/guest-messages.module';
import { UploadModule } from './modules/upload/upload.module';
import { GuestModule } from './dashboard-user/guest/guest.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CategoryModule } from './category/category.module';
import { PromoModule } from './promo/promo.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity.{js,ts}'],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    InvitationModule,
    TemplateDesignModule,
    PaymentModule,
    UploadModule,
    GuestMessagesModule,
    GuestModule,
    AdminModule,
    DashboardModule,
    CategoryModule,
    PromoModule,
    AffiliateModule,
    AiModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
