import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GiftRegistryService } from './gift-registry.service';
import { CreateGiftRegistryItemDto } from './dto/create-gift-registry-item.dto';
import { UpdateGiftRegistryItemDto } from './dto/update-gift-registry-item.dto';
import { ClaimGiftRegistryItemDto } from './dto/claim-gift-registry-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Gift Registry / Wishlist Kado')
@Controller('gift-registry')
export class GiftRegistryController {
  constructor(private readonly giftRegistryService: GiftRegistryService) {}

  // ==========================================
  // Public Endpoints (Untuk Tamu Undangan)
  // ==========================================

  @ApiOperation({ summary: 'Ambil daftar kado impian publik berdasarkan ID undangan' })
  @Get('public/invitation/:invitationId')
  findPublicByInvitationId(@Param('invitationId', ParseIntPipe) invitationId: number) {
    return this.giftRegistryService.findPublicByInvitationId(invitationId);
  }

  @ApiOperation({ summary: 'Ambil daftar kado impian publik berdasarkan slug undangan' })
  @Get('public/slug/:slug')
  findPublicBySlug(@Param('slug') slug: string) {
    return this.giftRegistryService.findPublicBySlug(slug);
  }

  @ApiOperation({ summary: 'Klaim kado impian oleh tamu (Anti-Kado Kembar)' })
  @Post('public/:id/claim')
  claimItem(
    @Param('id') id: string,
    @Body() dto: ClaimGiftRegistryItemDto,
  ) {
    return this.giftRegistryService.claim(id, dto);
  }

  // ==========================================
  // Owner Endpoints (Dashboard Pasangan Pengantin)
  // ==========================================

  @ApiOperation({ summary: 'Tambah item wishlist kado baru' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('invitation/:invitationId')
  create(
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @Body() dto: CreateGiftRegistryItemDto,
    @CurrentUser() user: any,
  ) {
    return this.giftRegistryService.create(invitationId, dto, user.id);
  }

  @ApiOperation({ summary: 'Ambil seluruh item wishlist kado milik pengantin' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invitation/:invitationId')
  findAllByInvitation(
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @CurrentUser() user: any,
  ) {
    return this.giftRegistryService.findAllByInvitation(invitationId, user.id);
  }

  @ApiOperation({ summary: 'Update info item wishlist kado' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGiftRegistryItemDto,
    @CurrentUser() user: any,
  ) {
    return this.giftRegistryService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Hapus item wishlist kado' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.giftRegistryService.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Reset/batalkan klaim kado agar bisa diklaim tamu lain' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/unclaim')
  unclaim(@Param('id') id: string, @CurrentUser() user: any) {
    return this.giftRegistryService.unclaim(id, user.id);
  }
}
