import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ADMIN_ROLES } from '../security/admin-roles';

export class UpdateAdminRoleDto {
  @IsIn(ADMIN_ROLES as unknown as string[])
  adminRole: (typeof ADMIN_ROLES)[number];
}

export class AuditLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @IsOptional() @IsString() @MaxLength(64) entityId?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() actorId?: number;
  @IsOptional() @IsIn(['success', 'failed']) result?: 'success' | 'failed';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
