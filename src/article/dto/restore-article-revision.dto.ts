import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RestoreArticleRevisionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  revisionReason?: string;
}
