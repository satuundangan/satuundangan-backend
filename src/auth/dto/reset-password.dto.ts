import { IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Token reset password dari email',
    example: 'abc123resetToken',
  })
  token: string;

  @MinLength(6)
  @ApiProperty({
    description: 'Password baru untuk akun',
    example: 'passwordBaru123',
  })
  password: string;
}
