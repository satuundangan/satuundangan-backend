import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidatePromoDto {
  @ApiProperty({ example: 'NIKAH50' })
  @IsString()
  code: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  invitation_id: number;

  @ApiPropertyOptional({
    example: 179000,
    description: 'Package price to discount against (checkout tier).',
  })
  @IsOptional()
  @IsNumber()
  base_amount?: number;
}
