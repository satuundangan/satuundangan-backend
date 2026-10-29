import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsISO8601,
  IsInt,
  Min,
} from 'class-validator';

export class CreateArticleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  // SEO Fields
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  focusKeyword?: string;

  @IsOptional()
  @IsString()
  ogImage?: string;

  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'scheduled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  generatedByAi?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  sourceUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @IsOptional()
  @IsBoolean()
  editorialReviewed?: boolean;

  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledPublishAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  revisionReason?: string;
}
