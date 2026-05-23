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
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
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
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('invitationId') invitationId: string,
    @CurrentUser() user: any,
  ) {
    const filepath = path.resolve(file.path);
    const guests = await this.guestService.importFromExcel(
      filepath,
      user.id,
      invitationId ? parseInt(invitationId) : undefined,
    );

    // optional: delete file after processing
    fs.unlinkSync(filepath);

    return guests;
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
}
