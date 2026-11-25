import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateGiftRegistryItemDto {
  @IsNotEmpty({ message: 'Nama kado / wishlist wajib diisi' })
  @IsString()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceEstimate?: number;

  @IsOptional()
  @IsString()
  productUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
