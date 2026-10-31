import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadNote } from '../lead.entity';

export class CreateLeadDto {
  @ApiProperty({ description: 'Nama calon pengantin / kontak lead' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Nomor WhatsApp kontak lead' })
  @IsString()
  @IsNotEmpty()
  whatsapp: string;

  @ApiPropertyOptional({ description: 'Email lead' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Tanggal pernikahan' })
  @IsOptional()
  weddingDate?: Date | string;

  @ApiPropertyOptional({ description: 'Estimasi budget pernikahan (IDR)' })
  @IsOptional()
  @IsNumber()
  estimatedBudget?: number;

  @ApiPropertyOptional({ description: 'Estimasi jumlah tamu' })
  @IsOptional()
  @IsNumber()
  guestCount?: number;

  @ApiPropertyOptional({ description: 'Konsep atau tema pernikahan' })
  @IsOptional()
  @IsString()
  concept?: string;

  @ApiPropertyOptional({ description: 'Breakdown budget atau rincian kustom' })
  @IsOptional()
  breakdown?: any;

  @ApiPropertyOptional({
    description: 'Sumber lead',
    example: 'budget_calculator',
    default: 'organic',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Stage lead',
    enum: ['new', 'contacted', 'qualified', 'won', 'lost'],
    default: 'new',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ description: 'Owner / penanggung jawab lead' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Batas waktu follow-up' })
  @IsOptional()
  dueDate?: Date | string;

  @ApiPropertyOptional({ description: 'Catatan awal lead' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Daftar riwayat catatan' })
  @IsOptional()
  @IsArray()
  notes?: LeadNote[];

  @ApiPropertyOptional({ description: 'ID user terdaftar bila ada' })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({ description: 'ID order bila telah memesan' })
  @IsOptional()
  @IsNumber()
  orderId?: number;
}
