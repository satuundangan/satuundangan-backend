import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const AUDIO_LICENSE_STATUSES = [
  'unknown',
  'pending',
  'recorded',
  'restricted',
] as const;

type AudioLicenseStatus = (typeof AUDIO_LICENSE_STATUSES)[number];

export class UploadAudioMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  credit?: string;

  @IsOptional()
  @IsIn(AUDIO_LICENSE_STATUSES)
  licenseStatus?: AudioLicenseStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class UpdateAudioMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  credit?: string;

  @IsOptional()
  @IsIn(AUDIO_LICENSE_STATUSES)
  licenseStatus?: AudioLicenseStatus;
}
