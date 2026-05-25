import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterAffiliateDto {
  @ApiProperty({ example: 'BCA' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  bankAccountNumber: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankAccountName: string;

  @ApiProperty({ example: '+628123456789' })
  @IsString()
  @Matches(/^\+?\d{8,20}$/, {
    message: 'whatsappNumber must be 8–20 digits, optional leading +',
  })
  whatsappNumber: string;
}
