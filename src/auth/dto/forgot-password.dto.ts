import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({
    description: 'Email akun yang ingin direset password-nya',
    example: 'john@mail.com',
  })
  email: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token' })
  turnstileToken?: string;
}
