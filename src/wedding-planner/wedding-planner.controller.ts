import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WeddingPlannerService } from './wedding-planner.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Wedding Planner')
@ApiBearerAuth()
@Controller('wedding-planner')
@UseGuards(JwtAuthGuard)
export class WeddingPlannerController {
  constructor(private readonly plannerService: WeddingPlannerService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wedding planner' })
  getPlanner(@CurrentUser() user: User) {
    return this.plannerService.getPlanner(user.id);
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Unlock wedding planner via IG follow & share' })
  unlockAccess(
    @CurrentUser() user: User,
    @Body() body: { instagramHandle?: string; platform?: string },
  ) {
    return this.plannerService.unlockAccess(user.id, body);
  }

  @Put()
  @ApiOperation({ summary: 'Update wedding planner state' })
  updatePlanner(
    @CurrentUser() user: User,
    @Body() body: any,
  ) {
    return this.plannerService.updatePlanner(user.id, body);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset planner to curated defaults' })
  resetDefaults(@CurrentUser() user: User) {
    return this.plannerService.resetToDefaults(user.id);
  }
}
