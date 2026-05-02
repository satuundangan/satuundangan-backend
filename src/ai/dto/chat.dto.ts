import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class MessageDto {
  @ApiProperty()
  role: 'user' | 'assistant'

  @ApiProperty()
  content: string
}

export class ChatDto {
  @ApiProperty({ type: [MessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[]

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  currentData?: Record<string, any>
}

export class PurchaseCreditsDto {
  @ApiProperty({ enum: ['1', '5', '10'] })
  packageId: '1' | '5' | '10'
}
