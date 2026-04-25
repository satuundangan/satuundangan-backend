import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AffiliateConfigService } from './affiliate-config.service';
import { UpdateTierConfigDto } from './dto/update-tier-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@ApiTags('Admin Affiliate')
@Controller('admin/affiliate')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAffiliateController {
  constructor(private readonly configService: AffiliateConfigService) {}

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
  @ApiOperation({ summary: 'Update tier threshold + commission rate (ADM-05, TIER-02)' })
  async updateTierConfig(
    @Param('tier') tier: string,
    @Body() dto: UpdateTierConfigDto,
  ) {
    const updated = await this.configService.updateTierConfig(tier, dto);
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
  @ApiOperation({ summary: 'Get system config (min withdraw, clearing period, inactivity period)' })
  async getSystemConfig() {
    const data = await this.configService.getSystemConfig();
    return { success: true, data };
  }

  @Patch('system-config')
  @ApiOperation({ summary: 'Update system config (ADM-06, ADM-07, ADM-08)' })
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto) {
    const data = await this.configService.updateSystemConfig(dto);
    return { success: true, data };
  }
}
