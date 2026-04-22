import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConsent } from './user-consent.entity';
import { User } from './user.entity';
import { RecordConsentDto } from './dto/record-consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(UserConsent)
    private readonly consentRepo: Repository<UserConsent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async recordConsent(
    userId: number,
    dto: RecordConsentDto,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const consent = this.consentRepo.create({
      user_id: userId,
      tos_version: dto.tos_version,
      privacy_version: dto.privacy_version,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    await this.consentRepo.save(consent);

    // Update user approval status
    user.isApproved = true;
    await this.userRepo.save(user);

    return { success: true, message: 'Consent recorded successfully' };
  }

  async checkConsent(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.isApproved || false;
  }
}
