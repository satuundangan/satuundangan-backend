import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';
import { ValidateAffiliateCodeDto } from './dto/validate-affiliate-code.dto';

@ApiTags('Affiliate')
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register the current authenticated user as a reseller (AFF-01)' })
  async register(
    @Body() dto: RegisterAffiliateDto,
    @CurrentUser() user: User,
  ) {
    const profile = await this.affiliateService.register(user.id, dto);
    return {
      success: true,
      data: {
        id: profile.id,
        affiliate_code: profile.affiliateCode,
        tier: profile.tier,
        status: profile.status,
      },
    };
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate an affiliate code (used at checkout; public endpoint)' })
  async validate(@Body() dto: ValidateAffiliateCodeDto) {
    const result = await this.affiliateService.validateAffiliateCode(dto.code);
    if (!result.valid) {
      return { success: false, message: result.message };
    }
    return {
      success: true,
      data: { affiliate_profile_id: result.affiliateProfileId },
    };
  }
}
