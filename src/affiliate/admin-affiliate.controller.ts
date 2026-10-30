import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AffiliateConfigService } from './affiliate-config.service';
import { AffiliateService } from './affiliate.service';
import { UpdateTierConfigDto } from './dto/update-tier-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@ApiTags('Admin Affiliate')
@Controller('admin/affiliate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAffiliateController {
  constructor(
    private readonly configService: AffiliateConfigService,
    private readonly affiliateService: AffiliateService,
  ) {}

  @Get('resellers')
  @ApiOperation({ summary: 'List all resellers with stats (ADM-01)' })
  async listResellers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.affiliateService.adminListResellers(
      Number(page),
      Number(limit),
      search,
      status,
    );
  }

  @Post('resellers/:id/status')
  @ApiOperation({
    summary: 'Update reseller status (suspend/blacklist) (ADM-09, ADM-10)',
  })
  async updateResellerStatus(
    @Param('id') id: number,
    @Body('status') status: string,
  ) {
    return this.affiliateService.adminUpdateResellerStatus(id, status);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List pending withdrawal queue (ADM-02)' })
  async listWithdrawals(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.affiliateService.adminListWithdrawals(
      status,
      Number(page),
      Number(limit),
    );
  }

  @Get('commissions')
  @ApiOperation({
    summary: 'List settlement-backed reseller commission ledger rows',
  })
  async listCommissions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
    @Query('affiliateProfileId') affiliateProfileId?: string,
  ) {
    return this.affiliateService.adminListCommissions(
      Number(page),
      Number(limit),
      status,
      affiliateProfileId ? Number(affiliateProfileId) : undefined,
    );
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve withdrawal and upload proof (ADM-03)' })
  async approveWithdrawal(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: User,
    @Body('proofUrl') proofUrl?: string,
    @Body('adminNote') adminNote?: string,
  ) {
    return this.affiliateService.adminApproveWithdrawal(
      id,
      proofUrl,
      adminNote,
      admin.id,
    );
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal with reason (ADM-04)' })
  async rejectWithdrawal(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote: string,
    @CurrentUser() admin: User,
  ) {
    return this.affiliateService.adminRejectWithdrawal(id, adminNote, admin.id);
  }

  @Get('tier-config')
  @ApiOperation({ summary: 'List all tier configs (ADM-05)' })
  async listTierConfigs() {
    const data = await this.configService.listTierConfigs();
    return {
      success: true,
      data: data.map((c) => ({
        id: c.id,
        tier: c.tier,
        min_sales: Number(c.minSales),
        commission_rate: Number(c.commissionRate),
        updated_at: c.updatedAt,
      })),
    };
  }

  @Patch('tier-config/:tier')
  @ApiOperation({
    summary: 'Update tier threshold + commission rate (ADM-05, TIER-02)',
  })
  async updateTierConfig(
    @Param('tier') tier: string,
    @CurrentUser() admin: User,
    @Body() dto: UpdateTierConfigDto,
  ) {
    const updated = await this.configService.updateTierConfig(
      tier,
      dto,
      admin.id,
    );
    return {
      success: true,
      data: {
        id: updated.id,
        tier: updated.tier,
        min_sales: Number(updated.minSales),
        commission_rate: Number(updated.commissionRate),
      },
    };
  }

  @Get('system-config')
  @ApiOperation({
    summary:
      'Get system config (min withdraw, clearing period, inactivity period)',
  })
  async getSystemConfig() {
    const data = await this.configService.getSystemConfig();
    return { success: true, data };
  }

  @Get('config-history')
  @ApiOperation({ summary: 'List effective affiliate config changes' })
  async getConfigHistory() {
    return {
      success: true,
      data: await this.configService.listConfigHistory(),
    };
  }

  @Get('job-runs')
  @ApiOperation({ summary: 'List recent affiliate scheduler runs' })
  async getJobRuns() {
    return { success: true, data: await this.configService.listJobRuns() };
  }

  @Patch('system-config')
  @ApiOperation({ summary: 'Update system config (ADM-06, ADM-07, ADM-08)' })
  async updateSystemConfig(
    @CurrentUser() admin: User,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    const data = await this.configService.updateSystemConfig(dto, admin.id);
    return { success: true, data };
  }
}
