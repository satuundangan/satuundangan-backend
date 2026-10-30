import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import {
  canAccessAdminPath,
  resolveAdminRole,
} from '../../admin/security/admin-roles';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { id: number } | undefined;
    if (!user?.id) throw new ForbiddenException('Unauthorized');

    const found = await this.userRepo.findOne({ where: { id: user.id } });
    if (!found?.isAdmin) throw new ForbiddenException('Admins only');

    const role = resolveAdminRole(found);
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (!role || !canAccessAdminPath(role, req.method, path)) {
      throw new ForbiddenException(
        'Role admin Anda tidak memiliki akses ke fitur ini',
      );
    }
    req.adminRole = role;
    return true;
  }
}
