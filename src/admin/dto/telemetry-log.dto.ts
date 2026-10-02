import { IsOptional, IsString, IsObject } from 'class-validator';

export class TelemetryLogDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @IsOptional()
  @IsString()
  userEmail?: string;
}
