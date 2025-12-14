import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, IsHexColor } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsHexColor()
  color: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
