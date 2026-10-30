import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GuestMessage } from './guest-message.entity';
import { CreateGuestMessageDto } from './dto/create-guest-message.dto';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';

export interface AdminGuestMessagesQuery {
  invitationId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class GuestMessagesService {
  constructor(
    @InjectRepository(GuestMessage)
    private readonly guestMessageRepo: Repository<GuestMessage>,

    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
  ) {}

  async verifyOwnerOrAdmin(
    invitationId: number,
    user: { id: number; isAdmin: boolean },
  ): Promise<void> {
    if (user.isAdmin) return;
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['user'],
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.user?.id !== user.id) {
      throw new ForbiddenException(
        'You are not allowed to view messages for this invitation',
      );
    }
  }

  async create(dto: CreateGuestMessageDto): Promise<GuestMessage> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: dto.invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    let guest: Guest | null = null;

    if (dto.guestId) {
      guest = await this.guestRepo.findOne({
        where: { id: dto.guestId, invitation: { id: dto.invitationId } },
      });
    } else if (dto.guestSlug) {
      guest = await this.guestRepo.findOne({
        where: [
          { accessToken: dto.guestSlug, invitation: { id: dto.invitationId } },
          { slug: dto.guestSlug, invitation: { id: dto.invitationId } },
        ],
      });
    }

    const guestMessage = this.guestMessageRepo.create({
      guestName: dto.guestName,
      message: dto.message,
      rsvpStatus: dto.rsvpStatus,
      totalGuests: dto.totalGuests,
      status: 'published',
      invitation,
      guest: guest ?? null,
    });

    const saved = await this.guestMessageRepo.save(guestMessage);

    // sync RSVP status on guest if linked
    if (guest) {
      guest.rsvpStatus = dto.rsvpStatus;
      guest.pax = dto.totalGuests || 1;
      await this.guestRepo.save(guest);
    }

    return saved;
  }

  async findByInvitationId(invitationId: number): Promise<GuestMessage[]> {
    return this.guestMessageRepo.find({
      where: [
        { invitation: { id: invitationId }, status: 'published' },
        { invitation: { id: invitationId }, status: IsNull() },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getAll(): Promise<GuestMessage[]> {
    const messages = await this.guestMessageRepo.find({
      order: { createdAt: 'DESC' },
    });
    if (!messages.length) {
      throw new NotFoundException('No guest messages found');
    }
    return messages;
  }

  async getGuestDrilldown(
    invitationId: number,
    user: { id: number; isAdmin: boolean },
  ) {
    await this.verifyOwnerOrAdmin(invitationId, user);

    const [guests, messages] = await Promise.all([
      this.guestRepo.find({
        where: { invitation: { id: invitationId } },
      }),
      this.guestMessageRepo.find({
        where: { invitation: { id: invitationId } },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const totalGuests = guests.length;
    const sentCount = guests.filter(
      (g) =>
        g.statusSend !== null &&
        g.statusSend !== undefined &&
        String(g.statusSend).trim() !== '',
    ).length;

    const openedCount = guests.filter(
      (g) =>
        g.firstVisitAt !== null || (g.visitCount !== null && g.visitCount > 0),
    ).length;

    const respondedCount = guests.filter((g) =>
      ['hadir', 'tidak', 'ragu'].includes(
        String(g.rsvpStatus || '').toLowerCase(),
      ),
    ).length;

    const totalPax = guests
      .filter((g) => String(g.rsvpStatus || '').toLowerCase() === 'hadir')
      .reduce((sum, g) => sum + (Number(g.pax) || 1), 0);

    const wishesSummary = {
      total: messages.length,
      published: messages.filter(
        (m) => !m.status || m.status === 'published',
      ).length,
      hidden: messages.filter((m) => m.status === 'hidden').length,
      flaggedSpam: messages.filter((m) => m.status === 'flagged_spam').length,
    };

    return {
      invitationId,
      totalGuests,
      sentCount,
      openedCount,
      respondedCount,
      totalPax,
      wishesSummary,
      messages,
    };
  }

  async moderateMessage(
    id: number,
    status: string,
    user: { id: number; isAdmin: boolean },
  ): Promise<GuestMessage> {
    const allowed = ['published', 'hidden', 'flagged_spam'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Status moderasi tidak valid. Pilihan: ${allowed.join(', ')}`,
      );
    }

    const message = await this.guestMessageRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });

    if (!message) {
      throw new NotFoundException('Guest message not found');
    }

    if (!user.isAdmin && message.invitation?.user?.id !== user.id) {
      throw new ForbiddenException(
        'You are not allowed to moderate this message',
      );
    }

    message.status = status;
    return this.guestMessageRepo.save(message);
  }

  async adminGetMessages(query: AdminGuestMessagesQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const qb = this.guestMessageRepo
      .createQueryBuilder('gm')
      .leftJoinAndSelect('gm.invitation', 'invitation')
      .leftJoinAndSelect('gm.guest', 'guest');

    if (query.invitationId) {
      qb.andWhere('invitation.id = :invitationId', {
        invitationId: Number(query.invitationId),
      });
    }

    if (query.status) {
      qb.andWhere('gm.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(gm.guestName LIKE :search OR gm.message LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('gm.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async delete(
    id: number,
    user: { id: number; isAdmin: boolean },
  ): Promise<void> {
    const message = await this.guestMessageRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user', 'guest'],
    });

    if (!message) {
      throw new NotFoundException('Guest message not found');
    }

    if (!user.isAdmin && message.invitation?.user?.id !== user.id) {
      throw new ForbiddenException(
        'You are not allowed to delete this message',
      );
    }

    // PENTING: Jangan ubah guest.rsvpStatus jika pesan dihapus (pertahankan data RSVP tamu).
    await this.guestMessageRepo.remove(message);
  }
}
