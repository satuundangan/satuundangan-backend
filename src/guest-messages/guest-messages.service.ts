import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestMessage } from './guest-message.entity';
import { CreateGuestMessageDto } from './dto/create-guest-message.dto';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';

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
    if (invitation.user.id !== user.id) {
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
        where: { slug: dto.guestSlug, invitation: { id: dto.invitationId } },
      });
    }

    const guestMessage = this.guestMessageRepo.create({
      guestName: dto.guestName,
      message: dto.message,
      rsvpStatus: dto.rsvpStatus,
      totalGuests: dto.totalGuests,
      invitation,
      guest: guest ?? null,
    });

    const saved = await this.guestMessageRepo.save(guestMessage);

    // sync RSVP status on guest if linked
    if (guest) {
      guest.rsvpStatus = dto.rsvpStatus;
      await this.guestRepo.save(guest);
    }

    return saved;
  }

  async findByInvitationId(invitationId: number): Promise<GuestMessage[]> {
    return this.guestMessageRepo.find({
      where: { invitation: { id: invitationId } },
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
}
