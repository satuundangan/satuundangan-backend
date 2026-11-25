import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestPhoto } from './entities/guest-photo.entity';
import { Invitation } from '../invitation/invitation.entity';
import { UploadModule } from '../modules/upload/upload.module';
import { GuestPhotosService } from './guest-photos.service';
import { GuestPhotosController } from './guest-photos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuestPhoto, Invitation]),
    UploadModule,
  ],
  controllers: [GuestPhotosController],
  providers: [GuestPhotosService],
  exports: [GuestPhotosService],
})
export class GuestPhotosModule {}
