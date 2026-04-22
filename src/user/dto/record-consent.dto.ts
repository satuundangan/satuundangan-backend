import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordConsentDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'v1.0.0' })
  tos_version: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'v1.0.0' })
  privacy_version: string;
}
