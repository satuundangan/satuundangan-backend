import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateAffiliateCodeDto {
  @ApiProperty({ example: 'JOHN-X4P9' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code: string;
}
