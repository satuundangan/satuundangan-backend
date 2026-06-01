import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import { RequestWithUser } from '../../types/request-with-user.interface';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const currentUser = request.user;

    if (!currentUser?.id) {
      throw new ForbiddenException('Autentikasi diperlukan');
    }

    const user = await this.userRepo.findOne({
      where: { id: Number(currentUser.id) },
      select: ['id', 'emailVerifiedAt', 'provider'],
    });

    if (!user) {
      throw new ForbiddenException('Autentikasi diperlukan');
    }

    if (user.provider === 'google' || user.emailVerifiedAt) {
      return true;
    }

    throw new ForbiddenException(
      'Verifikasi email diperlukan sebelum melanjutkan.',
    );
  }
}
