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
  @IsNotEmpty()
  previewUrl: string;

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
  sections?: {
    sectionId: string;
    order: number;
    is_enabled: boolean;
  }[];
}

export class UpdateTemplateDesignDto extends PartialType(
  CreateTemplateDesignDto,
) {}
