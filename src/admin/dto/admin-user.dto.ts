import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  provider?: string = 'local';

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean = false;

  @IsOptional()
  @IsBoolean()
  hasWeddingPlannerAccess?: boolean;

  @IsOptional()
  @IsString()
  instagramHandle?: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  hasWeddingPlannerAccess?: boolean;

  @IsOptional()
  @IsString()
  instagramHandle?: string;
}
