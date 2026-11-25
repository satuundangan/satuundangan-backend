import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { GuestPhotosService } from './guest-photos.service';

const MAX_GUEST_PHOTO_BYTES = 15 * 1024 * 1024;

@ApiTags('Guest Photos')
@Controller('guest-photos')
export class GuestPhotosController {
  constructor(private readonly guestPhotosService: GuestPhotosService) {}

  @Get('public/slug/:slug')
  getPublicInfo(@Param('slug') slug: string) {
    return this.guestPhotosService.getPublicInfoBySlug(slug);
  }

  @Get('live-feed/:slug')
  getLiveFeed(@Param('slug') slug: string) {
    return this.guestPhotosService.getLiveFeedBySlug(slug);
  }

  @Post(':slug/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_GUEST_PHOTO_BYTES,
      },
    }),
  )
  uploadGuestPhoto(
    @Param('slug') slug: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_GUEST_PHOTO_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: { guestName?: string; caption?: string },
  ) {
    return this.guestPhotosService.uploadGuestPhoto(slug, file, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invitation/:invitationId')
  getOwnerPhotos(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: User,
  ) {
    return this.guestPhotosService.getOwnerPhotos(Number(invitationId), user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/approve')
  toggleApproval(
    @Param('id') id: string,
    @Body('isApproved') isApproved: boolean,
    @CurrentUser() user: User,
  ) {
    return this.guestPhotosService.toggleApproval(id, user.id, isApproved);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deletePhoto(@Param('id') id: string, @CurrentUser() user: User) {
    return this.guestPhotosService.deletePhoto(id, user.id);
  }
}
