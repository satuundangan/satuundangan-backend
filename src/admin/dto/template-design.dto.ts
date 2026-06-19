import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateTemplateDesignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  previewUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  showBranding?: boolean;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsOptional()
  @IsString()
  paletteId?: string;

  @IsOptional()
  paletteColors?: string[];

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  tags?: any;

  @IsOptional()
  @IsString()
  defaultMusic?: string | null;

  @IsOptional()
  @IsNumber()
  defaultAudioStart?: number | null;

  @IsOptional()
  @IsNumber()
  defaultAudioEnd?: number | null;

  @IsOptional()
  sections?: {
    sectionId: string;
    order: number;
    is_enabled: boolean;
  }[];
}

export class UpdateTemplateDesignDto extends PartialType(
  CreateTemplateDesignDto,
) {}
