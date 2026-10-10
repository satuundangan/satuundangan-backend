import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { InvitationPackage } from '../invitation.entity';
import { Type, Expose, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Religion {
  ISLAM = 'islam',
  KRISTEN = 'kristen',
  KATOLIK = 'katolik',
  HINDU = 'hindu',
  BUDHA = 'budha',
  UMUM = 'umum',
}

export enum InvitationBackgroundType {
  IMAGE = 'image',
  VIDEO = 'video',
}

// varchar(255) columns: reject over-long values with 400 instead of a DB 500.
const VARCHAR_MAX = 255;
const MaxVarchar = () =>
  MaxLength(VARCHAR_MAX, {
    message: '$property maksimal $constraint1 karakter.',
  });

// File fields must hold an uploaded CDN URL, never an inline base64 data: URL.
const NotDataUrl = (each = false) =>
  Matches(/^(?!data:)/, {
    each,
    message:
      '$property harus berupa file yang sudah di-upload, bukan data base64. Silakan upload ulang.',
  });

// URL stored in a varchar(255) column.
const StoredUrl = () => applyDecorators(NotDataUrl(), MaxVarchar());

// Nested DTO Classes
export class LoveStoryItem {
  @ApiProperty({ example: 'Awal Bertemu' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'https://cdn.com/story.jpg' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  image?: string;

  // Legacy key; read path maps it to `image`.
  @ApiPropertyOptional({ example: 'https://cdn.com/story.jpg' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  images?: string;

  @ApiPropertyOptional({ example: 'Kami bertemu di kampus' })
  @IsOptional()
  @IsString()
  description?: string;

  // Legacy key; read path maps it to `description`.
  @ApiPropertyOptional({ example: 'Kami bertemu di kampus' })
  @IsOptional()
  @IsString()
  content?: string;

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

export class BankAccount {
  @ApiProperty({ example: 'BCA' })
  @IsString()
  bankName: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  accountName: string;

  @ApiPropertyOptional({ example: 'https://cdn.com/bca.png' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  bankLogoUrl?: string;

  // Key the studio editor sends; bankLogoUrl kept for legacy rows.
  @ApiPropertyOptional({ example: 'https://cdn.com/bca.png' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  bankLogo?: string;
}

export class EWalletLinkItem {
  @ApiProperty({ example: 'DANA' })
  @IsString()
  wallet_provider: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  wallet_number: string;

  @ApiPropertyOptional({ example: 'https://cdn.com/qris.png' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  wallet_image?: string;
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

export class InvitationDesignSettingsDto {
  @ApiPropertyOptional({ example: 'Cormorant Garamond' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.8)
  @Max(1.2)
  titleScale?: number;

  @ApiPropertyOptional({ enum: InvitationBackgroundType, example: 'image' })
  @IsOptional()
  @IsEnum(InvitationBackgroundType)
  backgroundType?: 'image' | 'video';

  @ApiPropertyOptional({ example: 'https://cdn.satuundangan.id/cover.webp' })
  @IsOptional()
  @IsString()
  @NotDataUrl()
  backgroundUrl?: string;

  @ApiPropertyOptional({
    example:
      'Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud mengundang Anda untuk hadir dalam hari bahagia kami.',
    maxLength: 400,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(400)
  @NotDataUrl()
  heroCopy?: string;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'HH:mm 24 jam (WIB). String kosong = pakai default template.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/, {
    message: 'eventStartTime harus berformat HH:mm (24 jam)',
  })
  eventStartTime?: string;

  @ApiPropertyOptional({
    example: '12:30',
    description: 'HH:mm 24 jam (WIB). String kosong = pakai default template.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/, {
    message: 'eventEndTime harus berformat HH:mm (24 jam)',
  })
  eventEndTime?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hideRundown?: boolean;
}

export class CreateInvitationDto {
  @ApiProperty({ example: 'Undangan Tes Postman' })
  @IsString()
  @MaxVarchar()
  title: string;

  @ApiPropertyOptional({ example: 'undangan-tes-postman' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  slug?: string;

  @ApiPropertyOptional({
    enum: InvitationPackage,
    example: InvitationPackage.BASIC,
    description: 'Pricing tier. Set at checkout. Gates premium features.',
  })
  @IsOptional()
  @IsEnum(InvitationPackage)
  package?: InvitationPackage;

  @ApiPropertyOptional({
    example: 'rina-budi',
    description:
      'Custom subdomain (tier Eksklusif) → <value>.satuundangan.id. Dinormalisasi + dicek unik di server.',
  })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiPropertyOptional({ example: 'John & Jane' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  coupleName?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxVarchar()
  groomName: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxVarchar()
  brideName: string;

  @ApiPropertyOptional({ example: 'TemplateClassic01' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  templateName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_published' })
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Allow anyone with the invitation link to view it.',
  })
  @IsOptional()
  @IsBoolean()
  isGuestPublic?: boolean;

  @ApiPropertyOptional({ example: 'QS. Ar-Rum: 21' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  quoteSource?: string;

  @ApiPropertyOptional({ example: 'default' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  quoteType?: string;

  @ApiPropertyOptional({ example: 'Bismillah, semoga lancar!' })
  @IsOptional()
  @IsString()
  quoteText?: string;

  @ApiPropertyOptional({ enum: Religion, example: 'islam' })
  @IsOptional()
  @IsEnum(Religion)
  religion?: Religion;

  @ApiProperty({ type: [LoveStoryItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoveStoryItem)
  loveStory: LoveStoryItem[];

  @ApiProperty({ example: 'default1.mp3' })
  @IsString()
  @StoredUrl()
  musicChoice: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isCustomMusic: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  audioStart?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  audioEnd?: number;

  @ApiProperty({ example: 'https://cdn.com/photo.jpg' })
  @IsString()
  @StoredUrl()
  bridePhotoUrl: string;

  @ApiProperty({ example: 'https://cdn.com/photo_groom.jpg' })
  @IsString()
  @StoredUrl()
  groomPhotoUrl: string;

  @ApiPropertyOptional({ example: 'https://cdn.com/couple.jpg' })
  @IsOptional()
  @IsString()
  @StoredUrl()
  photoCoupleUrl?: string;

  @ApiPropertyOptional({ type: InvitationDesignSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvitationDesignSettingsDto)
  designSettings?: InvitationDesignSettingsDto;

  @ApiPropertyOptional({ example: 'https://youtube.com/prewedding' })
  @IsOptional()
  @IsString()
  @StoredUrl()
  videoPrewedding?: string;

  @ApiPropertyOptional({ example: '2026-02-10T19:38' })
  @IsOptional()
  @IsDateString()
  dateTime?: string;

  @ApiProperty({ type: LocationDetail })
  @ValidateNested()
  @Type(() => LocationDetail)
  akadLocation: LocationDetail;

  @ApiProperty({ type: LocationDetail })
  @ValidateNested()
  @Type(() => LocationDetail)
  resepsiLocation: LocationDetail;

  @ApiProperty({ example: true })
  @IsBoolean()
  isSingleEvent: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  mergeEvents: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  encryptedGuestName: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.com/denah.jpg' })
  @IsOptional()
  @IsString()
  @StoredUrl()
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
  @NotDataUrl(true)
  galleryImages: string[];

  @ApiProperty({ example: ['Jl. Kenangan No. 123, Jakarta'] })
  @IsArray()
  @IsString({ each: true })
  giftDeliveryAddress: string[];

  @ApiPropertyOptional({ type: [EWalletLinkItem] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EWalletLinkItem)
  eWalletLink?: EWalletLinkItem[];

  @ApiPropertyOptional({ type: [BankAccount] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankAccount)
  bankAccounts?: BankAccount[];

  @ApiProperty({ type: SocialMedia })
  @ValidateNested()
  @Type(() => SocialMedia)
  socialMedia: SocialMedia;

  @ApiPropertyOptional({ type: SocialMedia })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMedia)
  socialMediaBrides?: SocialMedia;

  @ApiPropertyOptional({ type: SocialMedia })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMedia)
  socialMediaGroom?: SocialMedia;

  @ApiProperty({ type: ParentName })
  @ValidateNested()
  @Type(() => ParentName)
  parents: ParentName;

  @ApiPropertyOptional({ example: 'Keluarga Besar ...' })
  @IsOptional()
  @IsString()
  turutMengundang?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/livestream' })
  @IsOptional()
  @IsString()
  @StoredUrl()
  liveStreamingLink?: string;

  @ApiPropertyOptional({ example: 'Putih / Batik Modern' })
  @IsOptional()
  @IsString()
  @MaxVarchar()
  dressCode?: string;

  @ApiPropertyOptional({ example: 'Terima kasih...' })
  @IsOptional()
  @IsString()
  footerText?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enableCover: boolean;

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
