import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';
import { ValidateAffiliateCodeDto } from './dto/validate-affiliate-code.dto';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';

@ApiTags('Affiliate')
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  @ApiBearerAuth()
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

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user affiliate profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.affiliateService.getProfileByUserId(user.id);
  }

  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get reseller dashboard statistics' })
  async getDashboard(@CurrentUser() user: User) {
    return this.affiliateService.getDashboard(user.id);
  }

  @Get('commissions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated commission history' })
  async getCommissions(
    @CurrentUser() user: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.affiliateService.getCommissions(user.id, Number(page), Number(limit));
  }

  @Post('withdraw')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a withdrawal request' })
  async submitWithdraw(
    @CurrentUser() user: User,
    @Body() dto: CreateWithdrawDto,
  ) {
    return this.affiliateService.submitWithdraw(user.id, dto);
  }

  @Get('withdrawals')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get withdrawal request history' })
  async getWithdrawals(@CurrentUser() user: User) {
    return this.affiliateService.getWithdrawals(user.id);
  }
}
