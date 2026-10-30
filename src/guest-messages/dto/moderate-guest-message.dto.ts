import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ModerateGuestMessageDto {
  @ApiProperty({
    description: 'Status moderasi pesan ucapan',
    enum: ['published', 'hidden', 'flagged_spam'],
    example: 'published',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['published', 'hidden', 'flagged_spam'])
  status: string;
}
