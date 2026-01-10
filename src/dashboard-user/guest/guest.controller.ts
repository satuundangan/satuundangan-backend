import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { GuestService } from './guest.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('guests')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  // ✅ Create guest manual
  @Post()
  create(@Body() dto: CreateGuestDto) {
    return this.guestService.create(dto);
  }

  // ✅ Get all guests by invitation
  @Get('invitation/:invitationId')
  findAllByInvitation(@Param('invitationId') invitationId: number) {
    return this.guestService.findAllByInvitation(invitationId);
  }

  // ✅ Get all guests by invitation with last message and tracking fields
  @Get('invitation/:invitationId/with-messages')
  findAllByInvitationWithMessages(@Param('invitationId') invitationId: number) {
    return this.guestService.findAllByInvitationWithMessages(invitationId);
  }

  // ✅ Delete guest
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.guestService.remove(id);
  }

  // ✅ Import guest via Excel
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(
            new BadRequestException('Only Excel files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    const filepath = path.resolve(file.path);
    const guests = await this.guestService.importFromExcel(filepath);

    // optional: delete file after processing
    fs.unlinkSync(filepath);

    return guests;
  }

  // ✅ Build share link and WhatsApp deeplink for a guest
  @Get(':id/share')
  async share(@Param('id') id: number) {
    return this.guestService.buildWhatsAppLink(id);
  }

  @Post(':id/check-in')
  @UseGuards(JwtAuthGuard)
  checkIn(@Param('id') id: number) {
    return this.guestService.checkIn(id);
  }
}
