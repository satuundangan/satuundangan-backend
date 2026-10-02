import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { GuestService } from './guest.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';

@Controller('guests')
@UseGuards(JwtAuthGuard)
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  // ✅ Create guest manual
  @Post()
  create(@Body() dto: CreateGuestDto, @CurrentUser() user: any) {
    return this.guestService.create(dto, user.id);
  }

  // ✅ Update guest
  @Patch(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateGuestDto,
    @CurrentUser() user: any,
  ) {
    return this.guestService.update(id, dto, user.id);
  }

  // ✅ Get all guests by invitation
  @Get('invitation/:invitationId')
  findAllByInvitation(
    @Param('invitationId') invitationId: number,
    @CurrentUser() user: any,
  ) {
    return this.guestService.findAllByInvitation(invitationId, user.id);
  }

  // ✅ Get all guests by invitation with last message and tracking fields
  @Get('invitation/:invitationId/with-messages')
  findAllByInvitationWithMessages(
    @Param('invitationId') invitationId: number,
    @CurrentUser() user: any,
  ) {
    return this.guestService.findAllByInvitationWithMessages(
      invitationId,
      user.id,
    );
  }

  // ✅ Delete guest
  @Delete(':id')
  remove(@Param('id') id: number, @CurrentUser() user: any) {
    return this.guestService.remove(id, user.id);
  }

  // ✅ Import guest via Excel
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      // Keep guest lists (names + phones) in memory: ./uploads is served
      // publicly, and a failed import used to leave the file behind.
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!/\.(xlsx|xls)$/i.test(file.originalname)) {
          return cb(
            new BadRequestException('Only Excel files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('invitationId') invitationId: string,
    @CurrentUser() user: any,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File Excel wajib diunggah.');
    }
    return this.guestService.importFromExcel(
      file.buffer,
      user.id,
      invitationId ? parseInt(invitationId) : undefined,
    );
  }

  // ✅ Build share link and WhatsApp deeplink for a guest
  @Get(':id/share')
  async share(@Param('id') id: number, @CurrentUser() user: any) {
    return this.guestService.buildWhatsAppLink(id, user.id);
  }

  // New endpoint for share-link as requested
  @Get(':id/share-link')
  async getShareLink(@Param('id') id: number, @CurrentUser() user: any) {
    return this.guestService.buildWhatsAppLink(id, user.id);
  }

  @Post(':id/check-in')
  checkIn(@Param('id') id: number) {
    return this.guestService.checkIn(id);
  }

  @Post('check-in-token')
  checkInByToken(@Body('token') token: string, @Body() body?: any) {
    return this.guestService.checkInByToken(token ?? body?.token ?? body?.accessToken ?? body);
  }

  @Get('invitation/:invitationId/check-in-summary')
  getCheckInSummary(
    @Param('invitationId') invitationId: number,
    @CurrentUser() user: any,
  ) {
    return this.guestService.getCheckInSummary(invitationId, user.id);
  }
}
