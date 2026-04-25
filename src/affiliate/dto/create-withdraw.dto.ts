import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawDto {
  @ApiProperty({ example: 100000, description: 'Nominal penarikan dana' })
  @IsNumber()
  @Min(10000)
  amount: number;
}
