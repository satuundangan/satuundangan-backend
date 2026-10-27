import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateGuestMessageDto {
  @IsNotEmpty()
  @IsInt()
  invitationId: number;

  @IsNotEmpty()
  @IsString()
  guestName: string;

  @IsString()
  message: string;

  @IsString()
  @IsNotEmpty()
  rsvpStatus: string;

  @IsInt()
  @IsNotEmpty()
  totalGuests: number;

  @IsOptional()
  @IsInt()
  guestId?: number;

  @IsOptional()
  @IsString()
  guestSlug?: string;
}
