import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @IsEmail()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john@mail.com',
  })
  email: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The password for the user account',
    example: 'password123',
  })
  password: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token' })
  turnstileToken?: string;
}
