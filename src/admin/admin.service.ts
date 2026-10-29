import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, LessThan } from 'typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { Category } from '../category/category.entity';
import { Payment } from '../payment/payment.entity';
import { PaymentStatus } from '../payment/types/payment.type';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import { ActivityLog, LogLevel } from './entities/activity-log.entity';
import {
  CreateTemplateDesignDto,
  UpdateTemplateDesignDto,
} from './dto/template-design.dto';
import {
  CreatePaletteColorDto,
  UpdatePaletteColorDto,
} from './dto/palette-color.dto';
import { UploadService } from '../modules/upload/upload.service';
import * as bcrypt from 'bcrypt';
import { AdminRole, resolveAdminRole } from './security/admin-roles';
import { resolveDashboardPeriod } from './admin-dashboard-period';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(GuestMessage)
    private readonly guestMessageRepo: Repository<GuestMessage>,
    @InjectRepository(TemplateDesign)
    private readonly templateDesignRepo: Repository<TemplateDesign>,
    @InjectRepository(TemplateDesignSection)
    private readonly templateDesignSectionRepo: Repository<TemplateDesignSection>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Audio) private readonly audioRepo: Repository<Audio>,
    @InjectRepository(Bank) private readonly bankRepo: Repository<Bank>,
    @InjectRepository(PaletteColor)
    private readonly paletteColorRepo: Repository<PaletteColor>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    private readonly uploadService: UploadService,
  ) {}

  // Users
  async listUsers(
    page = 1,
    limit = 20,
    q?: string,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .loadRelationCountAndMap('user.invitationsCount', 'user.invitations');

    if (q && q.trim()) {
      qb.where('user.name LIKE :search OR user.email LIKE :search', {
        search: `%${q.trim()}%`,
      });
    }

    const validCols: Record<string, string> = {
      id: 'user.id',
      name: 'user.name',
      email: 'user.email',
      createdAt: 'user.createdAt',
      isAdmin: 'user.isAdmin',
    };
    const orderCol = validCols[sortBy] || 'user.createdAt';

    qb.orderBy(orderCol, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getUser(id: number) {
    const found = await this.userRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async createUser(payload: Partial<User> & { password?: string }) {
    if (payload.email) {
      const existing = await this.userRepo.findOne({
        where: { email: payload.email },
      });
      if (existing) throw new BadRequestException('Email already exists');
    }
    const user = this.userRepo.create(payload);
    if (payload.password) {
      user.password = await bcrypt.hash(payload.password, 10);
      user.provider = user.provider || 'local';
    }
    return this.userRepo.save(user);
  }

  async updateUser(id: number, payload: Partial<User> & { password?: string }) {
    const user = await this.getUser(id);
    if (payload.email && payload.email !== user.email) {
      const exists = await this.userRepo.findOne({
        where: { email: payload.email },
      });
      if (exists) throw new BadRequestException('Email already exists');
    }
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
      payload.provider = payload.provider || 'local';
    }
    const { isEmailVerified, ...rest } = payload as any;
    if (typeof isEmailVerified === 'boolean') {
      user.emailVerifiedAt = isEmailVerified ? (user.emailVerifiedAt || new Date()) : null;
      if (isEmailVerified) {
        user.emailVerificationTokenHash = null;
        user.emailVerificationTokenExpiresAt = null;
      }
    }
    Object.assign(user, rest);
    return this.userRepo.save(user);
  }

  async deleteUser(id: number) {
    const user = await this.getUser(id);
    try {
      await this.userRepo.query('DELETE FROM user_consents WHERE user_id = ?', [id]);
    } catch {}
    if (user.email) {
      try {
        await this.activityLogRepo.delete({ userEmail: user.email });
      } catch {}
    }
    try {
      const userInvs = await this.invitationRepo.find({ where: { user: { id } } });
      for (const inv of userInvs) {
        await this.deleteInvitation(inv.id);
      }
    } catch {}
    await this.userRepo.remove(user);
    return { success: true };
  }

  async verifyUserEmail(id: number) {
    const user = await this.getUser(id);
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;
    await this.userRepo.save(user);
    return { success: true, message: `Email ${user.email} berhasil diverifikasi.` };
  }

  // Invitations
  public transformInvitationSummary(inv: Invitation) {
    const payments = (inv.payments || []).slice().sort((a, b) => b.id - a.id);
    const successPayment = payments.find(
      (p) => String(p.status).toLowerCase() === 'success',
    );

    let paymentStatusCode = 'unpaid';
    let paymentStatusLabel = 'Belum Checkout';
    let paymentStatusVariant = 'neutral';

    if (successPayment) {
      if (
        Number(successPayment.amount) > 0 &&
        successPayment.paymentMethod !== 'FREE_ACTIVATION'
      ) {
        paymentStatusCode = 'paid';
        paymentStatusLabel = 'Lunas Berbayar';
        paymentStatusVariant = 'success';
      } else {
        paymentStatusCode = 'free';
        paymentStatusLabel = 'Gratis / Promo';
        paymentStatusVariant = 'info';
      }
    } else if (payments.length === 0) {
      if (inv.isPublished) {
        paymentStatusCode = 'reconcile';
        paymentStatusLabel = 'Perlu Rekonsiliasi';
        paymentStatusVariant = 'danger';
      } else {
        paymentStatusCode = 'unpaid';
        paymentStatusLabel = 'Belum Checkout';
        paymentStatusVariant = 'neutral';
      }
    } else {
      const latest = payments[0];
      const st = String(latest.status).toLowerCase();
      if (st === 'pending') {
        paymentStatusCode = 'pending';
        paymentStatusLabel = 'Menunggu Pembayaran';
        paymentStatusVariant = 'warning';
      } else if (st === 'expired') {
        paymentStatusCode = 'expired';
        paymentStatusLabel = 'Expired';
        paymentStatusVariant = 'danger';
      } else if (st === 'failure' || st === 'failed') {
        paymentStatusCode = 'failed';
        paymentStatusLabel = 'Gagal';
        paymentStatusVariant = 'danger';
      } else if (inv.isPublished) {
        paymentStatusCode = 'reconcile';
        paymentStatusLabel = 'Perlu Rekonsiliasi';
        paymentStatusVariant = 'danger';
      } else {
        paymentStatusCode = 'unpaid';
        paymentStatusLabel = 'Belum Checkout';
        paymentStatusVariant = 'neutral';
      }
    }

    let isExpired = false;
    let daysRemaining: number | null = null;
    let expiryLabel = '-';

    if (inv.expiredAt) {
      const now = Date.now();
      const expTime = new Date(inv.expiredAt).getTime();
      const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        isExpired = true;
        daysRemaining = 0;
        expiryLabel = 'Kadaluarsa';
      } else {
        isExpired = false;
        daysRemaining = diffDays;
        expiryLabel = `${diffDays} hari lagi`;
      }
    }

    const targetTx = successPayment || payments[0] || null;
    const latestTransaction = targetTx
      ? {
          id: targetTx.id,
          orderId: targetTx.orderId,
          amount: Number(targetTx.amount || 0),
          status: targetTx.status,
          paymentMethod: targetTx.paymentMethod || null,
          paymentType: targetTx.paymentType || null,
          settlementTime: targetTx.settlementTime || null,
          discountAmount: Number(targetTx.discountAmount || 0),
          createdAt: targetTx.createdAt,
        }
      : null;

    return {
      id: inv.id,
      title: inv.title,
      slug: inv.slug,
      coupleName: inv.coupleName,
      package: inv.package || 'basic',
      isPublished: Boolean(inv.isPublished),
      expiredAt: inv.expiredAt,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      category: inv.templateDesign?.category?.name || null,
      templateDesign: inv.templateDesign
        ? {
            id: inv.templateDesign.id,
            name: inv.templateDesign.name,
            slug: inv.templateDesign.slug,
            thumbnailUrl: inv.templateDesign.thumbnailUrl,
          }
        : null,
      user: inv.user
        ? {
            id: inv.user.id,
            name: inv.user.name,
            email: inv.user.email,
            phoneNumber: (inv.user as any).phoneNumber || null,
          }
        : null,
      paymentStatus: {
        code: paymentStatusCode,
        label: paymentStatusLabel,
        variant: paymentStatusVariant,
      },
      expiry: {
        isExpired,
        daysRemaining,
        label: expiryLabel,
      },
      latestTransaction,
      paymentsCount: payments.length,
    };
  }

  private wibDayBoundary(value: string, edge: 'start' | 'end'): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(
        edge === 'start' ? `${value}T00:00:00+07:00` : `${value}T23:59:59.999+07:00`,
      );
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date(value);
    if (edge === 'end') fallback.setHours(23, 59, 59, 999);
    return fallback;
  }

  async listInvitations(
    page = 1,
    limit = 20,
    q?: string,
    sortBy = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    paymentStatus?: string,
    isPublished?: string,
    packageType?: string,
    startDate?: string,
    endDate?: string,
    category?: string,
  ) {
    const qb = this.invitationRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.user', 'user')
      .leftJoinAndSelect('inv.templateDesign', 'templateDesign')
      .leftJoinAndSelect('templateDesign.category', 'category')
      .leftJoinAndSelect('inv.payments', 'payment');

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      qb.andWhere(
        '(inv.title LIKE :term OR inv.slug LIKE :term OR inv.coupleName LIKE :term OR user.name LIKE :term OR user.email LIKE :term OR payment.orderId LIKE :term)',
        { term },
      );
    }

    if (
      isPublished !== undefined &&
      isPublished !== null &&
      isPublished !== '' &&
      isPublished !== 'all'
    ) {
      const pubBool =
        isPublished === 'true' ||
        isPublished === '1' ||
        isPublished === 'published';
      qb.andWhere('inv.isPublished = :pubBool', { pubBool });
    }

    if (packageType && packageType !== 'all') {
      qb.andWhere('inv.package = :packageType', { packageType });
    }

    // YYYY-MM-DD is read as a calendar day in WIB, the same convention as the dashboard.
    if (startDate) {
      qb.andWhere('inv.createdAt >= :startDate', {
        startDate: this.wibDayBoundary(startDate, 'start'),
      });
    }
    if (endDate) {
      qb.andWhere('inv.createdAt <= :endDate', {
        endDate: this.wibDayBoundary(endDate, 'end'),
      });
    }
    if (category && category !== 'all') {
      qb.andWhere('category.name = :categoryName', { categoryName: category });
    }

    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'paid') {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success' AND p.amount > 0 AND (p.paymentMethod IS NULL OR p.paymentMethod != 'FREE_ACTIVATION'))`,
        );
      } else if (paymentStatus === 'free') {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success' AND (p.amount = 0 OR p.paymentMethod = 'FREE_ACTIVATION'))`,
        );
      } else if (paymentStatus === 'reconcile') {
        qb.andWhere(
          `inv.isPublished = true AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success')`,
        );
      } else if (paymentStatus === 'unpaid') {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id)`,
        );
      } else if (paymentStatus === 'pending') {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success') AND (SELECT p.status FROM payment p WHERE p.invitationId = inv.id ORDER BY p.id DESC LIMIT 1) = 'pending'`,
        );
      } else if (paymentStatus === 'failed') {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success') AND (SELECT p.status FROM payment p WHERE p.invitationId = inv.id ORDER BY p.id DESC LIMIT 1) IN ('failure', 'failed')`,
        );
      } else if (paymentStatus === 'expired') {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success') AND (SELECT p.status FROM payment p WHERE p.invitationId = inv.id ORDER BY p.id DESC LIMIT 1) = 'expired'`,
        );
      }
    }

    if (sortBy === 'createdAt') {
      qb.orderBy('inv.createdAt', sortOrder);
    } else if (sortBy === 'title') {
      qb.orderBy('inv.title', sortOrder);
    } else if (sortBy === 'expiredAt') {
      qb.orderBy('inv.expiredAt', sortOrder);
    } else {
      qb.orderBy('inv.id', sortOrder);
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    const mappedData = data.map((inv) => this.transformInvitationSummary(inv));

    return { data: mappedData, total, page, limit };
  }

  async getInvitation(id: number) {
    const found = await this.invitationRepo.findOne({
      where: { id },
      relations: ['user', 'templateDesign', 'payments'],
    });
    if (!found) throw new NotFoundException('Invitation not found');
    return found;
  }

  async getInvitationDetail(id: number) {
    const inv = await this.invitationRepo.findOne({
      where: { id },
      relations: [
        'user',
        'templateDesign',
        'templateDesign.category',
        'payments',
      ],
    });
    if (!inv) throw new NotFoundException('Invitation not found');

    const [
      totalGuests,
      totalMessages,
      attendingCount,
      notAttendingCount,
      uncertainCount,
    ] = await Promise.all([
      this.guestRepo.count({ where: { invitation: { id } } }),
      this.guestMessageRepo.count({ where: { invitation: { id } } }),
      this.guestMessageRepo.count({
        where: { invitation: { id }, rsvpStatus: 'attending' },
      }),
      this.guestMessageRepo.count({
        where: { invitation: { id }, rsvpStatus: 'not_attending' },
      }),
      this.guestMessageRepo.count({
        where: { invitation: { id }, rsvpStatus: 'uncertain' },
      }),
    ]);

    let activities: ActivityLog[] = [];
    try {
      activities = await this.activityLogRepo.find({
        where: [{ path: ILike(`%/invitations/${id}%`) }],
        order: { id: 'DESC' },
        take: 10,
      });
    } catch {
      activities = [];
    }

    const summary = this.transformInvitationSummary(inv);

    return {
      ...summary,
      akadLocation: inv.akadLocation,
      resepsiLocation: inv.resepsiLocation,
      dateTime: inv.dateTime,
      stats: {
        totalGuests,
        totalMessages,
        attendingCount,
        notAttendingCount,
        uncertainCount,
      },
      allPayments: (inv.payments || []).slice().sort((a, b) => b.id - a.id),
      recentActivities: activities,
    };
  }

  async updateInvitation(
    id: number,
    payload: Partial<Invitation> & { reason?: string },
    adminUser?: any,
  ) {
    const inv = await this.getInvitation(id);
    const oldSlug = inv.slug;
    const oldPublished = inv.isPublished;

    // Filter out dummy or invalid payload properties
    const dataToUpdate = { ...payload };
    delete (dataToUpdate as any).status;
    const reason = dataToUpdate.reason || 'Admin manual update';
    delete dataToUpdate.reason;

    Object.assign(inv, dataToUpdate);
    const saved = await this.invitationRepo.save(inv);

    // Audit logs for critical changes
    try {
      if (dataToUpdate.slug && dataToUpdate.slug !== oldSlug) {
        await this.activityLogRepo.save(
          this.activityLogRepo.create({
            userId: adminUser?.id || null,
            userEmail: adminUser?.email || 'admin',
            action: 'ADMIN_INVITATION_SLUG_CHANGE',
            level: LogLevel.WARN,
            path: `/admin/invitations/${id}`,
            details: {
              invitationId: id,
              oldSlug,
              newSlug: dataToUpdate.slug,
              reason,
            },
          }),
        );
      }
      if (
        dataToUpdate.isPublished !== undefined &&
        dataToUpdate.isPublished !== oldPublished
      ) {
        await this.activityLogRepo.save(
          this.activityLogRepo.create({
            userId: adminUser?.id || null,
            userEmail: adminUser?.email || 'admin',
            action: 'ADMIN_INVITATION_PUBLISH_CHANGE',
            level: LogLevel.ACTION,
            path: `/admin/invitations/${id}`,
            details: {
              invitationId: id,
              oldPublished,
              newPublished: dataToUpdate.isPublished,
              reason,
            },
          }),
        );
      }
    } catch {
      // Continue even if log saving fails
    }

    return saved;
  }

  async deleteInvitation(id: number) {
    const inv = await this.getInvitation(id);
    await this.invitationRepo.remove(inv);
    return { success: true };
  }

  // =========================================================================
  // Payments & Transactions Center (PKG-02: ADM-009 s/d ADM-015)
  // =========================================================================

  async listPayments(
    page = 1,
    limit = 20,
    q?: string,
    status?: string,
    purpose?: string,
    packageType?: string,
    startDate?: string,
    endDate?: string,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    kind?: string,
  ) {
    if (kind && !['paid', 'free', 'pending'].includes(kind)) {
      throw new BadRequestException('Jenis transaksi tidak valid.');
    }
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invitation', 'inv')
      .leftJoinAndSelect('inv.user', 'invUser')
      .leftJoinAndSelect('p.promoCode', 'promo');

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      qb.andWhere(
        '(p.orderId LIKE :term OR p.email LIKE :term OR p.name LIKE :term OR p.transactionId LIKE :term OR inv.title LIKE :term OR inv.slug LIKE :term)',
        { term },
      );
    }

    if (status && status !== 'all') {
      if (status === 'failed' || status === 'failure') {
        qb.andWhere("p.status IN ('failure', 'failed')");
      } else {
        qb.andWhere('p.status = :status', { status });
      }
    }

    if (purpose && purpose !== 'all') {
      qb.andWhere('p.purpose = :purpose', { purpose });
    }

    if (packageType && packageType !== 'all') {
      qb.andWhere('p.package = :packageType', { packageType });
    }

    if (kind) {
      qb.andWhere("(p.paymentType IS NULL OR p.paymentType <> 'simulation')");
      qb.andWhere('p.status = :kindStatus', {
        kindStatus: kind === 'pending' ? 'pending' : 'success',
      });
      if (kind === 'paid') {
        qb.andWhere('p.amount > 0');
        qb.andWhere("p.paymentMethod = 'midtrans'");
        qb.andWhere('p.settlementTime IS NOT NULL');
      } else if (kind === 'free') {
        qb.andWhere('p.amount = 0');
        qb.andWhere("(p.paymentMethod = 'FREE_ACTIVATION' OR p.paymentType = 'free')");
        qb.andWhere('p.settlementTime IS NOT NULL');
      }
    }

    if (startDate || endDate) {
      const dateColumn = kind === 'paid' || kind === 'free' ? 'p.settlementTime' : 'p.createdAt';
      if (kind || (startDate && endDate)) {
        const range = resolveDashboardPeriod({ startDate, endDate });
        qb.andWhere(`${dateColumn} >= :rangeStart AND ${dateColumn} < :rangeEnd`, {
          rangeStart: range.start, rangeEnd: range.effectiveEnd,
        });
      } else if (startDate) {
        const range = resolveDashboardPeriod({ startDate, endDate: startDate });
        qb.andWhere(`${dateColumn} >= :rangeStart`, { rangeStart: range.start });
      } else if (endDate) {
        const range = resolveDashboardPeriod({ startDate: endDate, endDate });
        qb.andWhere(`${dateColumn} < :rangeEnd`, { rangeEnd: range.effectiveEnd });
      }
    }

    if (sortBy === 'amount') {
      qb.orderBy('p.amount', sortOrder);
    } else if (sortBy === 'orderId') {
      qb.orderBy('p.orderId', sortOrder);
    } else if (sortBy === 'status') {
      qb.orderBy('p.status', sortOrder);
    } else {
      qb.orderBy('p.createdAt', sortOrder);
    }
    qb.addOrderBy('p.id', sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    const mappedData = data.map((p) => {
      const now = Date.now();
      const createdTime = new Date(p.createdAt).getTime();
      const ageHours = Math.round((now - createdTime) / (1000 * 60 * 60));

      return {
        id: p.id,
        orderId: p.orderId,
        name: p.name,
        email: p.email,
        amount: Number(p.amount || 0),
        discountAmount: Number(p.discountAmount || 0),
        status: p.status,
        paymentMethod: p.paymentMethod || null,
        paymentType: p.paymentType || null,
        transactionId: p.transactionId || null,
        fraudStatus: p.fraudStatus || null,
        settlementTime: p.settlementTime || null,
        purpose: p.purpose || 'invitation',
        package: p.package || null,
        aiCreditsAmount: p.aiCreditsAmount || null,
        commissionCredited: Boolean(p.commissionCredited),
        affiliateProfileId: p.affiliateProfileId || null,
        ageHours,
        isPendingAging: p.status === PaymentStatus.PENDING && ageHours >= 24,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        invitation: p.invitation
          ? {
              id: p.invitation.id,
              title: p.invitation.title,
              slug: p.invitation.slug,
              isPublished: Boolean(p.invitation.isPublished),
              package: p.invitation.package,
            }
          : null,
        owner: p.invitation?.user
          ? {
              id: p.invitation.user.id,
              name: p.invitation.user.name,
              email: p.invitation.user.email,
            }
          : p.userId
            ? {
                id: p.userId,
                name: p.name,
                email: p.email,
              }
            : null,
        promoCode: p.promoCode
          ? {
              id: p.promoCode.id,
              code: p.promoCode.code,
              discountType: p.promoCode.discountType,
              discountValue: p.promoCode.discountValue,
            }
          : null,
      };
    });

    return { data: mappedData, total, page, limit };
  }

  async getPaymentStats() {
    const grossRes = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where("p.status = 'success'")
      .getRawOne();

    const discRes = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.discountAmount)', 'total')
      .where("p.status = 'success'")
      .getRawOne();

    const countsByStatus = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(p.id)', 'count')
      .groupBy('p.status')
      .getRawMany();

    const countsByPurpose = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.purpose', 'purpose')
      .addSelect('COUNT(p.id)', 'count')
      .addSelect(
        "SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END)",
        'revenue',
      )
      .groupBy('p.purpose')
      .getRawMany();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingAgingCount = await this.paymentRepo.count({
      where: { status: PaymentStatus.PENDING, createdAt: LessThan(cutoff) },
    });

    const statusCounts: Record<string, number> = {
      success: 0,
      pending: 0,
      failed: 0,
      expired: 0,
    };

    countsByStatus.forEach((row) => {
      const st = String(row.status).toLowerCase();
      const cnt = Number(row.count) || 0;
      if (st === 'success') statusCounts.success += cnt;
      else if (st === 'pending') statusCounts.pending += cnt;
      else if (st === 'expired') statusCounts.expired += cnt;
      else statusCounts.failed += cnt;
    });

    const reconQueue = await this.getReconciliationQueue();

    return {
      grossRevenue: Number(grossRes?.total || 0),
      discountTotal: Number(discRes?.total || 0),
      netRevenue: Number(grossRes?.total || 0),
      statusCounts,
      pendingAgingCount,
      reconciliationCount: reconQueue.count,
      byPurpose: (countsByPurpose || []).map((row) => ({
        purpose: row.purpose || 'invitation',
        count: Number(row.count || 0),
        revenue: Number(row.revenue || 0),
      })),
    };
  }

  async getReconciliationQueue() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      successNotPublished,
      pendingAging,
      commissionPending,
      publishedUnpaid,
    ] = await Promise.all([
      // 1. Success but not published
      this.paymentRepo
        .createQueryBuilder('p')
        .innerJoinAndSelect('p.invitation', 'inv')
        .leftJoinAndSelect('inv.user', 'u')
        .where("p.status = 'success'")
        .andWhere("p.purpose = 'invitation'")
        .andWhere('inv.isPublished = false')
        .getMany(),

      // 2. Pending aging > 24 hours
      this.paymentRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.invitation', 'inv')
        .leftJoinAndSelect('inv.user', 'u')
        .where("p.status = 'pending'")
        .andWhere('p.createdAt < :cutoff', { cutoff })
        .orderBy('p.createdAt', 'ASC')
        .take(50)
        .getMany(),

      // 3. Commission pending credit
      this.paymentRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.invitation', 'inv')
        .where("p.status = 'success'")
        .andWhere('p.affiliateProfileId IS NOT NULL')
        .andWhere('p.commissionCredited = false')
        .getMany(),

      // 4. Published without successful payment
      this.invitationRepo
        .createQueryBuilder('inv')
        .leftJoinAndSelect('inv.user', 'u')
        .where('inv.isPublished = true')
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM payment p WHERE p.invitationId = inv.id AND p.status = 'success')`,
        )
        .orderBy('inv.id', 'DESC')
        .take(50)
        .getMany(),
    ]);

    const items: any[] = [];

    successNotPublished.forEach((p) => {
      items.push({
        type: 'SUCCESS_NOT_PUBLISHED',
        severity: 'danger',
        paymentId: p.id,
        orderId: p.orderId,
        invitationId: p.invitation?.id,
        title: `Pembayaran Lunas Belum Diterbitkan`,
        description: `Order ${p.orderId} (${p.invitation?.title || 'Undangan'}) berstatus lunas namun status publikasi masih Draft.`,
        amount: Number(p.amount || 0),
        customer: p.name || p.email,
        createdAt: p.createdAt,
        action: 'RECONCILE_PUBLISH',
      });
    });

    publishedUnpaid.forEach((inv) => {
      items.push({
        type: 'PUBLISHED_UNPAID',
        severity: 'warning',
        invitationId: inv.id,
        title: `Undangan Terbit Tanpa Bukti Lunas`,
        description: `Undangan ${inv.title} (${inv.slug}) berstatus Terbit tetapi tidak memiliki catatan pembayaran sukses.`,
        amount: 0,
        customer: inv.user?.name || inv.user?.email || 'Unknown',
        createdAt: inv.createdAt,
        action: 'CHECK_INVITATION',
      });
    });

    commissionPending.forEach((p) => {
      items.push({
        type: 'COMMISSION_PENDING',
        severity: 'warning',
        paymentId: p.id,
        orderId: p.orderId,
        title: `Komisi Afiliasi Belum Terkredit`,
        description: `Order ${p.orderId} memiliki afiliasi ID #${p.affiliateProfileId} yang belum ditandai terkredit.`,
        amount: Number(p.amount || 0),
        customer: p.name || p.email,
        createdAt: p.createdAt,
        action: 'CHECK_PAYMENT',
      });
    });

    pendingAging.forEach((p) => {
      const now = Date.now();
      const ageHours = Math.round(
        (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60),
      );
      items.push({
        type: 'PENDING_AGING',
        severity: 'neutral',
        paymentId: p.id,
        orderId: p.orderId,
        invitationId: p.invitation?.id,
        title: `Menunggu Pembayaran > 24 Jam`,
        description: `Order ${p.orderId} telah pending selama ${ageHours} jam tanpa konfirmasi gateway.`,
        amount: Number(p.amount || 0),
        customer: p.name || p.email,
        createdAt: p.createdAt,
        action: 'SYNC_GATEWAY',
      });
    });

    return {
      count: items.length,
      countsByType: {
        successNotPublished: successNotPublished.length,
        publishedUnpaid: publishedUnpaid.length,
        commissionPending: commissionPending.length,
        pendingAging: pendingAging.length,
      },
      items,
    };
  }

  async getPaymentDetail(id: number) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user', 'promoCode'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    let attempts: Payment[] = [];
    if (payment.invitationId) {
      attempts = await this.paymentRepo.find({
        where: { invitationId: payment.invitationId },
        order: { id: 'DESC' },
      });
    } else if (payment.userId) {
      attempts = await this.paymentRepo.find({
        where: { userId: payment.userId },
        order: { id: 'DESC' },
        take: 10,
      });
    } else {
      attempts = [payment];
    }

    let activities: ActivityLog[] = [];
    try {
      activities = await this.activityLogRepo.find({
        where: [
          { path: ILike(`%${payment.orderId}%`) },
          { path: ILike(`%/payments/${id}%`) },
        ],
        order: { id: 'DESC' },
        take: 10,
      });
    } catch {
      activities = [];
    }

    const now = Date.now();
    const createdTime = new Date(payment.createdAt).getTime();
    const ageHours = Math.round((now - createdTime) / (1000 * 60 * 60));

    return {
      id: payment.id,
      orderId: payment.orderId,
      name: payment.name,
      email: payment.email,
      amount: Number(payment.amount || 0),
      discountAmount: Number(payment.discountAmount || 0),
      paymentMethod: payment.paymentMethod || null,
      paymentType: payment.paymentType || null,
      transactionId: payment.transactionId || null,
      snapToken: payment.snapToken || null,
      redirectUrl: payment.redirectUrl || null,
      status: payment.status,
      fraudStatus: payment.fraudStatus || null,
      settlementTime: payment.settlementTime || null,
      purpose: payment.purpose || 'invitation',
      package: payment.package || null,
      aiCreditsAmount: payment.aiCreditsAmount || null,
      commissionCredited: Boolean(payment.commissionCredited),
      affiliateProfileId: payment.affiliateProfileId || null,
      ageHours,
      isPendingAging:
        payment.status === PaymentStatus.PENDING && ageHours >= 24,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      invitation: payment.invitation
        ? {
            id: payment.invitation.id,
            title: payment.invitation.title,
            slug: payment.invitation.slug,
            isPublished: Boolean(payment.invitation.isPublished),
            package: payment.invitation.package,
            expiredAt: payment.invitation.expiredAt,
          }
        : null,
      owner: payment.invitation?.user
        ? {
            id: payment.invitation.user.id,
            name: payment.invitation.user.name,
            email: payment.invitation.user.email,
          }
        : payment.userId
          ? {
              id: payment.userId,
              name: payment.name,
              email: payment.email,
            }
          : null,
      promoCode: payment.promoCode
        ? {
            id: payment.promoCode.id,
            code: payment.promoCode.code,
            discountType: payment.promoCode.discountType,
            discountValue: payment.promoCode.discountValue,
          }
        : null,
      attempts: attempts.map((a) => ({
        id: a.id,
        orderId: a.orderId,
        amount: Number(a.amount || 0),
        status: a.status,
        paymentType: a.paymentType || a.paymentMethod || null,
        createdAt: a.createdAt,
      })),
      recentActivities: activities,
    };
  }

  async reconcilePaymentPublish(
    id: number,
    reason?: string,
    adminUser?: any,
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['invitation'],
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.invitation) {
      throw new BadRequestException('Transaksi tidak terhubung ke undangan manapun');
    }
    if (payment.status !== 'success') {
      throw new BadRequestException(
        'Hanya transaksi berstatus sukses yang dapat direkonsiliasi untuk penerbitan.',
      );
    }

    const inv = payment.invitation;
    const oldPublished = inv.isPublished;
    inv.isPublished = true;
    if (payment.package) {
      inv.package = payment.package;
    }
    await this.invitationRepo.save(inv);

    try {
      await this.activityLogRepo.save(
        this.activityLogRepo.create({
          userId: adminUser?.id || null,
          userEmail: adminUser?.email || 'admin',
          action: 'ADMIN_PAYMENT_RECONCILE_PUBLISH',
          level: LogLevel.ACTION,
          path: `/admin/payments/${id}/reconcile-publish`,
          details: {
            paymentId: id,
            orderId: payment.orderId,
            invitationId: inv.id,
            oldPublished,
            newPublished: true,
            package: inv.package,
            reason: reason || 'Manual Admin Rekonsiliasi Penerbitan',
          },
        }),
      );
    } catch {
      // Continue even if logging fails
    }

    return {
      success: true,
      message: `Undangan ${inv.title} berhasil diterbitkan dan direkonsiliasi`,
      invitation: {
        id: inv.id,
        title: inv.title,
        slug: inv.slug,
        isPublished: inv.isPublished,
        package: inv.package,
      },
    };
  }

  async syncPaymentGateway(id: number, adminUser?: any) {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    const now = Date.now();
    const createdTime = new Date(payment.createdAt).getTime();
    const ageHours = Math.round((now - createdTime) / (1000 * 60 * 60));

    // If pending and > 48 hours, mark as expired gracefully
    let statusChanged = false;
    if (payment.status === PaymentStatus.PENDING && ageHours >= 48) {
      payment.status = PaymentStatus.EXPIRED;
      await this.paymentRepo.save(payment);
      statusChanged = true;
    }

    try {
      await this.activityLogRepo.save(
        this.activityLogRepo.create({
          userId: adminUser?.id || null,
          userEmail: adminUser?.email || 'admin',
          action: 'ADMIN_PAYMENT_SYNC_GATEWAY',
          level: LogLevel.ACTION,
          path: `/admin/payments/${id}/sync-gateway`,
          details: {
            paymentId: id,
            orderId: payment.orderId,
            status: payment.status,
            ageHours,
            statusChanged,
          },
        }),
      );
    } catch {
      // Continue
    }

    return {
      success: true,
      orderId: payment.orderId,
      status: payment.status,
      statusChanged,
      message: statusChanged
        ? `Status transaksi diperbarui menjadi ${payment.status}`
        : `Status transaksi terverifikasi: ${payment.status}`,
    };
  }

  async exportPayments(
    q?: string,
    status?: string,
    purpose?: string,
    packageType?: string,
    startDate?: string,
    endDate?: string,
    kind?: string,
  ) {
    const data: any[] = [];
    const batchSize = 1000;
    let page = 1;
    while (true) {
      const result = await this.listPayments(
        page, batchSize, q, status, purpose, packageType, startDate, endDate,
        'createdAt', 'DESC', kind,
      );
      data.push(...result.data);
      if (result.data.length < batchSize || data.length >= result.total) break;
      page++;
    }

    const headers = [
      'Order ID',
      'Waktu Transaksi',
      'Nama Pelanggan',
      'Email',
      'Tujuan Transaksi',
      'Paket',
      'Nominal (IDR)',
      'Diskon (IDR)',
      'Metode Pembayaran',
      'Status Pembayaran',
      'ID Gateway',
      'ID Undangan',
      'Slug Undangan',
      'Waktu Settlement',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = data.map((p: any) => [
      escapeCsv(p.orderId),
      escapeCsv(p.createdAt ? new Date(p.createdAt).toISOString() : ''),
      escapeCsv(p.name),
      escapeCsv(p.email),
      escapeCsv(p.purpose),
      escapeCsv(p.package || '-'),
      escapeCsv(p.amount),
      escapeCsv(p.discountAmount || 0),
      escapeCsv(p.paymentType || p.paymentMethod || '-'),
      escapeCsv(p.status),
      escapeCsv(p.transactionId || '-'),
      escapeCsv(p.invitation?.id || '-'),
      escapeCsv(p.invitation?.slug || '-'),
      escapeCsv(
        p.settlementTime ? new Date(p.settlementTime).toISOString() : '-',
      ),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      csv,
      filename: `transaksi-satuundangan-${dateStr}.csv`,
      total: data.length,
    };
  }

  // Guests
  async listGuests(
    page = 1,
    limit = 20,
    q?: string,
    sortBy = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const where = q
      ? [
          { name: ILike(`%${q}%`) },
          { phoneNumber: ILike(`%${q}%`) },
          { slug: ILike(`%${q}%`) },
        ]
      : undefined;
    const [data, total] = await this.guestRepo.findAndCount({
      where,
      relations: ['invitation'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getGuest(id: number) {
    const found = await this.guestRepo.findOne({
      where: { id },
      relations: ['invitation'],
    });
    if (!found) throw new NotFoundException('Guest not found');
    return found;
  }

  async updateGuest(id: number, payload: Partial<Guest>) {
    const guest = await this.getGuest(id);
    Object.assign(guest, payload);
    return this.guestRepo.save(guest);
  }

  async deleteGuest(id: number) {
    const guest = await this.getGuest(id);
    await this.guestRepo.remove(guest);
    return { success: true };
  }

  // Guest Messages
  async listGuestMessages(
    page = 1,
    limit = 20,
    q?: string,
    sortBy = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const where = q
      ? [{ guestName: ILike(`%${q}%`) }, { message: ILike(`%${q}%`) }]
      : undefined;
    const [data, total] = await this.guestMessageRepo.findAndCount({
      where,
      relations: ['invitation', 'guest'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async deleteGuestMessage(id: number) {
    const gm = await this.guestMessageRepo.findOne({ where: { id } });
    if (!gm) throw new NotFoundException('Guest message not found');
    await this.guestMessageRepo.remove(gm);
    return { success: true };
  }

  private applyFilters(where: any, filtersStr?: string) {
    if (!filtersStr) return where;
    try {
      const filters = JSON.parse(filtersStr);
      const filterEntries = Object.entries(filters).filter(
        ([_, value]) => value !== undefined && value !== null && value !== '',
      );
      if (filterEntries.length === 0) return where;

      const applyToObj = (obj: any) => {
        const newObj = { ...obj };
        filterEntries.forEach(([key, value]) => {
          if (key === 'category') {
            newObj.category = { ...newObj.category, name: ILike(`%${value}%`) };
          } else if (key === 'isActive') {
            newObj.isPublished = value === 'true';
          } else if (typeof value === 'string') {
            newObj[key] = ILike(`%${value}%`);
          } else {
            newObj[key] = value;
          }
        });
        return newObj;
      };

      if (Array.isArray(where)) {
        return where.length === 0
          ? [applyToObj({})]
          : where.map((obj) => applyToObj(obj));
      } else {
        return applyToObj(where || {});
      }
    } catch (e) {
      return where;
    }
  }

  // Template Designs
  async listTemplateDesigns(
    page = 1,
    limit = 20,
    q?: string,
    sortBy = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    filters?: string,
  ) {
    let where: any = q
      ? [
          { name: ILike(`%${q}%`) },
          { slug: ILike(`%${q}%`) },
          { category: { name: ILike(`%${q}%`) } },
        ]
      : {};

    where = this.applyFilters(where, filters);

    let order: any = { [sortBy]: sortOrder };
    if (sortBy === 'category') {
      order = { category: { name: sortOrder } };
    }

    const [data, total] = await this.templateDesignRepo.findAndCount({
      where,
      order,
      relations: ['category', 'palette', 'sections', 'sections.section'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((template) => this.transformTemplateDesign(template)),
      total,
      page,
      limit,
    };
  }

  async getTemplateDesign(id: number) {
    const template = await this.templateDesignRepo.findOne({
      where: { id },
      relations: ['category', 'palette', 'sections', 'sections.section'],
    });
    if (!template) throw new NotFoundException('Template design not found');
    return this.transformTemplateDesign(template);
  }

  async createTemplateDesign(payload: CreateTemplateDesignDto) {
    try {
      const { category: categoryName, paletteId, sections, ...rest } = payload;

      if (rest.slug) {
        const existingSlug = await this.templateDesignRepo.findOne({
          where: { slug: rest.slug },
        });
        if (existingSlug)
          throw new BadRequestException('Slug template sudah digunakan');
      }

      const category = await this.categoryRepo.findOne({
        where: { name: categoryName },
      });
      if (!category)
        throw new BadRequestException(`Category '${categoryName}' not found`);

      let palette: PaletteColor | null = null;
      if (paletteId) {
        palette = await this.paletteColorRepo.findOne({
          where: { id: paletteId },
        });
      }

      const data = this.normalizeTemplateDesignPayload(rest);
      const template = this.templateDesignRepo.create({
        ...data,
        category,
        palette,
      });

      const savedTemplate = await this.templateDesignRepo.save(template);

      if (sections && sections.length > 0) {
        for (const s of sections) {
          const sectionMaster = await this.sectionRepo.findOne({
            where: { id: s.sectionId },
          });
          if (sectionMaster) {
            const tdSection = this.templateDesignSectionRepo.create({
              templateDesign: savedTemplate,
              section: sectionMaster,
              order: s.order,
              is_enabled: s.is_enabled,
            });
            await this.templateDesignSectionRepo.save(tdSection);
          }
        }
      }

      return this.getTemplateDesign(savedTemplate.id);
    } catch (error) {
      console.error('Error creating template design:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error.message || 'Failed to create template design',
      );
    }
  }

  async updateTemplateDesign(id: number, payload: UpdateTemplateDesignDto) {
    try {
      const template = await this.templateDesignRepo.findOne({
        where: { id },
        relations: ['category', 'palette', 'sections', 'sections.section'],
      });
      if (!template) throw new NotFoundException('Template design not found');

      const { category: categoryName, paletteId, sections, ...rest } = payload;

      if (rest.slug && rest.slug !== template.slug) {
        const existingSlug = await this.templateDesignRepo.findOne({
          where: { slug: rest.slug },
        });
        if (existingSlug)
          throw new BadRequestException('Slug template sudah digunakan');
      }

      if (categoryName) {
        const found = await this.categoryRepo.findOne({
          where: { name: categoryName },
        });
        if (!found)
          throw new BadRequestException(`Category '${categoryName}' not found`);
        template.category = found;
      }

      if (paletteId !== undefined) {
        if (paletteId === null) {
          template.palette = null;
        } else if (paletteId) {
          const foundPalette = await this.paletteColorRepo.findOne({
            where: { id: paletteId },
          });
          if (foundPalette) template.palette = foundPalette;
        }
      }

      const data = this.normalizeTemplateDesignPayload(rest);
      Object.assign(template, data);

      const savedTemplate = await this.templateDesignRepo.save(template);

      if (sections !== undefined) {
        // Remove old sections and replace with new ones
        await this.templateDesignSectionRepo.delete({ templateDesign: { id } });
        if (sections && sections.length > 0) {
          for (const s of sections) {
            const sectionMaster = await this.sectionRepo.findOne({
              where: { id: s.sectionId },
            });
            if (sectionMaster) {
              const tdSection = this.templateDesignSectionRepo.create({
                templateDesign: savedTemplate,
                section: sectionMaster,
                order: s.order,
                is_enabled: s.is_enabled,
              });
              await this.templateDesignSectionRepo.save(tdSection);
            }
          }
        }
      }

      return this.getTemplateDesign(id);
    } catch (error) {
      console.error('Error updating template design:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new BadRequestException(
        error.message || 'Failed to update template design',
      );
    }
  }

  async deleteTemplateDesign(id: number) {
    const template = await this.templateDesignRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template design not found');
    await this.templateDesignRepo.remove(template);
    return { success: true };
  }

  // Sections
  async listSections(q?: string, activeOnly = false) {
    let where: any;
    if (q) {
      where = [
        { label: ILike(`%${q}%`), ...(activeOnly ? { is_active: true } : {}) },
        { key: ILike(`%${q}%`), ...(activeOnly ? { is_active: true } : {}) },
      ];
    } else if (activeOnly) {
      where = { is_active: true };
    }

    const sections = await this.sectionRepo.find({
      where,
      order: { label: 'ASC' },
    });

    console.log(
      `[DEBUG] listSections found ${sections.length} items. Raw first item:`,
      sections[0],
    );

    return sections.map((s) => {
      const raw = s as any;
      const isActive = s.is_active ?? raw.is_published ?? true;
      console.log(
        `[DEBUG] Mapping item ${s.key}: is_active=${s.is_active}, is_published=${raw.is_published} -> result=${isActive}`,
      );
      return {
        id: s.id,
        label: s.label,
        key: s.key,
        is_active: isActive,
      };
    });
  }

  async createSection(payload: any) {
    try {
      console.log('Creating section with payload:', payload);
      const section = this.sectionRepo.create({
        label: payload.label,
        key: payload.key,
        is_active:
          payload.is_active === true ||
          payload.is_active === 1 ||
          payload.is_active === 'true',
      });
      const saved = await this.sectionRepo.save(section);
      console.log('Saved section:', saved);
      return saved;
    } catch (error) {
      console.error('Error creating section:', error);
      throw new BadRequestException(
        error.message || 'Failed to create section',
      );
    }
  }

  async updateSection(id: string, payload: any) {
    try {
      console.log(`Updating section ${id} with payload:`, payload);
      const section = await this.sectionRepo.findOne({ where: { id } });
      if (!section) throw new NotFoundException('Section not found');

      if (payload.label !== undefined) section.label = payload.label;
      if (payload.key !== undefined) section.key = payload.key;
      if (payload.is_active !== undefined) {
        section.is_active =
          payload.is_active === true ||
          payload.is_active === 1 ||
          payload.is_active === 'true';
      }

      const saved = await this.sectionRepo.save(section);
      console.log('Updated section result:', saved);
      return saved;
    } catch (error) {
      console.error('Error updating section:', error);
      throw new BadRequestException(
        error.message || 'Failed to update section',
      );
    }
  }

  async deleteSection(id: string) {
    const section = await this.sectionRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    await this.sectionRepo.remove(section);
    return { success: true };
  }

  // Audio
  async listAudio(q?: string) {
    const where = q ? { title: ILike(`%${q}%`) } : undefined;
    return this.audioRepo.find({ where, order: { title: 'ASC' } });
  }

  async createAudio(payload: Partial<Audio>) {
    const audio = this.audioRepo.create(payload);
    return this.audioRepo.save(audio);
  }

  async uploadAudio(
    file: Express.Multer.File,
    payload: { title?: string; category?: string },
  ) {
    const upload = await this.uploadService.uploadFile(file);
    const fallbackTitle = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();

    const audio = this.audioRepo.create({
      title: payload.title?.trim() || fallbackTitle,
      category: payload.category?.trim() || 'romantic',
      url: upload.fileUrl,
    });

    return this.audioRepo.save(audio);
  }

  async deleteAudio(id: string) {
    const audio = await this.audioRepo.findOne({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    await this.audioRepo.remove(audio);
    return { success: true };
  }

  // Banks
  async listBanks(q?: string) {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { code: ILike(`%${q}%`) }]
      : undefined;
    return this.bankRepo.find({ where, order: { name: 'ASC' } });
  }

  async createBank(payload: Partial<Bank>) {
    const bank = this.bankRepo.create(payload);
    return this.bankRepo.save(bank);
  }

  async deleteBank(id: string) {
    const bank = await this.bankRepo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Bank not found');
    await this.bankRepo.remove(bank);
    return { success: true };
  }

  // Palette Colors
  async listPaletteColors(page = 1, limit = 20, q?: string) {
    const where = q ? { name: ILike(`%${q}%`) } : undefined;
    const [data, total] = await this.paletteColorRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async createPaletteColor(payload: CreatePaletteColorDto) {
    const palette = this.paletteColorRepo.create(payload);
    return this.paletteColorRepo.save(palette);
  }

  async updatePaletteColor(id: string, payload: UpdatePaletteColorDto) {
    const palette = await this.paletteColorRepo.findOne({ where: { id } });
    if (!palette) throw new NotFoundException('Palette color not found');
    Object.assign(palette, payload);
    return this.paletteColorRepo.save(palette);
  }

  async deletePaletteColor(id: string) {
    const palette = await this.paletteColorRepo.findOne({ where: { id } });
    if (!palette) throw new NotFoundException('Palette color not found');
    await this.paletteColorRepo.remove(palette);
    return { success: true };
  }

  private normalizeTemplateDesignPayload(
    payload: Partial<CreateTemplateDesignDto | UpdateTemplateDesignDto>,
  ): Partial<TemplateDesign> {
    const data: any = { ...payload };
    delete data.category;
    delete data.paletteId;
    delete data.sections;

    if (data.isActive !== undefined) {
      data.isPublished = data.isActive;
      delete data.isActive;
    }

    // paletteColors is already handled by TypeORM simple-array if it's an array of strings
    if (data.paletteColors && !Array.isArray(data.paletteColors)) {
      delete data.paletteColors;
    }

    if (data.tags) {
      if (Array.isArray(data.tags)) {
        data.tags = JSON.stringify(data.tags);
      } else if (typeof data.tags !== 'string') {
        data.tags = JSON.stringify(data.tags);
      }
    }

    if (data.filterGroup !== undefined) {
      data.filterGroup =
        typeof data.filterGroup === 'string' && data.filterGroup.trim()
          ? data.filterGroup.trim()
          : null;
    }

    if (data.sampleContent !== undefined) {
      data.sampleContent =
        data.sampleContent && typeof data.sampleContent === 'object'
          ? JSON.stringify(data.sampleContent)
          : data.sampleContent;
    }

    if (data.designConfig !== undefined) {
      data.designConfig =
        data.designConfig && typeof data.designConfig === 'object'
          ? JSON.stringify(data.designConfig)
          : data.designConfig;
    }

    return data as Partial<TemplateDesign>;
  }

  private transformTemplateDesign(template: TemplateDesign) {
    const result = { ...template } as any;
    result.tags = this.safeParse(template.tags);
    result.sampleContent = this.safeParse(template.sampleContent);
    result.designConfig = this.safeParse(template.designConfig);
    result.isActive = template.isPublished;

    // Use linked palette colors if available, otherwise use custom paletteColors
    if (template.palette) {
      result.paletteColors = [
        template.palette.primary,
        template.palette.secondary,
        template.palette.accent,
      ];
    } else if (template.paletteColors) {
      result.paletteColors = template.paletteColors;
    } else {
      result.paletteColors = [];
    }

    if (template.category && typeof template.category === 'object') {
      result.category = template.category.name;
    }

    if (template.palette) {
      result.palette = {
        id: template.palette.id,
        name: template.palette.name,
        primary: template.palette.primary,
        secondary: template.palette.secondary,
        accent: template.palette.accent,
      };
    }

    if (template.sections) {
      result.sections = template.sections
        .sort((a, b) => a.order - b.order)
        .map((ts) => ({
          id: ts.section.id,
          key: ts.section.key,
          label: ts.section.label,
          order: ts.order,
          is_enabled: ts.is_enabled,
        }));
    }

    delete result.sectionOptions;

    return result;
  }

  private safeParse(value?: string | null) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return value;
    }
  }

  async updateAdminRole(id: number, adminRole: AdminRole, actorId: number) {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target) throw new NotFoundException('Pengguna tidak ditemukan');
    if (!target.isAdmin) {
      throw new BadRequestException('Pengguna ini bukan admin. Jadikan admin lebih dulu.');
    }
    if (resolveAdminRole(target) === 'superadmin' && adminRole !== 'superadmin') {
      const admins = await this.userRepo.find({
        where: { isAdmin: true },
        select: { id: true, isAdmin: true, adminRole: true },
      });
      const otherSuperadmins = admins.filter(
        (admin) => admin.id !== id && resolveAdminRole(admin) === 'superadmin',
      );
      if (!otherSuperadmins.length) {
        throw new BadRequestException('Minimal satu superadmin harus tetap ada.');
      }
    }
    target.adminRole = adminRole;
    await this.userRepo.save(target);
    return { id, adminRole, changedById: actorId };
  }

  async getDashboardStats() {
    // 1. Get Category Distribution over all invitations in database
    const rawCategories = await this.invitationRepo
      .createQueryBuilder('inv')
      .leftJoin('inv.templateDesign', 'templateDesign')
      .leftJoin('templateDesign.category', 'category')
      .select('category.name', 'category')
      .addSelect('COUNT(inv.id)', 'count')
      .groupBy('category.name')
      .getRawMany();

    const categoryStats = rawCategories.map((item) => ({
      category: item.category || 'Lainnya',
      count: Number(item.count) || 0,
    }));

    // 2. Get 7-Day Registration Trend for Invitations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawTrend = await this.invitationRepo
      .createQueryBuilder('inv')
      .select("DATE_FORMAT(inv.createdAt, '%Y-%m-%d')", 'date')
      .addSelect('COUNT(inv.id)', 'count')
      .where('inv.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Map last 7 days array with default 0 if missing
    const trendStats: { date: string; dayLabel: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = rawTrend.find((item) => item.date === dateStr);
      trendStats.push({
        date: dateStr,
        dayLabel: i === 0 ? 'Hari Ini' : i === 1 ? 'Kemarin' : `H-${i}`,
        count: found ? Number(found.count) : 0,
      });
    }

    return {
      categories: categoryStats,
      trend: trendStats,
    };
  }

  // ==========================================
  // Activity & Telemetry Logs
  // ==========================================
  async recordLog(payload: {
    action: string;
    level?: string;
    path?: string;
    method?: string;
    details?: any;
    userId?: number;
    userEmail?: string;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      const log = this.activityLogRepo.create({
        action: payload.action,
        level: payload.level || 'INFO',
        path: payload.path,
        method: payload.method,
        details: payload.details,
        userId: payload.userId,
        userEmail: payload.userEmail,
        ip: payload.ip,
        userAgent: payload.userAgent,
      });
      return await this.activityLogRepo.save(log);
    } catch (err) {
      console.error('Failed to save activity log:', err);
      return null;
    }
  }

  async listLogs(
    page = 1,
    limit = 50,
    level?: string,
    action?: string,
    q?: string,
    userId?: number,
  ) {
    const qb = this.activityLogRepo.createQueryBuilder('log');

    if (level && level !== 'ALL') {
      qb.andWhere('log.level = :level', { level });
    }

    if (action && action !== 'ALL') {
      qb.andWhere('log.action = :action', { action });
    }

    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    if (q && q.trim()) {
      qb.andWhere(
        '(log.path LIKE :search OR log.userEmail LIKE :search OR log.action LIKE :search)',
        { search: `%${q.trim()}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLogStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalToday = await this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.createdAt >= :today', { today })
      .getCount();

    const pageViewsToday = await this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.createdAt >= :today AND log.action = :action', {
        today,
        action: 'PAGE_VIEW',
      })
      .getCount();

    const errorsToday = await this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.createdAt >= :today AND log.level = :level', {
        today,
        level: 'ERROR',
      })
      .getCount();

    const activeUsersResult = await this.activityLogRepo
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userEmail)', 'count')
      .where('log.createdAt >= :today AND log.userEmail IS NOT NULL', { today })
      .getRawOne();
    const activeUsersToday = parseInt(activeUsersResult?.count || '0', 10);

    // Top 5 paths visited today
    const topPaths = await this.activityLogRepo
      .createQueryBuilder('log')
      .select('log.path', 'path')
      .addSelect('COUNT(log.id)', 'count')
      .where(
        'log.createdAt >= :today AND log.path IS NOT NULL AND log.action = :action',
        {
          today,
          action: 'PAGE_VIEW',
        },
      )
      .groupBy('log.path')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Recent 5 errors
    const recentErrors = await this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.level = :level', { level: 'ERROR' })
      .orderBy('log.createdAt', 'DESC')
      .limit(5)
      .getMany();

    return {
      totalToday,
      pageViewsToday,
      errorsToday,
      activeUsersToday,
      topPaths: (topPaths || []).map((p) => ({
        path: p.path,
        count: Number(p.count),
      })),
      recentErrors,
    };
  }

  async clearLogs() {
    await this.activityLogRepo.clear();
    return { success: true, message: 'Semua catatan log berhasil dibersihkan' };
  }
}

