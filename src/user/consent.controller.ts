import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsentService } from './consent.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { extractClientIp } from '../common/utils/ip.util';

@ApiTags('Consent')
@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('record')
  @ApiOperation({ summary: 'Record user legal consent' })
  async recordConsent(
    @CurrentUser() user: any,
    @Body() dto: RecordConsentDto,
    @Req() req: any,
  ) {
    // Get real visitor IP address reliably
    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'];

    return this.consentService.recordConsent(
      user.id || user.sub,
      dto,
      ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({ summary: 'Check user consent status' })
  async getStatus(@CurrentUser() user: any) {
    const isApproved = await this.consentService.checkConsent(
      user.id || user.sub,
    );
    return { isApproved };
  }
}
