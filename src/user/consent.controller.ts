import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsentService } from './consent.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
    // Get IP address reliably
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.consentService.recordConsent(
      user.id || user.sub,
      dto,
      Array.isArray(ip) ? ip[0] : ip,
      userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({ summary: 'Check user consent status' })
  async getStatus(@CurrentUser() user: any) {
    const isApproved = await this.consentService.checkConsent(user.id || user.sub);
    return { isApproved };
  }
}
