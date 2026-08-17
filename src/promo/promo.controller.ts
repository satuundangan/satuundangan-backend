import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Promo')
@Controller('promo')
export class PromoController {

  @Get('active-intent')
  @ApiOperation({ summary: 'Get active exit intent promo' })
  async getActiveIntent() {
    const promo = await this.promoService.getActiveExitIntent();
    if (!promo) return { success: true, data: null };
    return {
      success: true,
      data: {
        code: promo.code,
        discount_type: promo.discountType,
        discount_value: Number(promo.discountValue),
        text: promo.exitIntentText
      }
    };
  }

  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Validate a promo code for an invitation' })
  async validate(@Body() dto: ValidatePromoDto) {
    const result = await this.promoService.validate(
      dto.code,
      dto.invitation_id,
      dto.base_amount,
    );

    if (!result.valid) {
      return { success: false, message: result.message };
    }

    return {
      success: true,
      data: {
        code: result.promoCode!.code,
        discount_type: result.promoCode!.discountType,
        discount_value: Number(result.promoCode!.discountValue),
        original_price: result.originalPrice,
        discount_amount: result.discountAmount,
        final_price: result.finalPrice,
      },
    };
  }

  // --- Admin Management ---

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'List all promo codes (Admin only)' })
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
  ) {
    return this.promoService.list(page, limit, q);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new promo code (Admin only)' })
  async create(@Body() dto: CreatePromoCodeDto) {
    return this.promoService.create(dto);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update a promo code (Admin only)' })
  async update(@Param('id') id: number, @Body() dto: UpdatePromoCodeDto) {
    return this.promoService.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete a promo code (Admin only)' })
  async remove(@Param('id') id: number) {
    await this.promoService.remove(id);
    return { success: true, message: 'Promo code deleted successfully' };
  }
}
