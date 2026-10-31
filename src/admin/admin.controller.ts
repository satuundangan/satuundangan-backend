import {
  Controller,
  BadRequestException,
  Get,
  Query,
  UseGuards,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Req,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { LogQueryDto } from './dto/log-query.dto';
import { DashboardStatsQueryDto } from './dto/dashboard-stats-query.dto';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';
import {
  CreateTemplateDesignDto,
  UpdateTemplateDesignDto,
} from './dto/template-design.dto';
import {
  CreatePaletteColorDto,
  UpdatePaletteColorDto,
} from './dto/palette-color.dto';
import { ApiTags } from '@nestjs/swagger';
import { PromoService } from '../promo/promo.service';
import { AdminHealthService } from './admin-health.service';
import { AdminAuditService } from './security/admin-audit.service';
import { AuditLogQueryDto, UpdateAdminRoleDto } from './dto/admin-security.dto';
import { CreatePromoCodeDto } from '../promo/dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from '../promo/dto/update-promo-code.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import {
  UpdateAudioMetadataDto,
  UploadAudioMetadataDto,
} from './dto/audio-metadata.dto';

function requireAdminReason(req: { headers?: Record<string, unknown> }) {
  const reason = String(req?.headers?.['x-admin-reason'] ?? '').trim();
  if (reason.length < 5) {
    throw new BadRequestException(
      'Alasan operasional minimal 5 karakter diperlukan dan dicatat pada audit log.',
    );
  }
}

const AUDIO_UPLOAD_MAX_FILE_SIZE_BYTES =
  (Number(process.env.AUDIO_UPLOAD_MAX_FILE_SIZE_MB) ||
    Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) ||
    25) *
  1024 *
  1024;

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly promoService: PromoService,
    private readonly health: AdminHealthService,
    private readonly audit: AdminAuditService,
  ) {}

  // Users
  @Get('users')
  listUsers(@Query() q: AdminUsersQueryDto) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder } = q;
    return this.service.listUsers(page, limit, search, sortBy, sortOrder, q);
  }

  @Get('users/stats')
  getUserStats() {
    return this.service.getUserStats();
  }

  @Get('users/:id/customer')
  getCustomerDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCustomerDetail(id);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.service.getUser(id);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.service.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminUserDto,
    @Req() req: any,
  ) {
    requireAdminReason(req);
    return this.service.updateUser(id, dto);
  }

  @Post('users/:id/verify-email')
  verifyUserEmail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    requireAdminReason(req);
    return this.service.verifyUserEmail(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    requireAdminReason(req);
    return this.service.deleteUser(id);
  }

  // Invitations
  @Get('invitations')
  listInvitations(
    @Query() q: PaginationQueryDto,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('isPublished') isPublished?: string,
    @Query('package') packageType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
  ) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder } = q;
    return this.service.listInvitations(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      paymentStatus,
      isPublished,
      packageType,
      startDate,
      endDate,
      category,
    );
  }

  @Get('invitations/:id/detail')
  getInvitationDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInvitationDetail(id);
  }

  @Get('invitations/:id')
  getInvitation(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInvitation(id);
  }

  @Delete('invitations/:id')
  deleteInvitation(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteInvitation(id);
  }

  @Patch('invitations/:id')
  updateInvitation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req?: any,
  ) {
    return this.service.updateInvitation(id, body, req?.user);
  }

  // Payments & Transactions (PKG-02: ADM-009 s/d ADM-015)
  @Get('payments')
  listPayments(
    @Query() q: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('purpose') purpose?: string,
    @Query('package') packageType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('kind') kind?: string,
  ) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder } = q;
    return this.service.listPayments(
      page,
      limit,
      search,
      status,
      purpose,
      packageType,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      kind,
    );
  }

  @Get('payments/stats')
  getPaymentStats() {
    return this.service.getPaymentStats();
  }

  @Get('payments/reconciliation-queue')
  getPaymentReconciliationQueue() {
    return this.service.getReconciliationQueue();
  }

  @Get('payments/export')
  exportPayments(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('purpose') purpose?: string,
    @Query('package') packageType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('kind') kind?: string,
  ) {
    return this.service.exportPayments(
      q,
      status,
      purpose,
      packageType,
      startDate,
      endDate,
      kind,
    );
  }

  @Get('payments/:id')
  getPaymentDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPaymentDetail(id);
  }

  @Post('payments/:id/reconcile-publish')
  reconcilePaymentPublish(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    return this.service.reconcilePaymentPublish(id, reason, req?.user);
  }

  @Post('payments/:id/sync-gateway')
  syncPaymentGateway(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    return this.service.syncPaymentGateway(id, req?.user);
  }

  // Guests
  @Get('guests')
  listGuests(@Query() q: PaginationQueryDto) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder } = q;
    return this.service.listGuests(page, limit, search, sortBy, sortOrder);
  }

  @Get('guests/:id')
  getGuest(@Param('id') id: number) {
    return this.service.getGuest(id);
  }

  @Patch('guests/:id')
  updateGuest(@Param('id') id: number, @Body() dto: any) {
    return this.service.updateGuest(id, dto);
  }

  @Delete('guests/:id')
  deleteGuest(@Param('id') id: number) {
    return this.service.deleteGuest(id);
  }

  // Guest Messages
  @Get('guest-messages')
  listGuestMessages(@Query() q: PaginationQueryDto) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder } = q;
    return this.service.listGuestMessages(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    );
  }

  @Delete('guest-messages/:id')
  deleteGuestMessage(@Param('id') id: number) {
    return this.service.deleteGuestMessage(id);
  }

  // Template Designs
  @Get('template-designs')
  listTemplateDesigns(@Query() q: PaginationQueryDto) {
    const { page = 1, limit = 20, q: search, sortBy, sortOrder, filters } = q;
    return this.service.listTemplateDesigns(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      filters,
    );
  }

  @Get('template-designs/metrics')
  getTemplateDesignMetrics(
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getTemplateDesignMetrics({
      days: days ? Number(days) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('template-designs/:id')
  getTemplateDesign(@Param('id') id: number) {
    return this.service.getTemplateDesign(id);
  }

  @Post('template-designs')
  createTemplateDesign(@Body() dto: CreateTemplateDesignDto) {
    return this.service.createTemplateDesign(dto);
  }

  @Patch('template-designs/:id')
  updateTemplateDesign(
    @Param('id') id: number,
    @Body() dto: UpdateTemplateDesignDto,
  ) {
    return this.service.updateTemplateDesign(id, dto);
  }

  @Delete('template-designs/:id')
  deleteTemplateDesign(@Param('id') id: number) {
    return this.service.deleteTemplateDesign(id);
  }

  // Sections
  @Get('sections')
  listSections(@Query('q') q?: string) {
    return this.service.listSections(q);
  }

  @Post('sections')
  createSection(@Body() body: any) {
    return this.service.createSection(body);
  }

  @Patch('sections/:id')
  updateSection(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSection(id, body);
  }

  @Delete('sections/:id')
  deleteSection(@Param('id') id: string) {
    return this.service.deleteSection(id);
  }

  // Audio
  @Get('audio')
  listAudio(@Query('q') q?: string) {
    return this.service.listAudio(q);
  }

  @Post('audio')
  createAudio(@Body() body: any) {
    return this.service.createAudio(body);
  }

  @Patch('audio/:id')
  updateAudioMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateAudioMetadataDto,
  ) {
    return this.service.updateAudioMetadata(id, dto);
  }

  @Post('audio/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: AUDIO_UPLOAD_MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  uploadAudio(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: AUDIO_UPLOAD_MAX_FILE_SIZE_BYTES,
          }),
          new FileTypeValidator({ fileType: /^audio\/(mpeg|mp3)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: UploadAudioMetadataDto,
  ) {
    return this.service.uploadAudio(file, body);
  }

  @Delete('audio/:id')
  deleteAudio(@Param('id') id: string) {
    return this.service.deleteAudio(id);
  }

  // Banks
  @Get('banks')
  listBanks(@Query('q') q?: string) {
    return this.service.listBanks(q);
  }

  @Post('banks')
  createBank(@Body() body: any) {
    return this.service.createBank(body);
  }

  @Patch('banks/:id')
  updateBank(@Param('id') id: string, @Body() body: any) {
    return this.service.updateBank(id, body);
  }

  @Delete('banks/:id')
  deleteBank(@Param('id') id: string) {
    return this.service.deleteBank(id);
  }

  // Palette Colors
  @Get('palette-colors')
  listPaletteColors(@Query() q: PaginationQueryDto) {
    const { page = 1, limit = 20, q: search } = q;
    return this.service.listPaletteColors(page, limit, search);
  }

  @Post('palette-colors')
  createPaletteColor(@Body() dto: CreatePaletteColorDto) {
    return this.service.createPaletteColor(dto);
  }

  @Patch('palette-colors/:id')
  updatePaletteColor(
    @Param('id') id: string,
    @Body() dto: UpdatePaletteColorDto,
  ) {
    return this.service.updatePaletteColor(id, dto);
  }

  @Delete('palette-colors/:id')
  deletePaletteColor(@Param('id') id: string) {
    return this.service.deletePaletteColor(id);
  }

  // Promo Codes
  @Get('promo-codes')
  listPromoCodes(@Query() q: PaginationQueryDto) {
    const { page = 1, limit = 20, q: search } = q;
    return this.promoService.list(page, limit, search);
  }

  @Post('promo-codes')
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.promoService.create(dto);
  }

  @Patch('promo-codes/:id')
  updatePromoCode(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promoService.update(id, dto);
  }

  @Delete('promo-codes/:id')
  deletePromoCode(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.remove(id);
  }

  @Get('health')
  getSystemHealth(@Query('refresh') refresh?: string) {
    return this.health.check(refresh === '1');
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.audit.list(query);
  }

  @Patch('users/:id/admin-role')
  updateAdminRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminRoleDto,
    @Req() req: { user: { id: number }; headers?: Record<string, unknown> },
  ) {
    requireAdminReason(req);
    return this.service.updateAdminRole(id, dto.adminRole, req.user.id);
  }

  @Get('stats')
  getDashboardStats(@Query() query?: DashboardStatsQueryDto) {
    return this.service.getDashboardStats(query);
  }

  // System & Activity Logs
  @Get('logs')
  listLogs(@Query() q: LogQueryDto) {
    return this.service.listLogs(
      q.page,
      q.limit,
      q.level,
      q.action,
      q.q,
      q.userId,
    );
  }

  @Get('logs/stats')
  getLogStats() {
    return this.service.getLogStats();
  }

  @Delete('logs')
  clearLogs() {
    return this.service.clearLogs();
  }
}
