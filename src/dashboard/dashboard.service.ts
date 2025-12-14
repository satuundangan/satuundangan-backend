import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(GuestMessage)
    private readonly guestMessageRepo: Repository<GuestMessage>,
  ) {}

  async getStats(userId: number) {
    // We can use query builder or finding all invitations and calculating
    // For scalability, counts should be done via DB count queries
    
    const totalInvitations = await this.invitationRepo.count({
      where: { user: { id: userId } },
    });

    const activeInvitations = await this.invitationRepo.count({
      where: { user: { id: userId }, isPublished: true },
    });

    // Total responses: count guest messages linked to user's invitations
    // Join GuestMessage -> Invitation -> User
    const totalResponses = await this.guestMessageRepo
      .createQueryBuilder('gm')
      .leftJoin('gm.invitation', 'invitation')
      .where('invitation.userId = :userId', { userId })
      .getCount();

    return {
      total_invitations: totalInvitations,
      active_invitations: activeInvitations,
      total_responses: totalResponses,
    };
  }
}
