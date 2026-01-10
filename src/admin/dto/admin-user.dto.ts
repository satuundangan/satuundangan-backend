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
  @IsString()
  provider?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
