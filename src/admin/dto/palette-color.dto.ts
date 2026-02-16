import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreatePaletteColorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  primary: string;

  @IsString()
  @IsNotEmpty()
  secondary: string;

  @IsString()
  @IsNotEmpty()
  accent: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

import { PartialType } from '@nestjs/mapped-types';
export class UpdatePaletteColorDto extends PartialType(CreatePaletteColorDto) {}
