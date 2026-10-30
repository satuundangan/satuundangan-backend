import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['all', 'verified', 'unverified'])
  verification?: 'all' | 'verified' | 'unverified';

  @IsOptional()
  @IsIn(['all', 'admin', 'customer'])
  role?: 'all' | 'admin' | 'customer';

  @IsOptional()
  @IsIn([
    'all',
    'never_started',
    'draft',
    'checkout_pending',
    'paid',
    'published',
  ])
  lifecycle?:
    | 'all'
    | 'never_started'
    | 'draft'
    | 'checkout_pending'
    | 'paid'
    | 'published';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;
}
