import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTierConfigDto {
  @ApiPropertyOptional({ example: 5, description: 'Minimum total sales count for this tier' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSales?: number;

  @ApiPropertyOptional({ example: 0.15, description: 'Commission rate (0..1, e.g. 0.15 = 15%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;
}
