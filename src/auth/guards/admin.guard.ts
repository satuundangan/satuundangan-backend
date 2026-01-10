import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { userId: number } | undefined;
    if (!user?.userId) throw new ForbiddenException('Unauthorized');

    const found = await this.userRepo.findOne({ where: { id: user.userId } });
    if (!found?.isAdmin) throw new ForbiddenException('Admins only');
    return true;
  }
}
