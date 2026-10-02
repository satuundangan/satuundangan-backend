import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Excel cells arrive as numbers; coerce so validation + slugify see strings.
const toStr = ({ value }: { value: unknown }) =>
  value === undefined || value === null ? value : String(value).trim();

export class CreateGuestDto {
  @IsNotEmpty()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  degree?: string;

  @IsOptional()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  phoneNumber?: string;

  @IsOptional()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  group?: string;

  @IsOptional()
  @Transform(toStr)
  @IsString()
  @MaxLength(255)
  statusSend?: string;

  @IsOptional()
  @IsString()
  rsvpStatus?: string;

  @IsNotEmpty()
  @IsNumber()
  invitationId: number;
}
