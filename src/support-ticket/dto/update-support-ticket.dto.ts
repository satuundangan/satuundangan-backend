import { PartialType } from '@nestjs/swagger';
import { CreateSupportTicketDto } from './create-support-ticket.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupportTicketDto extends PartialType(CreateSupportTicketDto) {
  @ApiPropertyOptional({
    description: 'Status tiket bantuan',
    enum: ['open', 'in_progress', 'resolved', 'closed'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Staff yang ditugaskan' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Catatan penyelesaian masalah' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional({ description: 'Pesan balasan baru untuk tiket' })
  @IsOptional()
  @IsString()
  newMessage?: string;

  @ApiPropertyOptional({
    description: 'Pengirim pesan baru',
    enum: ['customer', 'staff'],
    default: 'staff',
  })
  @IsOptional()
  @IsString()
  sender?: 'customer' | 'staff';

  @ApiPropertyOptional({ description: 'Nama penulis pesan baru' })
  @IsOptional()
  @IsString()
  authorName?: string;
}
