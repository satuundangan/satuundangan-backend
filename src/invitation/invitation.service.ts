import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invitation,
  InvitationPackage,
  PACKAGE_FEATURES,
  PackageFeatures,
} from './invitation.entity';
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
import {
  normalizeSubdomain,
  validateSubdomainFormat,
  type SubdomainCheckResult,
} from './subdomain.util';
import { Not } from 'typeorm';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
    @InjectRepository(InvitationActivity)
    private readonly activityRepo: Repository<InvitationActivity>,
    @InjectRepository(TemplateDesign)
    private readonly templateRepo: Repository<TemplateDesign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateInvitationDto, user: User): Promise<Invitation> {
    this.logger.log(
      `Creating invitation userId=${user.id} templateDesignId=${dto.templateDesignId ?? 'none'} mergeEvents=${dto.mergeEvents}`,
    );

    // 1. Template Validation
    if (dto.templateDesignId) {
      const template = await this.templateRepo.findOne({
        where: { id: dto.templateDesignId },
      });
      if (!template)
        throw new NotFoundException(
          `Template design with ID ${dto.templateDesignId} not found`,
        );
    }

    // Custom music is gated by the chosen package tier, not the template.
    if (dto.isCustomMusic) {
      if (!dto.templateDesignId) {
        throw new BadRequestException(
          'Template Design ID is required for custom music',
        );
      }
      if (!this.featuresFor(dto.package).customMusic) {
        throw new ForbiddenException(
          'Musik custom hanya tersedia untuk paket Premium & Eksklusif.',
        );
      }
    }

    const invitationData = {
      ...dto,
      akadLocation: dto.akadLocation || {
        mapUrl: '',
        description: '',
        dateTime: '',
      },
      resepsiLocation: dto.resepsiLocation || {
        mapUrl: '',
        description: '',
        dateTime: '',
      },
      menu: dto.menu || { title: 'Menu Makanan', items: [] },
      socialMedia: dto.socialMedia || {},
      socialMediaBrides: dto.socialMediaBrides || {},
      socialMediaGroom: dto.socialMediaGroom || {},
      parents: dto.parents || { brideParents: '', groomParents: '' },
      galleryImages: this.applyGalleryPolicy(dto.package, dto.galleryImages),
      bankAccounts: dto.bankAccounts || [],
    };

    // Ensure Unified Logic for Events
    if (invitationData.mergeEvents) {
      // Prioritize akadLocation if available, otherwise use resepsiLocation
      if (dto.akadLocation) {
        invitationData.resepsiLocation = invitationData.akadLocation;
      } else if (dto.resepsiLocation) {
        invitationData.akadLocation = invitationData.resepsiLocation;
      }
    }
    this.validateEventSchedule(
      invitationData.akadLocation,
      invitationData.resepsiLocation,
      invitationData.mergeEvents,
    );

    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 60);

    const invitation = this.invitationRepo.create({
      ...invitationData,
      user,
      expiredAt,
    });

    // Slug generation logic (Auto-resolve duplicates)
    let baseSlug = dto.slug;

    if (!baseSlug) {
      baseSlug = slugify(dto.coupleName || dto.title || 'undangan', {
        lower: true,
        strict: true,
      });
    }

    let slug = baseSlug;
    let count = 1;

    // Check availability and append counter if necessary
    while (await this.invitationRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    invitation.slug = slug;

    // Custom subdomain (optional). Tier-gated + validated + unique, else reject.
    if (dto.subdomain) {
      this.assertSubdomainAllowed(dto.package);
      invitation.subdomain = await this.resolveSubdomain(dto.subdomain);
    } else {
      invitation.subdomain = null;
    }

    const saved = await this.invitationRepo.save(invitation);
    this.logger.log(
      `Invitation created invitationId=${saved.id} slug=${saved.slug} subdomain=${saved.subdomain ?? '-'} userId=${user.id}`,
    );
    return saved;
  }

  async findAllByUser(userId: number, query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [raw_data, total] = await this.invitationRepo.findAndCount({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['templateDesign'],
    });

    const data = raw_data.map((invitation) => ({
      ...invitation,
      templateDesignId: invitation.templateDesignId,
      templateName:
        invitation.templateName || invitation.templateDesign?.name || '',
      isPublished: invitation.isPublished,
      is_published: invitation.isPublished,
      groomPhotoUrl: invitation.groomPhotoUrl || '',
      photoCoupleUrl: invitation.photoCoupleUrl || '',
      quoteType: invitation.quoteType || 'default',
      isSingleEvent: invitation.isSingleEvent ?? true,
      encryptedGuestName: invitation.encryptedGuestName,
      socialMediaBrides: invitation.socialMediaBrides || {},
      socialMediaGroom: invitation.socialMediaGroom || {},
      videoPrewedding: invitation.videoPrewedding || '',
      turutMengundang: invitation.turutMengundang || '',
      footerText: invitation.footerText || '',
      enableCover: invitation.enableCover ?? true,
    }));

    return {
      data,
      total,
      page,
      limit,
      last_page: Math.ceil(total / limit),
    };
  }

  async findOneById(id: number, user: User): Promise<Invitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { id },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    if (Number(invitation.user?.id) !== Number(user.id)) {
      throw new ForbiddenException('You are not the owner of this invitation');
    }

    return invitation;
  }

  async update(
    id: number,
    dto: UpdateInvitationDto,
    user: User,
  ): Promise<Invitation> {
    const invitation = await this.findOneById(id, user);
    this.logger.log(`Updating invitation invitationId=${id}`);

    // Custom music gating on update — by effective package tier, not template.
    if (dto.isCustomMusic === true) {
      const effectivePkg = dto.package ?? invitation.package;
      if (!this.featuresFor(effectivePkg).customMusic) {
        throw new ForbiddenException(
          'Musik custom hanya tersedia untuk paket Premium & Eksklusif.',
        );
      }
    }

    if (dto.isPublished === true && !invitation.isPublished) {
      await this.assertEmailVerified(user.id);
    }

    if (dto.slug && dto.slug !== invitation.slug) {
      const existing = await this.invitationRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new BadRequestException(
          'Slug sudah digunakan oleh undangan lain',
        );
      }
    }

    // Custom subdomain change. '' / null clears it; any value is validated.
    let nextSubdomain: string | null | undefined;
    if (dto.subdomain !== undefined) {
      if (dto.subdomain) {
        // Effective tier = incoming package, else the invitation's current tier.
        this.assertSubdomainAllowed(dto.package ?? invitation.package);
        nextSubdomain = await this.resolveSubdomain(dto.subdomain, invitation.id);
      } else {
        nextSubdomain = null;
      }
      delete dto.subdomain; // prevent raw value leaking via Object.assign
    }

    Object.assign(invitation, dto);

    if (nextSubdomain !== undefined) {
      invitation.subdomain = nextSubdomain;
    }

    // Re-gate gallery against the effective tier (strips/truncates on downgrade).
    invitation.galleryImages = this.applyGalleryPolicy(
      dto.package ?? invitation.package,
      invitation.galleryImages,
    );

    // Ensure Unified Logic for Events on Update
    if (invitation.mergeEvents) {
      // If we are updating and mergeEvents is true (or became true), sync them.
      // We prioritize the one that was actively updated in this DTO if possible.
      if (dto.akadLocation) {
        invitation.resepsiLocation = invitation.akadLocation;
      } else if (dto.resepsiLocation) {
        invitation.akadLocation = invitation.resepsiLocation;
      } else {
        // If neither specific location was updated but mergeEvents is true,
        // we sync them to be consistent (e.g. copy akad to resepsi).
        invitation.resepsiLocation = invitation.akadLocation;
      }
    }
    this.validateEventSchedule(
      invitation.akadLocation,
      invitation.resepsiLocation,
      invitation.mergeEvents,
    );

    const saved = await this.invitationRepo.save(invitation);
    this.logger.log(
      `Invitation updated invitationId=${saved.id} slug=${saved.slug} isPublished=${saved.isPublished}`,
    );
    return saved;
  }

  private async assertEmailVerified(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'emailVerifiedAt', 'provider'],
    });

    if (user?.provider === 'google' || user?.emailVerifiedAt) {
      return;
    }

    throw new ForbiddenException(
      'Verifikasi email diperlukan sebelum publish undangan.',
    );
  }

  async remove(id: number, user: User): Promise<void> {
    const invitation = await this.findOneById(id, user);
    await this.invitationRepo.remove(invitation);
  }

  async findBySlugForOwner(slug: string, userId: number): Promise<any> {
    const invitation = await this.invitationRepo.findOne({
      where: { slug },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (Number(invitation.user?.id) !== Number(userId)) {
      throw new ForbiddenException('You are not the owner of this invitation');
    }

    return this.buildInvitationResponse(invitation);
  }

  async findBySlug(slug: string): Promise<any> {
    this.logger.log(`Public invitation requested slug=${slug}`);
    const invitation = await this.invitationRepo.findOne({
      where: { slug },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!invitation.isPublished) {
      this.logger.warn(
        `Public invitation blocked unpublished slug=${slug} invitationId=${invitation.id}`,
      );
      throw new ForbiddenException('Undangan belum dipublikasikan');
    }

    // 3. Async Increment Views & Log Activity (Anonymous)
    void this.logActivity(invitation, null, ActivityAction.VIEW);

    return this.buildInvitationResponse(invitation);
  }

  // Custom subdomain is a tier-Eksklusif feature. Reject other tiers.
  private assertSubdomainAllowed(pkg?: InvitationPackage): void {
    if (pkg !== InvitationPackage.EKSKLUSIF) {
      throw new ForbiddenException(
        'Subdomain custom hanya tersedia untuk paket Eksklusif',
      );
    }
  }

  // Normalize + validate format + enforce uniqueness. Throws on invalid/taken.
  // excludeId skips the invitation's own row (so re-saving same value is ok).
  private async resolveSubdomain(
    input: string,
    excludeId?: number,
  ): Promise<string> {
    const normalized = normalizeSubdomain(input);
    const format = validateSubdomainFormat(normalized);
    if (!format.valid) {
      throw new BadRequestException(format.reason || 'Subdomain tidak valid');
    }

    const existing = await this.invitationRepo.findOne({
      where: excludeId
        ? { subdomain: normalized, id: Not(excludeId) }
        : { subdomain: normalized },
      select: ['id'],
    });
    if (existing) {
      throw new BadRequestException(
        'Subdomain sudah digunakan oleh undangan lain',
      );
    }

    return normalized;
  }

  // Non-throwing availability check for live UI feedback at /create.
  async checkSubdomainAvailability(
    input: string,
    excludeId?: number,
  ): Promise<SubdomainCheckResult> {
    const normalized = normalizeSubdomain(input);
    const format = validateSubdomainFormat(normalized);
    if (!format.valid) {
      return { available: false, normalized, reason: format.reason };
    }

    const existing = await this.invitationRepo.findOne({
      where: excludeId
        ? { subdomain: normalized, id: Not(excludeId) }
        : { subdomain: normalized },
      select: ['id'],
    });
    if (existing) {
      return {
        available: false,
        normalized,
        reason: 'Subdomain sudah digunakan',
      };
    }

    return { available: true, normalized };
  }

  // Public resolve by subdomain (parsed from Host header by frontend/edge).
  // Mirrors findBySlug: published-only, logs a view.
  async findBySubdomain(input: string): Promise<any> {
    const normalized = normalizeSubdomain(input);
    this.logger.log(`Public invitation requested subdomain=${normalized}`);

    const invitation = await this.invitationRepo.findOne({
      where: { subdomain: normalized },
      relations: ['user', 'templateDesign'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!invitation.isPublished) {
      this.logger.warn(
        `Public invitation blocked unpublished subdomain=${normalized} invitationId=${invitation.id}`,
      );
      throw new ForbiddenException('Undangan belum dipublikasikan');
    }

    void this.logActivity(invitation, null, ActivityAction.VIEW);

    return this.buildInvitationResponse(invitation);
  }

  private buildInvitationResponse(invitation: Invitation): any {
    // Read-path gating is the authoritative backstop: features are served
    // per the invitation's paid tier, regardless of what got stored while
    // editing (package is only locked at payment settlement).
    const features = this.featuresFor(invitation.package);
    const serveCustomMusic = features.customMusic && invitation.isCustomMusic;
    return {
      id: invitation.id,
      title: invitation.title,
      slug: invitation.slug,
      subdomain: invitation.subdomain || null,
      package: invitation.package,
      template_slug: invitation.templateDesign?.slug || null,
      price: Number(invitation.templateDesign?.price || 0),
      content: {
        templateDesignId: invitation.templateDesignId,
        templateName: invitation.templateName,
        templatePrice: Number(invitation.templateDesign?.price || 0),
        coupleName: invitation.coupleName,
        groomName: invitation.groomName,
        brideName: invitation.brideName,
        quoteSource: invitation.quoteSource,
        quoteType: invitation.quoteType,
        quoteText: invitation.quoteText,
        loveStory: invitation.loveStory as unknown,
        // Custom (uploaded) music only plays on tiers that allow it.
        musicChoice:
          invitation.isCustomMusic && !features.customMusic
            ? null
            : invitation.musicChoice,
        isCustomMusic: serveCustomMusic,
        bridePhotoUrl: invitation.bridePhotoUrl,
        groomPhotoUrl: invitation.groomPhotoUrl,
        photoCoupleUrl: invitation.photoCoupleUrl,
        videoPrewedding: invitation.videoPrewedding,
        dateTime: invitation.dateTime,
        akadLocation: invitation.akadLocation,
        resepsiLocation: invitation.resepsiLocation,
        isSingleEvent: invitation.isSingleEvent,
        mergeEvents: invitation.mergeEvents,
        floorPlanImageUrl: invitation.floorPlanImageUrl,
        menu: invitation.menu,
        galleryImages: this.applyGalleryPolicy(
          invitation.package,
          invitation.galleryImages,
        ),
        giftDeliveryAddress: invitation.giftDeliveryAddress,
        eWalletLink: invitation.eWalletLink,
        bankAccounts: invitation.bankAccounts || [],
        socialMedia: invitation.socialMedia,
        socialMediaBrides: invitation.socialMediaBrides,
        socialMediaGroom: invitation.socialMediaGroom,
        parents: invitation.parents,
        turutMengundang: invitation.turutMengundang,
        liveStreamingLink: invitation.liveStreamingLink,
        footerText: invitation.footerText,
        enableCover: invitation.enableCover,
        enableGuestMessage: invitation.enableGuestMessage,
        selectedSections: invitation.selectedSections,
        whatsappMessageTemplate: invitation.whatsappMessageTemplate,
      },
      // Watermark is a tier feature now: Basic shows branding, Premium/Eksklusif hide it.
      show_branding: features.watermark,
      is_published: invitation.isPublished,
    };
  }

  // Effective feature set for a tier. Falls back to Basic when tier is missing.
  private featuresFor(pkg?: InvitationPackage): PackageFeatures {
    return (
      PACKAGE_FEATURES[pkg ?? InvitationPackage.BASIC] ??
      PACKAGE_FEATURES[InvitationPackage.BASIC]
    );
  }

  // Enforce gallery access + photo cap for a tier. Basic gets none.
  private applyGalleryPolicy(
    pkg: InvitationPackage | undefined,
    images?: string[],
  ): string[] {
    const f = this.featuresFor(pkg);
    if (!f.gallery) return [];
    const list = images || [];
    return f.galleryLimit > 0 ? list.slice(0, f.galleryLimit) : list;
  }

  async findWithGuest(invitationSlug: string, guestSlug: string) {
    this.logger.log(
      `Guest invitation requested invitationSlug=${invitationSlug} guestSlug=${guestSlug}`,
    );
    const invitation = await this.invitationRepo.findOne({
      where: { slug: invitationSlug },
      relations: ['guests', 'templateDesign'], // Added templateDesign to relations just in case
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    if (!invitation.isPublished) {
      this.logger.warn(
        `Guest invitation blocked unpublished invitationSlug=${invitationSlug} invitationId=${invitation.id}`,
      );
      throw new ForbiddenException('Undangan belum dipublikasikan');
    }

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
      this.logger.error(
        `Failed to log activity invitationId=${invitation.id} action=${action}`,
        err instanceof Error ? err.stack : String(err),
      );
      // Fail silently to not block the response
    }
  }

  private validateEventSchedule(
    akadLocation: Invitation['akadLocation'],
    resepsiLocation: Invitation['resepsiLocation'],
    mergeEvents: boolean,
  ) {
    if (mergeEvents) return;

    const akadDate = this.parseRequiredEventDate(
      akadLocation?.dateTime,
      'Tanggal Akad wajib diisi',
    );
    const resepsiDate = this.parseRequiredEventDate(
      resepsiLocation?.dateTime,
      'Tanggal Resepsi wajib diisi',
    );

    if (resepsiDate <= akadDate) {
      this.logger.warn(
        `Invalid event schedule akad=${akadDate.toISOString()} resepsi=${resepsiDate.toISOString()}`,
      );
      throw new BadRequestException(
        'Tanggal Resepsi harus setelah tanggal Akad',
      );
    }
  }

  private parseRequiredEventDate(value: unknown, message: string): Date {
    if (!value) {
      throw new BadRequestException(message);
    }

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }

    return date;
  }
}
