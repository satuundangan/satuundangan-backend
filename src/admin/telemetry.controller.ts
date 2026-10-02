import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { TelemetryLogDto } from './dto/telemetry-log.dto';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly adminService: AdminService) {}

  @Post('log')
  async logClientEvent(@Body() dto: TelemetryLogDto, @Req() req: Request) {
    const rawIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      '';
    const ip = rawIp.split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] as string) || '';

    // If user is authenticated via Bearer token, we can optionally parse userId/email
    const authHeader = req.headers['authorization'];
    let userEmail = dto.userEmail;

    await this.adminService.recordLog({
      action: dto.action,
      level: dto.level || 'INFO',
      path: dto.path,
      method: dto.method || 'PAGE',
      details: dto.details,
      userEmail,
      ip,
      userAgent,
    });

    return { success: true };
  }
}
