import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WeddingPlannerService } from './wedding-planner.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Wedding Planner')
@Controller('wedding-planner')
export class WeddingPlannerController {
  constructor(private readonly plannerService: WeddingPlannerService) {}

  @Get('public/rundown/:token')
  @ApiOperation({ summary: 'Public read-only technical rundown for WO & core family (SAT-72)' })
  getPublicRundown(@Param('token') token: string) {
    return this.plannerService.getPublicRundownByToken(token);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user wedding planner' })
  getPlanner(@CurrentUser() user: User) {
    return this.plannerService.getPlanner(user.id);
  }

  @Post('unlock')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlock wedding planner via IG follow & share' })
  unlockAccess(
    @CurrentUser() user: User,
    @Body() body: { instagramHandle?: string; platform?: string },
  ) {
    return this.plannerService.unlockAccess(user.id, body);
  }

  @Put()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update wedding planner state' })
  updatePlanner(
    @CurrentUser() user: User,
    @Body() body: any,
  ) {
    return this.plannerService.updatePlanner(user.id, body);
  }

  @Post('reset')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reset planner to curated defaults' })
  resetDefaults(@CurrentUser() user: User) {
    return this.plannerService.resetToDefaults(user.id);
  }

  @Post('rundown-share')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate or retrieve shareable WO technical rundown token (SAT-72)' })
  generateRundownShareToken(@CurrentUser() user: User) {
    return this.plannerService.generateOrGetRundownShareToken(user.id);
  }
}
