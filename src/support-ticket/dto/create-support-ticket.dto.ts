import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTicketMessage } from '../support-ticket.entity';

export class CreateSupportTicketDto {
  @ApiProperty({ description: 'Subjek tiket bantuan' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Kategori masalah',
    enum: ['order', 'invitation', 'payment', 'technical', 'other'],
    default: 'other',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Prioritas tiket',
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Kanal komunikasi',
    enum: ['whatsapp', 'email', 'web_form'],
    default: 'web_form',
  })
  @IsOptional()
  @IsString()
  contactChannel?: string;

  @ApiProperty({ description: 'Nama pelanggan' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiPropertyOptional({ description: 'Nomor telepon / WhatsApp pelanggan' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Email pelanggan' })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiPropertyOptional({ description: 'ID undangan terkait' })
  @IsOptional()
  @IsNumber()
  invitationId?: number;

  @ApiPropertyOptional({ description: 'ID pesanan / orderId terkait' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Tanggal pernikahan pelanggan' })
  @IsOptional()
  weddingDate?: Date | string;

  @ApiPropertyOptional({ description: 'Pesan / keluhan awal pelanggan' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Riwayat pesan' })
  @IsOptional()
  @IsArray()
  messages?: SupportTicketMessage[];
}
