import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '../promo-code.entity';
import { Expose } from 'class-transformer';

export class CreatePromoCodeDto {
  @ApiProperty({ example: 'NIKAH50' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  @Expose({ name: 'discount_type' })
  discountType: DiscountType;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  @Expose({ name: 'discount_value' })
  discountValue: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Expose({ name: 'max_uses' })
  maxUses?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Expose({ name: 'valid_from' })
  validFrom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Expose({ name: 'valid_until' })
  validUntil?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_active' })
  isActive?: boolean;
}
