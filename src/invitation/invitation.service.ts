import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from './invitation.entity';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { User } from '../user/user.entity';
import slugify from 'slugify';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { PaginationQueryDto } from '../admin/dto/pagination-query.dto';
import {
  ActivityAction,
  InvitationActivity,
} from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';

@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
    @InjectRepository(InvitationActivity)
    private readonly activityRepo: Repository<InvitationActivity>,
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
  ) {}

  async create(dto: CreateInvitationDto, user: User): Promise<Invitation> {
    // 1. Premium Validation
    if (dto.isCustomMusic) {
      const template = await this.templateRepo.findOne({
        where: { id: dto.templateDesignId },
      });
      if (!template) throw new NotFoundException('Template design not found');
      if (!template.isPremium) {
        throw new ForbiddenException(
          'Custom music is only available for Premium templates.',
        );
      }
    }

    const invitation = this.invitationRepo.create({ ...dto, user });
    // Slug generation
    if (!dto.slug) {
      const base: string = slugify(dto.coupleName || dto.title || 'undangan', {
        lower: true,
        strict: true,
      });

      let slug = base;
      let count = 1;

      while (await this.invitationRepo.findOne({ where: { slug } })) {
        slug = `${base}-${count++}`;
      }

      invitation.slug = slug;
    } else {
      // Jika slug dikirim manual, tetap pastikan tidak duplikat
      const existing = await this.invitationRepo.findOne({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Slug already in use');
      }

      invitation.slug = dto.slug;
    }
    return this.invitationRepo.save(invitation);
  }

  async findAllByUser(userId: number, query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.invitationRepo.findAndCount({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['templateDesign'],
    });

    return {
      data,
      total,
      page,
      limit,
      last_page: Math.ceil(total / limit),
    };
  }

  async findOneById(id: number): Promise<Invitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { id },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    return invitation;
  }

  async update(id: number, dto: UpdateInvitationDto): Promise<Invitation> {
    const invitation = await this.findOneById(id);

    // 2. Premium Validation for Update
    if (dto.isCustomMusic === true) {
      // If user is enabling custom music, check current template or new template
      const templateId = dto.templateDesignId || invitation.templateDesignId;
      if (templateId) {
        const template = await this.templateRepo.findOne({
          where: { id: templateId },
        });
        if (template && !template.isPremium) {
          throw new ForbiddenException(
            'Custom music is only available for Premium templates.',
          );
        }
      }
    }

    Object.assign(invitation, dto);
    return this.invitationRepo.save(invitation);
  }

  async remove(id: number): Promise<void> {
    const invitation = await this.findOneById(id);
    await this.invitationRepo.remove(invitation);
  }

  async findBySlug(slug: string): Promise<any> {
    const invitation = await this.invitationRepo.findOne({
      where: { slug },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // 3. Async Increment Views & Log Activity (Anonymous)
    void this.logActivity(invitation, null, ActivityAction.VIEW);

    return {
      id: invitation.id,
      title: invitation.title,
      slug: invitation.slug,
      template_slug: invitation.templateDesign?.slug || null,
      content: {
        coupleName: invitation.coupleName,
        groomName: invitation.groomName,
        brideName: invitation.brideName,
        quoteSource: invitation.quoteSource,
        quoteText: invitation.quoteText,
        loveStory: invitation.loveStory as unknown,
        musicChoice: invitation.musicChoice,
        isCustomMusic: invitation.isCustomMusic,
        bridePhotoUrl: invitation.bridePhotoUrl,
        akadLocation: invitation.akadLocation,
        resepsiLocation: invitation.resepsiLocation,
        mergeEvents: invitation.mergeEvents,
        floorPlanImageUrl: invitation.floorPlanImageUrl,
        menu: invitation.menu,
        galleryImages: invitation.galleryImages,
        giftDeliveryAddress: invitation.giftDeliveryAddress,
        eWalletLink: invitation.eWalletLink,
        socialMedia: invitation.socialMedia,
        parents: invitation.parents,
        liveStreamingLink: invitation.liveStreamingLink,
        enableGuestMessage: invitation.enableGuestMessage,
        selectedSections: invitation.selectedSections,
        whatsappMessageTemplate: invitation.whatsappMessageTemplate, // Include new field
      },
      is_premium: invitation.templateDesign?.isPremium || false,
      is_active: invitation.isPublished,
    };
  }

  async findWithGuest(invitationSlug: string, guestSlug: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { slug: invitationSlug },
      relations: ['guests', 'templateDesign'], // Added templateDesign to relations just in case
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    const guest = invitation.guests.find((g) => g.slug === guestSlug);
    if (!guest) throw new NotFoundException('Guest not found');

    // track first visit and increment visit count
    const needsUpdate = !guest.firstVisitAt;
    guest.visitCount = (guest.visitCount || 0) + 1;
    if (!guest.firstVisitAt) {
      guest.firstVisitAt = new Date();
    }
    await this.guestRepo.save(guest);

    // 4. Async Increment Views & Log Activity (Named Guest)
    void this.logActivity(invitation, guest.name, ActivityAction.VIEW);

    return { invitation, guest, tracked: { updatedFirstVisit: needsUpdate } };
  }

  // Helper for Logging
  private async logActivity(
    invitation: Invitation,
    guestName: string | null,
    action: ActivityAction,
  ) {
    try {
      // Increment Views
      if (action === ActivityAction.VIEW) {
        await this.invitationRepo.increment({ id: invitation.id }, 'views', 1);
      }

      // Save Log
      const activity = this.activityRepo.create({
        invitation,
        guestName: guestName || null,
        action,
      });
      await this.activityRepo.save(activity);
    } catch (err) {
      console.error('Failed to log activity:', err);
      // Fail silently to not block the response
    }
  }
}
