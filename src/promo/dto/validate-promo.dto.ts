import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePromoDto {
  @ApiProperty({ example: 'NIKAH50' })
  @IsString()
  code: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  invitation_id: number;
}
