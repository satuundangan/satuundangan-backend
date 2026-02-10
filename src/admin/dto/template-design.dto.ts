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
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsNumber()
  @IsOptional() // Making it optional to avoid breaking existing clients immediately, or IsNotEmpty if required. Requirement implies it's a new field. I'll make it Optional but default 0 in entity.
  price?: number;

  @IsOptional()
  paletteColors?: string[];

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  tags?: any;

  @IsOptional()
  sectionOptions?: any;
}

export class UpdateTemplateDesignDto extends PartialType(
  CreateTemplateDesignDto,
) {}
