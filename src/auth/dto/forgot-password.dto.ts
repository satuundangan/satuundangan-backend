import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({
    description: 'Email akun yang ingin direset password-nya',
    example: 'john@mail.com',
  })
  email: string;
}
