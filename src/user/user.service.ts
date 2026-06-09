import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(userId: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'name',
        'email',
        'emailVerifiedAt',
        'provider',
        'isAdmin',
        'avatar',
        'isApproved',
        'aiCredits',
        'totpEnabled',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(userId: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);
    return await this.userRepo.save(user);
  }
}
