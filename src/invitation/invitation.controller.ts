import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Header,
  Headers,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';

@Controller(['invitation', 'invitations'])
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Create a new invitation' })
  @ApiBody({ type: CreateInvitationDto })
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user: User) {
    return this.invitationService.create(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.invitationService.findAllByUser(user.id, query);
  }

  @Get(':id')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Get an invitation by ID' })
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invitationService.findOneById(+id, user);
  }

  @Patch(':id')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Update an invitation' })
  @ApiBody({ type: UpdateInvitationDto })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvitationDto,
    @CurrentUser() user: User,
  ) {
    return this.invitationService.update(+id, dto, user);
  }

  @Delete(':id')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Delete an invitation' })
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invitationService.remove(+id, user);
  }

  @Get('my/slug/:slug')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Find own invitation by slug (requires auth)' })
  @UseGuards(JwtAuthGuard)
  findMySlug(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.invitationService.findBySlugForOwner(slug, user.id);
  }

  @Get('slug/:slug/live-feed')
  @ApiTags('Invitation')
  @ApiOperation({
    summary:
      'Feed data real-time untuk Layar Sapa & Proyektor Panggung (SAT-64, SAT-73)',
  })
  async getLiveScreenFeed(
    @Param('slug') slug: string,
    @Query('preview') preview?: string,
    @Headers('if-none-match') ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.invitationService.getLiveScreenFeed(slug, {
      preview: preview === 'true',
      ifNoneMatch,
    });

    if (res && result.etag) {
      res.setHeader('ETag', result.etag);
      res.setHeader('Cache-Control', 'private, no-cache');
    }

    if (result.notModified) {
      if (res) res.status(HttpStatus.NOT_MODIFIED);
      return;
    }

    return result;
  }

  @Get('slug/:slug')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Find an invitation by slug' })
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=120')
  findBySlug(@Param('slug') slug: string) {
    return this.invitationService.findBySlug(slug);
  }

  @Get('subdomain/check')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Check custom subdomain availability (live)' })
  checkSubdomain(
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.invitationService.checkSubdomainAvailability(
      value,
      excludeId ? +excludeId : undefined,
    );
  }

  @Get('subdomain/:subdomain')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Resolve a published invitation by subdomain' })
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=120')
  findBySubdomain(@Param('subdomain') subdomain: string) {
    return this.invitationService.findBySubdomain(subdomain);
  }

  @Get('slug/:invitationSlug/guest/:guestSlug')
  @Header('Cache-Control', 'private, no-store')
  async getInvitationWithGuest(
    @Param('invitationSlug') invitationSlug: string,
    @Param('guestSlug') guestSlug: string,
  ) {
    return this.invitationService.findWithGuest(invitationSlug, guestSlug);
  }

  @Get('categories')
  @ApiTags('Invitation')
  @ApiOperation({ summary: 'Get invitation categories' })
  getCategories() {
    return [
      { key: 'semua', label: 'Semua' },
      { key: 'premium', label: 'Premium' },
      { key: 'eksklusif', label: 'Eksklusif' },
      { key: 'gratis', label: 'Gratis' },
    ];
  }
}
