import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimGiftRegistryItemDto {
  @IsNotEmpty({ message: 'Nama Anda wajib diisi saat mengeklaim kado' })
  @IsString()
  @MaxLength(255)
  guestName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
