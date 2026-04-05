import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Promo')
@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Validate a promo code for an invitation' })
  async validate(@Body() dto: ValidatePromoDto) {
    const result = await this.promoService.validate(
      dto.code,
      dto.invitation_id,
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
}
