import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({ example: 'Budi & Ani' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '08123456789' })
  @IsNotEmpty()
  @IsString()
  whatsapp: string;

  @ApiPropertyOptional({ example: 'budi@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '2026-12-25' })
  @IsOptional()
  @IsString()
  weddingDate?: string;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @IsNumber()
  estimatedBudget?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  guestCount?: number;

  @ApiPropertyOptional({ example: 'Modern Elegant' })
  @IsOptional()
  @IsString()
  concept?: string;

  @ApiPropertyOptional({ example: { catering: 25000000, decoration: 10000000 } })
  @IsOptional()
  breakdown?: Record<string, any>;

  @ApiPropertyOptional({ example: 'budget_calculator' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'Pernikahan di Jakarta Barat' })
  @IsOptional()
  @IsString()
  notes?: string;
}
