import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({
    example: 100000,
    description: 'Minimum withdrawal amount in IDR (ADM-06)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minWithdrawalAmount?: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Days from PENDING to CLEARED (ADM-07)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  clearingPeriodDays?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Months of inactivity before tier downgrade (ADM-08)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  inactivityDowngradeMonths?: number;
}
