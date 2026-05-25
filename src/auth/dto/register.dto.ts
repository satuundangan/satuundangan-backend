import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @IsNotEmpty()
  @ApiProperty({ description: 'The name of the user', example: 'John Doe' })
  name: string;

  @IsEmail()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john@mail.com',
  })
  email: string;

  @MinLength(6)
  @ApiProperty({
    description: 'The password for the user account',
    example: 'password123',
  })
  password: string;

  @IsBoolean()
  @Equals(true, { message: 'Anda harus menyetujui Syarat dan Ketentuan' })
  @ApiProperty({
    description: 'Agreement to terms and conditions',
    example: true,
  })
  agreedToTerms: boolean;
}
