import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { InvitationActivity } from './invitation-activity.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(GuestMessage)
    private readonly guestMessageRepo: Repository<GuestMessage>,
    @InjectRepository(InvitationActivity)
    private readonly activityRepo: Repository<InvitationActivity>,
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
  ) {}

  async getStats(userId: number) {
    const totalInvitations = await this.invitationRepo.count({
      where: { user: { id: userId } },
    });

    const activeInvitations = await this.invitationRepo.count({
      where: { user: { id: userId }, isPublished: true },
    });

    // Total responses
    const totalResponses = await this.guestMessageRepo
      .createQueryBuilder('gm')
      .leftJoin('gm.invitation', 'invitation')
      .where('invitation.userId = :userId', { userId })
      .getCount();

    // Total Views
    const result = (await this.invitationRepo
      .createQueryBuilder('invitation')
      .select('SUM(invitation.views)', 'sum')
      .where('invitation.userId = :userId', { userId })
      .getRawOne()) as { sum: string | null };

    const totalViews = result?.sum ? parseInt(result.sum) : 0;

    // RSVP Breakdown

    const rsvpStats: any[] = await this.guestRepo
      .createQueryBuilder('guest')
      .select('guest.rsvpStatus', 'status')
      .addSelect('COUNT(guest.id)', 'count')
      .leftJoin('guest.invitation', 'invitation')
      .where('invitation.userId = :userId', { userId })
      .groupBy('guest.rsvpStatus')
      .getRawMany();

    const rsvpBreakdown = {
      attending: 0,
      not_attending: 0,
      pending: 0,
    };

    rsvpStats.forEach((stat) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const s = (stat.status ? stat.status.toLowerCase() : 'belum') as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      const c = parseInt(stat.count);

      if (['hadir', 'attending', 'ya'].includes(s)) {
        rsvpBreakdown.attending += c;
      } else if (
        ['tidak', 'tidak_hadir', 'not_attending', 'batal'].includes(s)
      ) {
        rsvpBreakdown.not_attending += c;
      } else {
        rsvpBreakdown.pending += c;
      }
    });

    return {
      total_invitations: totalInvitations,
      active_invitations: activeInvitations,
      total_responses: totalResponses,
      rsvp_breakdown: rsvpBreakdown,
      total_views: totalViews,
    };
  }

  async getActivity(userId: number) {
    const activities = await this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.invitation', 'invitation')
      .where('invitation.userId = :userId', { userId })
      .orderBy('activity.createdAt', 'DESC')
      .take(20)
      .getMany();

    return activities.map((a) => ({
      id: a.id,
      invitation_title: a.invitation?.title,
      guest_name: a.guestName,
      action: a.action,
      created_at: a.createdAt,
    }));
  }
}
