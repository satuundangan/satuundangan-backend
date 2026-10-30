import { PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({
    description: 'Tambah catatan baru (akan diappend ke array notes)',
  })
  @IsOptional()
  @IsString()
  newNote?: string;

  @ApiPropertyOptional({
    description: 'Nama penulis catatan baru',
  })
  @IsOptional()
  @IsString()
  noteAuthor?: string;
}
