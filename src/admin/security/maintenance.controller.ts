import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { MaintenanceService } from './maintenance.service';

export class UpdateMaintenanceDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(300) message?: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsISO8601({ strict: true }) until?: string | null;
}

@ApiTags('Maintenance')
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('public/status')
  publicStatus() {
    return this.maintenance.publicStatus();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/maintenance')
  async get() {
    const state = await this.maintenance.get();
    return {
      ...state,
      active: await this.maintenance.isActive(),
      scope: 'Menonaktifkan pembelian baru (POST /payment/create). Situs publik, login, panel admin, dan webhook pembayaran tetap berjalan.',
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('admin/maintenance')
  update(@Body() dto: UpdateMaintenanceDto, @Req() req: { user: { id: number } }) {
    return this.maintenance.update(dto, req.user.id);
  }
}
