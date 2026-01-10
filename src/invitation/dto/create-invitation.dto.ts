import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum QuoteSource {
  ISLAM = 'islam',
  KATOLIK = 'katolik',
  KRISTEN = 'kristen',
  BUDHA = 'budha',
  HINDU = 'hindu',
  BEBAS = 'bebas',
}

// Nested DTO Classes
export class LoveStoryItem {
  @ApiProperty({ example: 'Awal Bertemu' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Kami bertemu di kampus' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: '2018-09-01' })
  @IsOptional()
  @IsString()
  date?: string;
}

export class Menu {
  @ApiProperty({ example: 'Menu Makanan' })
  @IsString()
  title: string;

  @ApiProperty({ example: ['Ayam Bakar', 'Sate Padang', 'Es Buah'] })
  @IsArray()
  @IsString({ each: true })
  items: string[];
}

export class SocialMedia {
  @ApiPropertyOptional({ example: 'https://instagram.com/bride_groom' })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({ example: 'https://tiktok.com/@bridegroom' })
  @IsOptional()
  @IsString()
  tiktok?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/user/groombride' })
  @IsOptional()
  @IsString()
  youtube?: string;

  @ApiPropertyOptional({ example: 'https://linktr.ee/bridegroom' })
  @IsOptional()
  @IsString()
  lainnya?: string;
}

export class ParentName {
  @ApiProperty({ example: 'Bapak & Ibu Mempelai Wanita' })
  @IsString()
  brideParents: string;

  @ApiProperty({ example: 'Bapak & Ibu Mempelai Pria' })
  @IsString()
  groomParents: string;
}

export class LocationDetail {
  @ApiProperty({ example: 'https://maps.google.com/akad' })
  @IsString()
  mapUrl: string;

  @ApiProperty({ example: 'Masjid Raya Al Azhar' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2025-12-20T09:00:00' })
  @IsDateString()
  dateTime: string;
}

// Main DTO
export class CreateInvitationDto {
  @ApiProperty({ example: 'Undangan Tes Postman' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'undangan-tes-postman' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'John & Jane' })
  @IsOptional()
  @IsString()
  coupleName?: string;

  @ApiPropertyOptional({ example: 'TemplateClassic01' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ enum: QuoteSource, example: 'bebas' })
  @IsEnum(QuoteSource)
  quoteSource: QuoteSource;

  @ApiPropertyOptional({ example: 'Bismillah, semoga lancar!' })
  @IsOptional()
  @IsString()
  quoteText?: string;

  @ApiProperty({ type: [LoveStoryItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoveStoryItem)
  loveStory: LoveStoryItem[];

  @ApiProperty({ example: 'default1.mp3' })
  @IsString()
  musicChoice: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isCustomMusic: boolean;

  @ApiProperty({ example: 'https://cdn.com/photo.jpg' })
  @IsString()
  bridePhotoUrl: string;

  @ApiProperty({ type: LocationDetail })
  @ValidateNested()
  @Type(() => LocationDetail)
  akadLocation: LocationDetail;

  @ApiProperty({ type: LocationDetail })
  @ValidateNested()
  @Type(() => LocationDetail)
  resepsiLocation: LocationDetail;

  @ApiProperty({ example: false })
  @IsBoolean()
  mergeEvents: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  encryptedGuestName: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.com/denah.jpg' })
  @IsOptional()
  @IsString()
  floorPlanImageUrl?: string;

  @ApiProperty({ type: Menu })
  @ValidateNested()
  @Type(() => Menu)
  menu: Menu;

  @ApiProperty({
    example: ['https://cdn.com/gallery1.jpg', 'https://cdn.com/gallery2.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  galleryImages: string[];

  @ApiProperty({ example: 'Jl. Kenangan No. 123, Jakarta' })
  @IsString()
  giftDeliveryAddress: string;

  @ApiPropertyOptional({ example: 'https://saweria.co/bridegroom' })
  @IsOptional()
  @IsString()
  eWalletLink?: string;

  @ApiProperty({ type: SocialMedia })
  @ValidateNested()
  @Type(() => SocialMedia)
  socialMedia: SocialMedia;

  @ApiProperty({ type: ParentName })
  @ValidateNested()
  @Type(() => ParentName)
  parents: ParentName;

  @ApiPropertyOptional({ example: 'https://youtube.com/livestream' })
  @IsOptional()
  @IsString()
  liveStreamingLink?: string;

  @ApiPropertyOptional({ example: ['akad', 'resepsi', 'galeri'] })
  selectedSections?: string[];

  @ApiProperty({ example: true })
  @IsBoolean()
  enableGuestMessage: boolean;

  @ApiProperty({ example: 1 })
  @IsNumber()
  templateDesignId: number;

  @ApiPropertyOptional({
    example: 'Halo [GuestName], berikut link undangan kami: [Link]',
  })
  @IsOptional()
  @IsString()
  whatsappMessageTemplate?: string;
}
