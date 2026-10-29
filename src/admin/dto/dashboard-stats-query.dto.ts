import { IsOptional, IsString } from 'class-validator';

export class DashboardStatsQueryDto {
  @IsOptional()
  @IsString()
  range?: string = '7d';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
