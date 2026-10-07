import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { TelemetryLogDto } from './dto/telemetry-log.dto';

import { extractClientIp } from '../common/utils/ip.util';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly adminService: AdminService) {}

  @Post('log')
  async logClientEvent(@Body() dto: TelemetryLogDto, @Req() req: Request) {
    const ip = extractClientIp(req);
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
