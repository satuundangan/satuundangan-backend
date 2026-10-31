import { createHash } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, LessThan, In } from 'typeorm';
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
import { TemplateDesignRevision } from './entities/template-design-revision.entity';
import { ActivityLog, LogLevel } from './entities/activity-log.entity';
import {
  CreateTemplateDesignDto,
  UpdateTemplateDesignDto,
} from './dto/template-design.dto';
import {
  CreatePaletteColorDto,
  UpdatePaletteColorDto,
} from './dto/palette-color.dto';
import {
  UpdateAudioMetadataDto,
  UploadAudioMetadataDto,
} from './dto/audio-metadata.dto';
import { DashboardStatsQueryDto } from './dto/dashboard-stats-query.dto';
import { UploadService } from '../modules/upload/upload.service';
import * as bcrypt from 'bcrypt';
import { AdminRole, resolveAdminRole } from './security/admin-roles';
import { resolveDashboardPeriod } from './admin-dashboard-period';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

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
    @InjectRepository(TemplateDesignRevision)
    private readonly templateDesignRevisionRepo: Repository<TemplateDesignRevision>,
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
    filters: Pick<
      AdminUsersQueryDto,
      'verification' | 'role' | 'lifecycle' | 'provider'
    > = {},
  ) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .addSelect('user.provider', 'provider')
      .addSelect('user.isAdmin', 'isAdmin')
      .addSelect('user.adminRole', 'adminRole')
      .addSelect('user.avatar', 'avatar')
      .addSelect('user.emailVerifiedAt', 'emailVerifiedAt')
      .addSelect('user.hasWeddingPlannerAccess', 'hasWeddingPlannerAccess')
      .addSelect('user.instagramHandle', 'instagramHandle')
      .addSelect('user.createdAt', 'createdAt')
      .addSelect('user.updatedAt', 'updatedAt')
      .addSelect('user.lastLoginAt', 'lastLoginAt')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(inv.id)')
            .from(Invitation, 'inv')
            .where('inv.userId = user.id'),
        'invitationsCount',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(DISTINCT pay.id)')
            .from(Payment, 'pay')
            .where('pay.userId = user.id')
            .andWhere("pay.status = 'success'")
            .andWhere('pay.amount > 0')
            .andWhere(
              "(pay.paymentMethod IS NULL OR pay.paymentMethod != 'FREE_ACTIVATION')",
            )
            .andWhere(
              "(pay.paymentType IS NULL OR LOWER(pay.paymentType) != 'simulation')",
            ),
        'paidTransactionsCount',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(DISTINCT pay.id)')
            .from(Payment, 'pay')
            .where('pay.userId IS NULL')
            .andWhere(
              '(LOWER(pay.email) = LOWER(user.email) OR EXISTS (SELECT 1 FROM invitation owned_inv WHERE owned_inv.id = pay.invitationId AND owned_inv.userId = user.id))',
            )
            .andWhere("pay.status = 'success'")
            .andWhere('pay.amount > 0')
            .andWhere(
              "(pay.paymentMethod IS NULL OR pay.paymentMethod != 'FREE_ACTIVATION')",
            )
            .andWhere(
              "(pay.paymentType IS NULL OR LOWER(pay.paymentType) != 'simulation')",
            ),
        'paidTransactionsByFallback',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COALESCE(SUM(pay.amount), 0)')
            .from(Payment, 'pay')
            .where('pay.userId = user.id')
            .andWhere("pay.status = 'success'")
            .andWhere('pay.amount > 0')
            .andWhere(
              "(pay.paymentMethod IS NULL OR pay.paymentMethod != 'FREE_ACTIVATION')",
            )
            .andWhere(
              "(pay.paymentType IS NULL OR LOWER(pay.paymentType) != 'simulation')",
            ),
        'paidSpendByAccount',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COALESCE(SUM(pay.amount), 0)')
            .from(Payment, 'pay')
            .where('pay.userId IS NULL')
            .andWhere(
              '(LOWER(pay.email) = LOWER(user.email) OR EXISTS (SELECT 1 FROM invitation owned_inv WHERE owned_inv.id = pay.invitationId AND owned_inv.userId = user.id))',
            )
            .andWhere("pay.status = 'success'")
            .andWhere('pay.amount > 0')
            .andWhere(
              "(pay.paymentMethod IS NULL OR pay.paymentMethod != 'FREE_ACTIVATION')",
            )
            .andWhere(
              "(pay.paymentType IS NULL OR LOWER(pay.paymentType) != 'simulation')",
            ),
        'paidSpendByFallback',
      );

    if (q && q.trim()) {
      qb.andWhere('(user.name LIKE :search OR user.email LIKE :search)', {
        search: `%${q.trim()}%`,
      });
    }

    if (filters.verification === 'verified')
      qb.andWhere('user.emailVerifiedAt IS NOT NULL');
    if (filters.verification === 'unverified')
      qb.andWhere('user.emailVerifiedAt IS NULL');
    if (filters.role === 'admin') qb.andWhere('user.isAdmin = true');
    if (filters.role === 'customer') qb.andWhere('user.isAdmin = false');
    if (filters.provider?.trim())
      qb.andWhere('user.provider = :provider', {
        provider: filters.provider.trim(),
      });

    const hasPaid = (sub: any) =>
      sub
        .select('pay.id')
        .from(Payment, 'pay')
        .where(
          '(pay.userId = user.id OR (pay.userId IS NULL AND (LOWER(pay.email) = LOWER(user.email) OR EXISTS (SELECT 1 FROM invitation owned_inv WHERE owned_inv.id = pay.invitationId AND owned_inv.userId = user.id))))',
        )
        .andWhere("pay.status = 'success'")
        .andWhere('pay.amount > 0')
        .andWhere(
          "(pay.paymentMethod IS NULL OR pay.paymentMethod != 'FREE_ACTIVATION')",
        )
        .andWhere(
          "(pay.paymentType IS NULL OR LOWER(pay.paymentType) != 'simulation')",
        );
    const hasInvitation = (sub: any) =>
      sub
        .select('inv.id')
        .from(Invitation, 'inv')
        .where('inv.userId = user.id');
    const hasPublishedInvitation = (sub: any) =>
      sub
        .select('inv.id')
        .from(Invitation, 'inv')
        .where('inv.userId = user.id')
        .andWhere('inv.isPublished = true');
    const hasCompletedInvitation = (sub: any) =>
      sub
        .select('inv.id')
        .from(Invitation, 'inv')
        .where('inv.userId = user.id')
        .andWhere('inv.eventCompletedAt IS NOT NULL');
    const hasPendingPayment = (sub: any) =>
      sub
        .select('pay.id')
        .from(Payment, 'pay')
        .where(
          '(pay.userId = user.id OR (pay.userId IS NULL AND (LOWER(pay.email) = LOWER(user.email) OR EXISTS (SELECT 1 FROM invitation owned_inv WHERE owned_inv.id = pay.invitationId AND owned_inv.userId = user.id))))',
        )
        .andWhere("pay.status = 'pending'");

    switch (filters.lifecycle) {
      case 'never_started':
        qb.andWhere(`NOT EXISTS ${hasInvitation(qb.subQuery())!.getQuery()}`);
        break;
      case 'draft':
        qb.andWhere(`EXISTS ${hasInvitation(qb.subQuery())!.getQuery()}`)
          .andWhere(
            `NOT EXISTS ${hasPublishedInvitation(qb.subQuery())!.getQuery()}`,
          )
          .andWhere(
            `NOT EXISTS ${hasPendingPayment(qb.subQuery())!.getQuery()}`,
          )
          .andWhere(`NOT EXISTS ${hasPaid(qb.subQuery())!.getQuery()}`);
        break;
      case 'checkout_pending':
        qb.andWhere(
          `EXISTS ${hasPendingPayment(qb.subQuery())!.getQuery()}`,
        ).andWhere(`NOT EXISTS ${hasPaid(qb.subQuery())!.getQuery()}`);
        break;
      case 'paid':
        qb.andWhere(`EXISTS ${hasPaid(qb.subQuery())!.getQuery()}`);
        break;
      case 'published':
        qb.andWhere(
          `EXISTS ${hasPublishedInvitation(qb.subQuery())!.getQuery()}`,
        );
        break;
      case 'event_completed':
        qb.andWhere(
          `EXISTS ${hasCompletedInvitation(qb.subQuery())!.getQuery()}`,
        );
        break;
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
    const data = await qb.getRawMany();
    const total = await qb.clone().select('user.id').getCount();
    return {
      data: data.map((row) => ({
        ...row,
        id: Number(row.id),
        isAdmin: Boolean(Number(row.isAdmin)),
        hasWeddingPlannerAccess: Boolean(Number(row.hasWeddingPlannerAccess)),
        invitationsCount: Number(row.invitationsCount || 0),
        paidTransactionsCount: Number(row.paidTransactionsCount || 0),
        paidTransactionsByFallback: Number(row.paidTransactionsByFallback || 0),
        paidSpendByAccount: Number(row.paidSpendByAccount || 0),
        paidSpendByFallback: Number(row.paidSpendByFallback || 0),
        activityTimestampAccuracy: row.createdAt
          ? 'legacy_accuracy_unverified'
          : 'unknown',
      })),
      total,
      page,
      limit,
      definitions: {
        paidTransactionsCount:
          'Successful positive non-simulation payment linked by Payment.userId; free activation excluded.',
        paidTransactionsByFallback:
          'Separate fallback count for successful positive non-simulation payments with no userId and either matching payer email or a link to an owned invitation; fallback attribution does not prove account ownership.',
        paidSpendByAccount:
          'Sum of successful positive Payment.amount linked by Payment.userId. Amount is after any stored discount; refund, gateway fee and commission data are not deducted.',
        activityTimestampAccuracy:
          'createdAt for legacy accounts may predate its reliable capture; lastLoginAt is only recorded after deployment.',
      },
    };
  }

  async getUser(id: number) {
    const found = await this.userRepo.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        isAdmin: true,
        adminRole: true,
        avatar: true,
        emailVerifiedAt: true,
        hasWeddingPlannerAccess: true,
        instagramHandle: true,
        createdAt: true,
        registeredAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async getUserStats() {
    const row = await this.userRepo
      .createQueryBuilder('user')
      .select('COUNT(user.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN user.emailVerifiedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'verified',
      )
      .addSelect(
        'SUM(CASE WHEN user.isAdmin = true THEN 1 ELSE 0 END)',
        'admins',
      )
      .addSelect(
        'SUM(CASE WHEN user.isAdmin = false THEN 1 ELSE 0 END)',
        'customers',
      )
      .getRawOne();
    return {
      total: Number(row?.total || 0),
      verified: Number(row?.verified || 0),
      admins: Number(row?.admins || 0),
      customers: Number(row?.customers || 0),
      definitions: {
        customers:
          'Accounts with isAdmin=false, including accounts that have not created an invitation.',
        verified: 'Accounts with a stored emailVerifiedAt timestamp.',
      },
    };
  }

  private async findUserEntity(id: number) {
    const found = await this.userRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async getCustomerDetail(id: number) {
    const user = await this.getUser(id);
    const [
      invitations,
      payments,
      activities,
      invitationCount,
      publishedInvitationCount,
      paymentCount,
      accountPaymentStats,
      emailPaymentStats,
      pendingPaymentCount,
      completionStats,
    ] = await Promise.all([
      this.invitationRepo.find({
        where: { user: { id } },
        select: {
          id: true,
          title: true,
          slug: true,
          isPublished: true,
          publishedAt: true,
          eventCompletedAt: true,
          eventCompletedByAdminId: true,
          eventCompletionReason: true,
          dateTime: true,
          createdAt: true,
          updatedAt: true,
        },
        order: { id: 'DESC' },
        take: 50,
      }),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.invitation', 'invitation')
        .leftJoin('invitation.user', 'invitationOwner')
        .where(
          '(payment.userId = :id OR (payment.userId IS NULL AND (LOWER(payment.email) = :email OR invitation.userId = :id)))',
          {
            id,
            email: String(user.email).toLowerCase(),
          },
        )
        .select([
          'payment.id',
          'payment.orderId',
          'payment.name',
          'payment.email',
          'payment.amount',
          'payment.status',
          'payment.purpose',
          'payment.paymentMethod',
          'payment.paymentType',
          'payment.createdAt',
          'payment.settlementTime',
          'payment.invitationId',
          'payment.userId',
          'invitation.id',
          'invitation.title',
          'invitation.slug',
          'invitationOwner.id',
        ])
        .orderBy('payment.id', 'DESC')
        .take(100)
        .getMany(),
      this.activityLogRepo.find({
        where: { userEmail: user.email },
        select: { id: true, action: true, level: true, createdAt: true },
        order: { id: 'DESC' },
        take: 50,
      }),
      this.invitationRepo.count({ where: { user: { id } } }),
      this.invitationRepo.count({ where: { user: { id }, isPublished: true } }),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .where(
          '(payment.userId = :id OR (payment.userId IS NULL AND (LOWER(payment.email) = :email OR invitation.userId = :id)))',
          { id, email: String(user.email).toLowerCase() },
        )
        .getCount(),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .select(
          "SUM(CASE WHEN payment.status = 'success' AND payment.amount > 0 AND (payment.paymentMethod IS NULL OR payment.paymentMethod != 'FREE_ACTIVATION') AND (payment.paymentType IS NULL OR LOWER(payment.paymentType) != 'simulation') THEN 1 ELSE 0 END)",
          'count',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN payment.status = 'success' AND payment.amount > 0 AND (payment.paymentMethod IS NULL OR payment.paymentMethod != 'FREE_ACTIVATION') AND (payment.paymentType IS NULL OR LOWER(payment.paymentType) != 'simulation') THEN payment.amount ELSE 0 END), 0)",
          'spend',
        )
        .where('payment.userId = :id', { id })
        .getRawOne(),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .select(
          "SUM(CASE WHEN payment.status = 'success' AND payment.amount > 0 AND (payment.paymentMethod IS NULL OR payment.paymentMethod != 'FREE_ACTIVATION') AND (payment.paymentType IS NULL OR LOWER(payment.paymentType) != 'simulation') THEN 1 ELSE 0 END)",
          'count',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN payment.status = 'success' AND payment.amount > 0 AND (payment.paymentMethod IS NULL OR payment.paymentMethod != 'FREE_ACTIVATION') AND (payment.paymentType IS NULL OR LOWER(payment.paymentType) != 'simulation') THEN payment.amount ELSE 0 END), 0)",
          'spend',
        )
        .where(
          'payment.userId IS NULL AND (LOWER(payment.email) = :email OR invitation.userId = :id)',
          {
            email: String(user.email).toLowerCase(),
            id,
          },
        )
        .getRawOne(),
      this.paymentRepo
        .createQueryBuilder('payment')
        .where(
          '(payment.userId = :id OR (payment.userId IS NULL AND (LOWER(payment.email) = :email OR invitation.userId = :id)))',
          { id, email: String(user.email).toLowerCase() },
        )
        .leftJoin('payment.invitation', 'invitation')
        .andWhere("payment.status = 'pending'")
        .getCount(),
      this.invitationRepo
        .createQueryBuilder('invitation')
        .select('COUNT(invitation.id)', 'count')
        .addSelect('MAX(invitation.eventCompletedAt)', 'latestAt')
        .where('invitation.userId = :id', { id })
        .andWhere('invitation.eventCompletedAt IS NOT NULL')
        .getRawOne(),
    ]);

    const timeline = [
      ...(user.registeredAt
        ? [
            {
              type: 'account_registered',
              at: user.registeredAt,
              label: 'Akun terdaftar',
              evidence: 'registeredAt; dicatat saat registrasi mandiri',
            },
          ]
        : []),
      ...(user.lastLoginAt
        ? [
            {
              type: 'login',
              at: user.lastLoginAt,
              label: 'Login berhasil (pelacakan baru aktif)',
              evidence: 'lastLoginAt',
            },
          ]
        : []),
      ...(user.emailVerifiedAt
        ? [
            {
              type: 'email_verified',
              at: user.emailVerifiedAt,
              source: 'User.emailVerifiedAt',
            },
          ]
        : []),
      ...invitations.map((inv) => ({
        type: 'invitation_created',
        at: inv.createdAt,
        invitationId: inv.id,
        label: inv.title,
      })),
      ...payments
        .filter(
          (payment) =>
            payment.status === 'success' &&
            Number(payment.amount) > 0 &&
            payment.paymentMethod !== 'FREE_ACTIVATION' &&
            payment.paymentType !== 'simulation',
        )
        .map((payment) => ({
          type: 'payment_settled',
          at: payment.settlementTime,
          paymentId: payment.id,
          orderId: payment.orderId,
          label: payment.invitation?.title || 'Transaksi',
          evidence:
            payment.userId === id
              ? 'account_id'
              : payment.invitation?.user?.id === id
                ? 'owned_invitation'
                : 'payer_email_match',
        })),
      ...invitations
        .filter((inv) => inv.publishedAt || inv.isPublished)
        .map((inv) => ({
          type: 'invitation_published',
          at: inv.publishedAt,
          invitationId: inv.id,
          label: `${inv.title || `Undangan #${inv.id}`} pertama diterbitkan`,
          evidence: inv.publishedAt
            ? 'publishedAt; waktu penerbitan pertama dicatat sejak pelacakan aktif'
            : 'isPublished=true; waktu terbit historis tidak diketahui',
          timestampUnknown: !inv.publishedAt,
        })),
      ...invitations
        .filter((inv) => inv.eventCompletedAt)
        .map((inv) => ({
          type: 'wedding_completed',
          at: inv.eventCompletedAt,
          invitationId: inv.id,
          actorId: inv.eventCompletedByAdminId,
          label: `${inv.title || `Undangan #${inv.id}`} dikonfirmasi selesai`,
          evidence: `Konfirmasi admin #${inv.eventCompletedByAdminId}: ${inv.eventCompletionReason}`,
        })),
      ...activities.map((activity) => ({
        type: 'activity',
        at: activity.createdAt,
        label: activity.action,
        level: activity.level,
      })),
    ];
    const accountPaidCount = Number(accountPaymentStats?.count || 0);
    const accountSpend = Number(accountPaymentStats?.spend || 0);
    const fallbackPaidCount = Number(emailPaymentStats?.count || 0);
    const fallbackSpend = Number(emailPaymentStats?.spend || 0);

    return {
      customer: {
        ...user,
        activityTimestampAccuracy: user.createdAt
          ? 'legacy_accuracy_unverified'
          : 'unknown',
        registrationTimestampAccuracy: user.registeredAt
          ? 'tracked_since_deployment'
          : 'unknown',
        lastLoginAtAccuracy: user.lastLoginAt
          ? 'tracked_since_deployment'
          : 'unknown',
      },
      lifecycle: {
        stage:
          Number(completionStats?.count || 0) > 0
            ? 'event_completed'
            : publishedInvitationCount > 0
            ? 'published'
            : pendingPaymentCount > 0
              ? 'checkout_pending'
              : accountPaidCount > 0
                ? 'paid'
                : fallbackPaidCount > 0
                  ? 'paid_by_legacy_link'
                  : invitationCount
                    ? 'draft'
                    : user.emailVerifiedAt
                      ? 'verified_no_invitation'
                      : 'unverified',
        evidence:
          'Derived from recorded verification, owned invitations, eligible payment records, and admin-confirmed event completion. Planned wedding dates are not treated as proof of completion.',
        weddingCompletion: Number(completionStats?.count || 0)
          ? {
              confirmedInvitationCount: Number(completionStats.count),
              latestAt: completionStats.latestAt,
              evidence: 'Explicit admin confirmation; historical records remain unknown.',
            }
          : null,
      },
      invitations,
      payments: payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        payer: { name: payment.name, email: payment.email },
        accountAttribution:
          payment.userId === id
            ? 'account_id'
            : payment.userId === null && payment.invitation?.user?.id === id
              ? 'owned_invitation'
              : payment.userId === null
                ? 'payer_email_match'
                : 'unrelated',
        amount: Number(payment.amount),
        status: payment.status,
        purpose: payment.purpose,
        paymentMethod: payment.paymentMethod,
        paymentType: payment.paymentType,
        createdAt: payment.createdAt,
        settlementTime: payment.settlementTime,
        invitation: payment.invitation
          ? {
              id: payment.invitation.id,
              title: payment.invitation.title,
              slug: payment.invitation.slug,
            }
          : null,
      })),
      summary: {
        invitationCount,
        paymentCount,
        paidTransactionCountByAccountId: accountPaidCount,
        paidTransactionCountByFallback: fallbackPaidCount,
        spendByAccount: accountSpend,
        spendByFallback: fallbackSpend,
        completedInvitationCount: Number(completionStats?.count || 0),
        fallbackLinkMayNotIdentifyTheAccountOwner: true,
      },
      timeline: timeline.sort((a, b) => {
        if (!a.at) return 1;
        if (!b.at) return -1;
        return new Date(b.at).getTime() - new Date(a.at).getTime();
      }),
      limitations: [
        'Legacy signup timestamps have not been validated against historical event sources.',
        'Registration timestamps are captured for new self-service email and Google accounts; existing and admin-created accounts remain unknown.',
        'No reliable login history exists before lastLoginAt tracking was deployed.',
        'Publication timestamps are recorded for new transitions; legacy publication times remain unknown.',
        'Wedding completion is recorded only after explicit admin confirmation; legacy rows remain unknown.',
        'Detail lists are capped to the latest 50 invitations, 100 payments and 50 activity records; summary totals use all matching records.',
      ],
    };
  }

  async completeCustomerEvent(
    userId: number,
    invitationId: number,
    reason: string,
    adminUser: { id?: number },
  ) {
    const normalizedReason = String(reason || '').trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      throw new BadRequestException('Alasan konfirmasi harus 5–500 karakter.');
    }
    const actorId = Number(adminUser?.id);
    if (!Number.isSafeInteger(actorId) || actorId <= 0) {
      throw new BadRequestException('Identitas admin yang mengonfirmasi tidak valid.');
    }

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, user: { id: userId } },
    });
    if (!invitation) {
      throw new NotFoundException('Undangan milik pelanggan tidak ditemukan.');
    }
    if (!invitation.isPublished) {
      throw new BadRequestException(
        'Hanya undangan yang sudah terbit yang dapat dikonfirmasi selesai.',
      );
    }
    if (invitation.eventCompletedAt) {
      throw new ConflictException(
        'Acara pada undangan ini sudah pernah dikonfirmasi selesai.',
      );
    }

    invitation.eventCompletedAt = new Date();
    invitation.eventCompletedByAdminId = actorId;
    invitation.eventCompletionReason = normalizedReason;
    await this.invitationRepo.save(invitation);

    return {
      invitationId: invitation.id,
      eventCompletedAt: invitation.eventCompletedAt,
      eventCompletedByAdminId: invitation.eventCompletedByAdminId,
      eventCompletionReason: invitation.eventCompletionReason,
    };
  }

  async createUser(payload: Partial<User> & { password?: string }) {
    if (payload.email) {
      const existing = await this.userRepo.findOne({
        where: { email: payload.email },
      });
      if (existing) throw new BadRequestException('Email already exists');
    }
    const user = this.userRepo.create({ ...payload, registeredAt: null });
    if (payload.password) {
      user.password = await bcrypt.hash(payload.password, 10);
      user.provider = user.provider || 'local';
    }
    const saved = await this.userRepo.save(user);
    return this.getUser(saved.id);
  }

  async updateUser(id: number, payload: Partial<User> & { password?: string }) {
    const user = await this.findUserEntity(id);
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
    delete rest.registeredAt;
    if (typeof isEmailVerified === 'boolean') {
      user.emailVerifiedAt = isEmailVerified
        ? user.emailVerifiedAt || new Date()
        : null;
      if (isEmailVerified) {
        user.emailVerificationTokenHash = null;
        user.emailVerificationTokenExpiresAt = null;
      }
    }
    Object.assign(user, rest);
    await this.userRepo.save(user);
    return this.getUser(user.id);
  }

  async deleteUser(id: number) {
    const user = await this.findUserEntity(id);
    const [invitationCount, paymentCount] = await Promise.all([
      this.invitationRepo.count({ where: { user: { id } } }),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .where(
          '(payment.userId = :id OR (payment.userId IS NULL AND (LOWER(payment.email) = :email OR invitation.userId = :id)))',
          { id, email: user.email.toLowerCase() },
        )
        .getCount(),
    ]);
    try {
      await this.userRepo.query('DELETE FROM user_consents WHERE user_id = ?', [
        id,
      ]);
    } catch {}
    if (user.email) {
      try {
        await this.activityLogRepo.delete({ userEmail: user.email });
      } catch {}
    }
    const userInvs = await this.invitationRepo.find({
      where: { user: { id } },
    });
    for (const inv of userInvs) {
      await this.deleteInvitation(inv.id);
    }
    await this.userRepo.remove(user);
    return {
      success: true,
      impact: {
        invitationCount,
        linkedPaymentCount: paymentCount,
        invitationsAreDeleted: true,
        paymentRecordsAreRetained: true,
      },
    };
  }

  async verifyUserEmail(id: number) {
    const user = await this.getUser(id);
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;
    await this.userRepo.save(user);
    return {
      success: true,
      message: `Email ${user.email} berhasil diverifikasi.`,
    };
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
        edge === 'start'
          ? `${value}T00:00:00+07:00`
          : `${value}T23:59:59.999+07:00`,
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
      if (this.isUuid(category)) {
        qb.andWhere('category.id = :categoryId', { categoryId: category });
      } else {
        const normalizedCategory = category.normalize('NFKC').trim().replace(/\s+/gu, ' ');
        qb.andWhere(
          '(LOWER(TRIM(category.name)) = LOWER(:categoryName) OR JSON_CONTAINS(category.aliases, :categoryNameJson))',
          {
            categoryName: normalizedCategory,
            categoryNameJson: JSON.stringify(normalizedCategory),
          },
        );
      }
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
    if (!oldPublished && inv.isPublished && !inv.publishedAt) {
      inv.publishedAt = new Date();
    }
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
        qb.andWhere(
          "(p.paymentMethod = 'FREE_ACTIVATION' OR p.paymentType = 'free')",
        );
        qb.andWhere('p.settlementTime IS NOT NULL');
      }
    }

    if (startDate || endDate) {
      const dateColumn =
        kind === 'paid' || kind === 'free' ? 'p.settlementTime' : 'p.createdAt';
      if (kind || (startDate && endDate)) {
        const range = resolveDashboardPeriod({ startDate, endDate });
        qb.andWhere(
          `${dateColumn} >= :rangeStart AND ${dateColumn} < :rangeEnd`,
          {
            rangeStart: range.start,
            rangeEnd: range.effectiveEnd,
          },
        );
      } else if (startDate) {
        const range = resolveDashboardPeriod({ startDate, endDate: startDate });
        qb.andWhere(`${dateColumn} >= :rangeStart`, {
          rangeStart: range.start,
        });
      } else if (endDate) {
        const range = resolveDashboardPeriod({ startDate: endDate, endDate });
        qb.andWhere(`${dateColumn} < :rangeEnd`, {
          rangeEnd: range.effectiveEnd,
        });
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

  async reconcilePaymentPublish(id: number, reason?: string, adminUser?: any) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['invitation'],
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.invitation) {
      throw new BadRequestException(
        'Transaksi tidak terhubung ke undangan manapun',
      );
    }
    if (payment.status !== 'success') {
      throw new BadRequestException(
        'Hanya transaksi berstatus sukses yang dapat direkonsiliasi untuk penerbitan.',
      );
    }

    const inv = payment.invitation;
    const oldPublished = inv.isPublished;
    inv.isPublished = true;
    if (!oldPublished && !inv.publishedAt) {
      inv.publishedAt = new Date();
    }
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
        page,
        batchSize,
        q,
        status,
        purpose,
        packageType,
        startDate,
        endDate,
        'createdAt',
        'DESC',
        kind,
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
            newObj.category = this.isUuid(String(value))
              ? { ...newObj.category, id: value }
              : { ...newObj.category, name: ILike(`%${value}%`) };
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
  async getTemplateDesignMetrics(
    query: { days?: number; startDate?: string; endDate?: string } = {},
  ) {
    const period = resolveDashboardPeriod(query);
    const [templates, invitationRows, paidRows, freeRows] = await Promise.all([
      this.templateDesignRepo.find({
        select: ['id', 'name', 'slug', 'isPublished'],
        order: { name: 'ASC' },
      }),
      this.invitationRepo
        .createQueryBuilder('invitation')
        .select('invitation.templateDesignId', 'templateId')
        .addSelect('COUNT(invitation.id)', 'invitationCount')
        .addSelect(
          'SUM(CASE WHEN invitation.isPublished = 1 THEN 1 ELSE 0 END)',
          'publishedCount',
        )
        .where('invitation.templateDesignId IS NOT NULL')
        .andWhere(
          'invitation.createdAt >= :start AND invitation.createdAt < :end',
          { start: period.start, end: period.effectiveEnd },
        )
        .groupBy('invitation.templateDesignId')
        .getRawMany(),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .select(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId)',
          'templateId',
        )
        .addSelect('COUNT(DISTINCT payment.id)', 'paymentCount')
        .addSelect('COALESCE(SUM(payment.amount), 0)', 'grossAmount')
        .where(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId) IS NOT NULL',
        )
        .andWhere("payment.status = 'success'")
        .andWhere('payment.amount > 0')
        .andWhere('payment.settlementTime IS NOT NULL')
        .andWhere(
          "(payment.paymentMethod IS NULL OR payment.paymentMethod <> 'FREE_ACTIVATION')",
        )
        .andWhere(
          "(payment.paymentType IS NULL OR LOWER(payment.paymentType) <> 'simulation')",
        )
        .andWhere(
          'payment.settlementTime >= :start AND payment.settlementTime < :end',
          { start: period.start, end: period.effectiveEnd },
        )
        .groupBy(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId)',
        )
        .getRawMany(),
      this.paymentRepo
        .createQueryBuilder('payment')
        .leftJoin('payment.invitation', 'invitation')
        .select(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId)',
          'templateId',
        )
        .addSelect('COUNT(DISTINCT payment.id)', 'paymentCount')
        .where(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId) IS NOT NULL',
        )
        .andWhere("payment.status = 'success'")
        .andWhere('payment.amount = 0')
        .andWhere('payment.settlementTime IS NOT NULL')
        .andWhere(
          "(payment.paymentMethod = 'FREE_ACTIVATION' OR LOWER(payment.paymentType) = 'free')",
        )
        .andWhere(
          "(payment.paymentType IS NULL OR LOWER(payment.paymentType) <> 'simulation')",
        )
        .andWhere(
          'payment.settlementTime >= :start AND payment.settlementTime < :end',
          { start: period.start, end: period.effectiveEnd },
        )
        .groupBy(
          'COALESCE(payment.templateDesignIdSnapshot, invitation.templateDesignId)',
        )
        .getRawMany(),
    ]);

    const toMap = (rows: any[], countField: string) =>
      new Map(
        rows.map((row) => [
          Number(row.templateId),
          {
            count: Number(row[countField] || 0),
            grossAmount: Number(row.grossAmount || 0),
          },
        ]),
      );
    const invitationsByTemplate = new Map(
      invitationRows.map((row) => [
        Number(row.templateId),
        {
          count: Number(row.invitationCount || 0),
          publishedCount: Number(row.publishedCount || 0),
        },
      ]),
    );
    const paidByTemplate = toMap(paidRows, 'paymentCount');
    const freeByTemplate = toMap(freeRows, 'paymentCount');

    return {
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
        timezone: period.timezone,
        days: period.days,
      },
      definitions: {
        invitationCount:
          'Undangan dibuat dalam periode, dikelompokkan menurut template saat ini.',
        publishedCount:
          'Status terbit saat ini pada undangan yang dibuat dalam periode; bukan jumlah transaksi.',
        paidCount:
          'Payment sukses, bernilai positif, tersettlement dalam periode, selain aktivasi gratis/simulasi.',
        freeCount:
          'Payment sukses bernilai nol dengan penanda aktivasi gratis, tersettlement dalam periode.',
        grossAmount:
          'Jumlah Payment.amount dari transaksi berbayar yang memenuhi syarat; refund dan biaya tidak dikurangkan.',
        attribution:
          'Transaksi baru memakai snapshot template saat checkout. Payment lama tanpa snapshot memakai template undangan saat ini.',
      },
      data: templates.map((template) => {
        const invitationMetric = invitationsByTemplate.get(template.id);
        const paidMetric = paidByTemplate.get(template.id);
        const freeMetric = freeByTemplate.get(template.id);
        return {
          templateId: template.id,
          name: template.name,
          slug: template.slug,
          isPublished: template.isPublished,
          invitationCount: invitationMetric?.count || 0,
          publishedCount: invitationMetric?.publishedCount || 0,
          paidCount: paidMetric?.count || 0,
          freeCount: freeMetric?.count || 0,
          grossAmount: paidMetric?.grossAmount || 0,
        };
      }),
    };
  }

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

    const resolvedFilters = await this.resolveTemplateCategoryFilter(filters);
    where = this.applyFilters(where, resolvedFilters);

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

  private isUuid(value: string) {
    return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
  }

  private async resolveTemplateCategoryFilter(filtersStr?: string) {
    if (!filtersStr) return filtersStr;
    try {
      const filters = JSON.parse(filtersStr);
      const categoryName = filters?.category;
      if (typeof categoryName !== 'string' || this.isUuid(categoryName)) {
        return filtersStr;
      }
      const normalizedName = categoryName
        .normalize('NFKC')
        .trim()
        .replace(/\s+/gu, ' ');
      const category = await this.categoryRepo
        .createQueryBuilder('category')
        .where('LOWER(TRIM(category.name)) = LOWER(:name)', {
          name: normalizedName,
        })
        .orWhere('JSON_CONTAINS(category.aliases, :nameJson)', {
          nameJson: JSON.stringify(normalizedName),
        })
        .getOne();
      if (category) filters.category = category.id;
      return JSON.stringify(filters);
    } catch {
      return filtersStr;
    }
  }

  async getTemplateDesign(id: number) {
    const template = await this.templateDesignRepo.findOne({
      where: { id },
      relations: ['category', 'palette', 'sections', 'sections.section'],
    });
    if (!template) throw new NotFoundException('Template design not found');
    return this.transformTemplateDesign(template);
  }

  async getTemplateDesignRevisions(id: number) {
    const template = await this.templateDesignRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template design not found');
    const [revisions, invitationCount] = await Promise.all([
      this.templateDesignRevisionRepo.find({
        where: { templateId: id },
        order: { version: 'DESC' },
      }),
      this.invitationRepo.count({ where: { templateDesign: { id } } }),
    ]);
    return {
      templateId: id,
      currentInvitationCount: invitationCount,
      revisions: revisions.map(({ id: revisionId, version, templateName, createdAt, actorEmail }) => ({
        id: revisionId,
        version,
        templateName,
        createdAt,
        actorEmail,
      })),
    };
  }

  async rollbackTemplateDesignRevision(
    id: number,
    revisionId: string,
    actor?: { id?: number; email?: string },
  ) {
    const revision = await this.templateDesignRevisionRepo.findOne({
      where: { id: revisionId, templateId: id },
    });
    if (!revision) throw new NotFoundException('Template revision not found');
    return this.updateTemplateDesign(
      id,
      revision.snapshot as UpdateTemplateDesignDto,
      actor,
    );
  }

  private async saveTemplateDesignRevisionBeforeUpdate(
    template: TemplateDesign,
    actor?: { id?: number; email?: string },
  ) {
    const latest = await this.templateDesignRevisionRepo.findOne({
      where: { templateId: template.id },
      order: { version: 'DESC' },
    });
    const revision = this.templateDesignRevisionRepo.create({
      templateId: template.id,
      templateName: template.name,
      version: (latest?.version || 0) + 1,
      snapshot: {
        name: template.name,
        slug: template.slug,
        componentKey: template.componentKey,
        previewUrl: template.previewUrl,
        thumbnailUrl: template.thumbnailUrl,
        isActive: template.isPublished,
        category: template.category?.name || null,
        price: Number(template.price),
        paletteId: template.palette?.id || null,
        paletteColors: template.paletteColors || [],
        description: template.description,
        seoTitle: template.seoTitle,
        seoDescription: template.seoDescription,
        tags: template.tags,
        filterGroup: template.filterGroup,
        sectionOptions: template.sectionOptions,
        sampleContent: template.sampleContent,
        designConfig: template.designConfig,
        defaultMusic: template.defaultMusic,
        defaultAudioStart: template.defaultAudioStart,
        defaultAudioEnd: template.defaultAudioEnd,
        sections: (template.sections || []).map((section) => ({
          sectionId: section.section.id,
          order: section.order,
          is_enabled: section.is_enabled,
        })),
      },
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
    });
    await this.templateDesignRevisionRepo.save(revision);
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

  async updateTemplateDesign(
    id: number,
    payload: UpdateTemplateDesignDto,
    actor?: { id?: number; email?: string },
  ) {
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

      let nextCategory: Category | null | undefined;
      if (categoryName !== undefined) {
        if (categoryName === null) {
          nextCategory = null;
        } else {
          const found = await this.categoryRepo.findOne({
            where: { name: categoryName },
          });
          if (!found)
            throw new BadRequestException(
              `Category '${categoryName}' not found`,
            );
          nextCategory = found;
        }
      }

      let nextPalette: PaletteColor | null | undefined;
      if (paletteId !== undefined) {
        if (paletteId === null) {
          nextPalette = null;
        } else if (paletteId) {
          const foundPalette = await this.paletteColorRepo.findOne({
            where: { id: paletteId },
          });
          if (foundPalette) nextPalette = foundPalette;
        }
      }

      await this.saveTemplateDesignRevisionBeforeUpdate(template, actor);

      if (nextCategory !== undefined) template.category = nextCategory;
      if (nextPalette !== undefined) template.palette = nextPalette;

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

    const links = sections.length
      ? await this.templateDesignSectionRepo.find({
          where: {
            section: { id: In(sections.map((section) => section.id)) },
            is_enabled: true,
          },
          relations: ['section', 'templateDesign'],
        })
      : [];
    const rendererCoverageBySection = new Map<
      string,
      Map<string, { templateCount: number; publishedTemplateCount: number }>
    >();
    for (const link of links) {
      const template = link.templateDesign;
      const sectionId = link.section?.id;
      const renderer = template?.componentKey?.trim() || template?.slug?.trim();
      if (!sectionId || !renderer) continue;
      const coverage = rendererCoverageBySection.get(sectionId) || new Map();
      const rendererCounts = coverage.get(renderer) || {
        templateCount: 0,
        publishedTemplateCount: 0,
      };
      rendererCounts.templateCount += 1;
      if (template.isPublished) rendererCounts.publishedTemplateCount += 1;
      coverage.set(renderer, rendererCounts);
      rendererCoverageBySection.set(sectionId, coverage);
    }

    console.log(
      `[DEBUG] listSections found ${sections.length} items. Raw first item:`,
      sections[0],
    );

    return Promise.all(
      sections.map(async (s) => {
        const raw = s as any;
        const isActive = s.is_active ?? raw.is_published ?? true;
        const [templateUseCount, enabledTemplateUseCount, samplePreviewSection] = await Promise.all([
          this.templateDesignSectionRepo.count({
            where: { section: { id: s.id } },
          }),
          this.templateDesignSectionRepo.count({
            where: { section: { id: s.id }, is_enabled: true },
          }),
          this.templateDesignSectionRepo
            .createQueryBuilder('templateSection')
            .innerJoinAndSelect('templateSection.templateDesign', 'template')
            .innerJoin('templateSection.section', 'section')
            .where('section.id = :sectionId', { sectionId: s.id })
            .andWhere('templateSection.is_enabled = :enabled', { enabled: true })
            .andWhere('template.isPublished = :published', { published: true })
            .andWhere('template.previewUrl IS NOT NULL')
            .andWhere("template.previewUrl <> ''")
            .orderBy('template.name', 'ASC')
            .getOne(),
        ]);
        const sampleTemplate = samplePreviewSection?.templateDesign;
        return {
          id: s.id,
          label: s.label,
          key: s.key,
          is_active: isActive,
          templateUseCount,
          enabledTemplateUseCount,
          rendererCoverage: Array.from(
            rendererCoverageBySection.get(s.id)?.entries() || [],
          ).map(([renderer, counts]) => ({
            renderer,
            ...counts,
            packageSupport: 'tier-neutral',
          })),
          samplePreviewTemplate: sampleTemplate
            ? {
                id: sampleTemplate.id,
                name: sampleTemplate.name,
                slug: sampleTemplate.slug,
                componentKey: sampleTemplate.componentKey,
              }
            : null,
        };
      }),
    );
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
    const templateUseCount = await this.templateDesignSectionRepo.count({
      where: { section: { id } },
    });
    if (templateUseCount > 0) {
      throw new BadRequestException(
        `Section masih direferensikan oleh ${templateUseCount} template. Nonaktifkan atau lepaskan dari template terlebih dahulu.`,
      );
    }
    await this.sectionRepo.remove(section);
    return { success: true };
  }

  // Audio
  private audioContentSha256(file: Express.Multer.File): string {
    if (!Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Isi file audio tidak dapat dibaca.');
    }
    return createHash('sha256').update(file.buffer).digest('hex');
  }

  async listAudio(q?: string) {
    const where = q ? { title: ILike(`%${q}%`) } : undefined;
    const tracks = await this.audioRepo.find({
      where,
      order: { title: 'ASC' },
    });
    const allTracks = await this.audioRepo.find({
      select: { url: true, contentSha256: true },
    });
    const urlUseCount = allTracks.reduce((counts, track) => {
      if (track.url) counts.set(track.url, (counts.get(track.url) || 0) + 1);
      return counts;
    }, new Map<string, number>());
    const contentUseCount = allTracks.reduce((counts, track) => {
      if (track.contentSha256) {
        counts.set(track.contentSha256, (counts.get(track.contentSha256) || 0) + 1);
      }
      return counts;
    }, new Map<string, number>());
    return Promise.all(
      tracks.map(async (track) => {
        const [templateUseCount, invitationUseCount] = await Promise.all([
          this.templateDesignRepo.count({ where: { defaultMusic: track.url } }),
          this.invitationRepo.count({ where: { musicChoice: track.url } }),
        ]);
        return {
          ...track,
          templateUseCount,
          invitationUseCount,
          sameUrlTrackCount: track.url ? urlUseCount.get(track.url) || 1 : 0,
          sameContentTrackCount: track.contentSha256
            ? contentUseCount.get(track.contentSha256) || 1
            : null,
          contentHashStatus: track.contentSha256 ? 'checked' : 'unknown',
          sourceStatus: track.source?.trim() ? 'recorded' : 'unknown',
          licenseStatus: track.licenseStatus || 'unknown',
          durationStatus:
            track.durationSeconds !== null &&
            Number.isInteger(track.durationSeconds) &&
            track.durationSeconds >= 0
              ? 'recorded'
              : 'unknown',
          usageMatch:
            'Exact URL match only; filename and historical URL aliases are not inferred.',
        };
      }),
    );
  }

  async createAudio(payload: Partial<Audio>) {
    const audio = this.audioRepo.create({
      ...payload,
      licenseStatus: payload.licenseStatus || 'unknown',
    });
    return this.audioRepo.save(audio);
  }

  async updateAudioMetadata(id: string, payload: UpdateAudioMetadataDto) {
    const audio = await this.audioRepo.findOne({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    if (payload.source !== undefined) audio.source = payload.source?.trim() || null;
    if (payload.credit !== undefined) audio.credit = payload.credit?.trim() || null;
    if (payload.licenseStatus !== undefined) audio.licenseStatus = payload.licenseStatus;
    return this.audioRepo.save(audio);
  }

  async replaceAudio(
    id: string,
    file: Express.Multer.File,
    payload: UploadAudioMetadataDto,
  ) {
    const audio = await this.audioRepo.findOne({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    const upload = await this.uploadService.uploadFile(file);

    try {
      return await this.audioRepo.manager.transaction(async (manager) => {
        const currentAudio = await manager.findOne(Audio, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!currentAudio) throw new NotFoundException('Audio not found');
        const previousUrl = currentAudio.url;
        const templateResult = await manager.update(
          TemplateDesign,
          { defaultMusic: previousUrl },
          { defaultMusic: upload.fileUrl },
        );
        const invitationResult = await manager.update(
          Invitation,
          { musicChoice: previousUrl },
          { musicChoice: upload.fileUrl },
        );

        currentAudio.url = upload.fileUrl;
        currentAudio.format = file.mimetype || null;
        currentAudio.fileSizeBytes = Number.isFinite(file.size) ? file.size : null;
        currentAudio.contentSha256 = this.audioContentSha256(file);
        currentAudio.durationSeconds =
          typeof payload.durationSeconds === 'number' &&
          Number.isInteger(payload.durationSeconds) &&
          payload.durationSeconds >= 0
            ? payload.durationSeconds
            : null;
        if (payload.source !== undefined) currentAudio.source = payload.source.trim() || null;
        if (payload.credit !== undefined) currentAudio.credit = payload.credit.trim() || null;
        if (payload.licenseStatus !== undefined) currentAudio.licenseStatus = payload.licenseStatus;
        await manager.save(Audio, currentAudio);

        return {
          success: true,
          templateReferencesUpdated: templateResult.affected || 0,
          invitationReferencesUpdated: invitationResult.affected || 0,
          previousFileRetained: true,
        };
      });
    } catch (error) {
      try {
        await this.uploadService.deleteFile(upload.fileUrl);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up replacement audio after transaction failure: ${upload.fileUrl}`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
      throw error;
    }
  }

  async uploadAudio(
    file: Express.Multer.File,
    payload: UploadAudioMetadataDto,
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
      format: file.mimetype || null,
      fileSizeBytes: Number.isFinite(file.size) ? file.size : null,
      contentSha256: this.audioContentSha256(file),
      durationSeconds:
        typeof payload.durationSeconds === 'number' &&
        Number.isInteger(payload.durationSeconds) &&
        payload.durationSeconds >= 0
          ? payload.durationSeconds
          : null,
      source: payload.source?.trim() || null,
      credit: payload.credit?.trim() || null,
      licenseStatus: payload.licenseStatus || 'unknown',
    });

    return this.audioRepo.save(audio);
  }

  async deleteAudio(id: string) {
    const audio = await this.audioRepo.findOne({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    const [templateUseCount, invitationUseCount] = await Promise.all([
      this.templateDesignRepo.count({ where: { defaultMusic: audio.url } }),
      this.invitationRepo.count({ where: { musicChoice: audio.url } }),
    ]);
    if (templateUseCount > 0 || invitationUseCount > 0) {
      throw new BadRequestException(
        `Audio masih digunakan oleh ${templateUseCount} template dan ${invitationUseCount} undangan. Ganti referensi sebelum menghapus.`,
      );
    }
    await this.audioRepo.remove(audio);
    return { success: true };
  }

  // Banks
  async listBanks(q?: string) {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { code: ILike(`%${q}%`) }]
      : undefined;
    const [banks, allCodes] = await Promise.all([
      this.bankRepo.find({ where, order: { name: 'ASC' } }),
      this.bankRepo.find({ select: { code: true } }),
    ]);
    const codeUseCount = allCodes.reduce((counts, bank) => {
      const normalizedCode = bank.code?.trim().toLocaleLowerCase();
      if (normalizedCode) {
        counts.set(normalizedCode, (counts.get(normalizedCode) || 0) + 1);
      }
      return counts;
    }, new Map<string, number>());
    return Promise.all(
      banks.map(async (bank) => {
        const [bankAccountResult, walletResult] = await Promise.all([
          this.invitationRepo
            .createQueryBuilder('invitation')
            .select('COUNT(DISTINCT invitation.id)', 'count')
            .where(
              "JSON_SEARCH(invitation.bankAccounts, 'one', :name, NULL, '$[*].bankName') IS NOT NULL",
              { name: bank.name },
            )
            .getRawOne(),
          this.invitationRepo
            .createQueryBuilder('invitation')
            .select('COUNT(DISTINCT invitation.id)', 'count')
            .where(
              "JSON_SEARCH(invitation.eWalletLink, 'one', :name, NULL, '$[*].wallet_provider') IS NOT NULL",
              { name: bank.name },
            )
            .getRawOne(),
        ]);
        return {
          ...bank,
          bankAccountUseCount: Number(bankAccountResult?.count || 0),
          walletUseCount: Number(walletResult?.count || 0),
          duplicateCodeCount: bank.code?.trim()
            ? codeUseCount.get(bank.code.trim().toLocaleLowerCase()) || 1
            : 0,
          usageMatch:
            'Exact current name match in invitation snapshots; aliases are not inferred.',
        };
      }),
    );
  }

  async createBank(payload: Partial<Bank>) {
    const bank = this.bankRepo.create({
      ...payload,
      name: payload.name?.trim(),
      code: payload.code?.trim(),
      isActive: payload.isActive ?? true,
    });
    return this.bankRepo.save(bank);
  }

  async updateBank(id: string, payload: Partial<Bank>) {
    const bank = await this.bankRepo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Bank not found');
    Object.assign(bank, payload, {
      name: payload.name?.trim() ?? bank.name,
      code: payload.code?.trim() ?? bank.code,
      isActive: payload.isActive ?? bank.isActive,
    });
    return this.bankRepo.save(bank);
  }

  async deleteBank(id: string) {
    const bank = await this.bankRepo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Bank not found');
    const [bankAccountResult, walletResult] = await Promise.all([
      this.invitationRepo
        .createQueryBuilder('invitation')
        .select('COUNT(DISTINCT invitation.id)', 'count')
        .where(
          "JSON_SEARCH(invitation.bankAccounts, 'one', :name, NULL, '$[*].bankName') IS NOT NULL",
          { name: bank.name },
        )
        .getRawOne(),
      this.invitationRepo
        .createQueryBuilder('invitation')
        .select('COUNT(DISTINCT invitation.id)', 'count')
        .where(
          "JSON_SEARCH(invitation.eWalletLink, 'one', :name, NULL, '$[*].wallet_provider') IS NOT NULL",
          { name: bank.name },
        )
        .getRawOne(),
    ]);
    const usageCount =
      Number(bankAccountResult?.count || 0) + Number(walletResult?.count || 0);
    if (usageCount > 0) {
      throw new BadRequestException(
        `Master masih dipakai pada ${Number(bankAccountResult?.count || 0)} snapshot rekening dan ${Number(walletResult?.count || 0)} snapshot e-wallet. Perbarui referensi dahulu sebelum menghapus.`,
      );
    }
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
    const usageRows = data.length
      ? await this.templateDesignRepo
          .createQueryBuilder('template')
          .select('palette.id', 'paletteId')
          .addSelect('COUNT(template.id)', 'templateUseCount')
          .innerJoin('template.palette', 'palette')
          .where('palette.id IN (:...paletteIds)', {
            paletteIds: data.map((palette) => palette.id),
          })
          .groupBy('palette.id')
          .getRawMany()
      : [];
    const usageByPalette = new Map(
      usageRows.map((row) => [row.paletteId, Number(row.templateUseCount || 0)]),
    );
    const dataWithUsage = data.map((palette) => ({
      ...palette,
      templateUseCount: usageByPalette.get(palette.id) || 0,
    }));
    return { data: dataWithUsage, total, page, limit };
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
    const templateUseCount = await this.templateDesignRepo.count({
      where: { palette: { id } },
    });
    if (templateUseCount > 0) {
      throw new BadRequestException(
        `Palet masih dipakai oleh ${templateUseCount} template. Lepaskan palet dari template terlebih dahulu sebelum menghapus master ini.`,
      );
    }
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
      throw new BadRequestException(
        'Pengguna ini bukan admin. Jadikan admin lebih dulu.',
      );
    }
    if (
      resolveAdminRole(target) === 'superadmin' &&
      adminRole !== 'superadmin'
    ) {
      const admins = await this.userRepo.find({
        where: { isAdmin: true },
        select: { id: true, isAdmin: true, adminRole: true },
      });
      const otherSuperadmins = admins.filter(
        (admin) => admin.id !== id && resolveAdminRole(admin) === 'superadmin',
      );
      if (!otherSuperadmins.length) {
        throw new BadRequestException(
          'Minimal satu superadmin harus tetap ada.',
        );
      }
    }
    target.adminRole = adminRole;
    await this.userRepo.save(target);
    return { id, adminRole, changedById: actorId };
  }

  private resolveDashboardDateRange(
    range = '7d',
    customStart?: string,
    customEnd?: string,
  ) {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowUtcMs = Date.now();
    const nowWib = new Date(nowUtcMs + WIB_OFFSET_MS);

    const year = nowWib.getUTCFullYear();
    const month = nowWib.getUTCMonth();
    const date = nowWib.getUTCDate();

    // End of today in WIB (23:59:59.999 WIB -> UTC)
    const todayEndWibUtc = new Date(
      Date.UTC(year, month, date, 23, 59, 59, 999) - WIB_OFFSET_MS,
    );

    let startDate: Date;
    let endDate: Date = todayEndWibUtc;
    let previousStartDate: Date | null = null;
    let previousEndDate: Date | null = null;
    let rangeKey = (range || '7d').toLowerCase();
    let rangeLabel = '7 Hari Terakhir';
    let daysCount = 7;

    if (customStart && customEnd) {
      rangeKey = 'custom';
      rangeLabel = `${customStart} s/d ${customEnd}`;
      const [sy, sm, sd] = customStart.split('-').map(Number);
      const [ey, em, ed] = customEnd.split('-').map(Number);
      startDate = new Date(
        Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
      endDate = new Date(
        Date.UTC(ey, em - 1, ed, 23, 59, 59, 999) - WIB_OFFSET_MS,
      );
      daysCount = Math.max(
        1,
        Math.round(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
        ),
      );
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(
        previousEndDate.getTime() - daysCount * 24 * 60 * 60 * 1000 + 1,
      );
    } else if (rangeKey === '30d') {
      daysCount = 30;
      rangeLabel = '30 Hari Terakhir';
      startDate = new Date(
        Date.UTC(year, month, date - 29, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(
        previousEndDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1,
      );
    } else if (rangeKey === '90d') {
      daysCount = 90;
      rangeLabel = '90 Hari Terakhir';
      startDate = new Date(
        Date.UTC(year, month, date - 89, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(
        previousEndDate.getTime() - 90 * 24 * 60 * 60 * 1000 + 1,
      );
    } else if (rangeKey === 'month') {
      rangeLabel = 'Bulan Ini';
      startDate = new Date(
        Date.UTC(year, month, 1, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
      daysCount = date;
      const prevMonthLastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
      previousEndDate = new Date(
        Date.UTC(year, month - 1, prevMonthLastDate, 23, 59, 59, 999) -
          WIB_OFFSET_MS,
      );
      previousStartDate = new Date(
        Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
    } else if (rangeKey === 'all') {
      rangeLabel = 'Semua Waktu';
      startDate = new Date(0);
      daysCount = 365;
      previousStartDate = null;
      previousEndDate = null;
    } else {
      // Default 7d
      rangeKey = '7d';
      daysCount = 7;
      rangeLabel = '7 Hari Terakhir';
      startDate = new Date(
        Date.UTC(year, month, date - 6, 0, 0, 0, 0) - WIB_OFFSET_MS,
      );
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(
        previousEndDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1,
      );
    }

    return {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      rangeKey,
      rangeLabel,
      daysCount,
    };
  }

  async getDashboardStats(query?: DashboardStatsQueryDto) {
    const range = this.resolveDashboardDateRange(
      query?.range,
      query?.startDate,
      query?.endDate,
    );

    // 1. Category Distribution over all invitations in database
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

    // 2. Daily Registration & Revenue Trends
    let rawInvTrend: any[] = [];
    if (typeof this.invitationRepo?.createQueryBuilder === 'function') {
      try {
        rawInvTrend = await this.invitationRepo
          .createQueryBuilder('inv')
          .select("DATE_FORMAT(inv.createdAt, '%Y-%m-%d')", 'date')
          .addSelect('COUNT(inv.id)', 'count')
          .where('inv.createdAt >= :startDate', { startDate: range.startDate })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany();
      } catch {
        rawInvTrend = [];
      }
    }

    let rawPayTrend: any[] = [];
    if (typeof this.paymentRepo?.createQueryBuilder === 'function') {
      try {
        rawPayTrend = await this.paymentRepo
          .createQueryBuilder('p')
          .select("DATE_FORMAT(p.createdAt, '%Y-%m-%d')", 'date')
          .addSelect(
            "COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0)",
            'revenue',
          )
          .addSelect(
            "COUNT(CASE WHEN p.status = 'success' THEN 1 END)",
            'orders',
          )
          .where('p.createdAt >= :startDate AND p.createdAt <= :endDate', {
            startDate: range.startDate,
            endDate: range.endDate,
          })
          .groupBy('date')
          .getRawMany();
      } catch {
        rawPayTrend = [];
      }
    }

    const payTrendMap = new Map<string, { revenue: number; orders: number }>();
    if (Array.isArray(rawPayTrend)) {
      for (const row of rawPayTrend) {
        if (row?.date) {
          payTrendMap.set(String(row.date), {
            revenue: Number(row.revenue) || 0,
            orders: Number(row.orders) || 0,
          });
        }
      }
    }

    const invTrendMap = new Map<string, number>();
    if (Array.isArray(rawInvTrend)) {
      for (const row of rawInvTrend) {
        if (row?.date) {
          invTrendMap.set(String(row.date), Number(row.count) || 0);
        }
      }
    }

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agt',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];

    const trendStats: {
      date: string;
      dayLabel: string;
      count: number;
      revenue: number;
      orders: number;
    }[] = [];

    const daysCount = range.daysCount;
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      let dayLabel = `H-${i}`;
      if (i === 0) dayLabel = 'Hari Ini';
      else if (i === 1) dayLabel = 'Kemarin';
      else if (daysCount > 7) {
        dayLabel = `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;
      }

      const invCount = invTrendMap.get(dateStr) || 0;
      const payData = payTrendMap.get(dateStr) || { revenue: 0, orders: 0 };

      trendStats.push({
        date: dateStr,
        dayLabel,
        count: invCount,
        revenue: payData.revenue,
        orders: payData.orders,
      });
    }

    // 3. Current Period Financial & Order Metrics
    let grossRevenue = 0;
    let discountTotal = 0;
    let paidOrders = 0;
    let pendingOrders = 0;
    let failedOrders = 0;
    let uniqueBuyers = 0;

    if (typeof this.paymentRepo?.createQueryBuilder === 'function') {
      try {
        const rawMetrics = await this.paymentRepo
          .createQueryBuilder('p')
          .select(
            "COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0)",
            'grossRevenue',
          )
          .addSelect(
            "COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.discountAmount ELSE 0 END), 0)",
            'discountTotal',
          )
          .addSelect(
            "COUNT(CASE WHEN p.status = 'success' THEN 1 END)",
            'paidOrders',
          )
          .addSelect(
            "COUNT(CASE WHEN p.status = 'pending' THEN 1 END)",
            'pendingOrders',
          )
          .addSelect(
            "COUNT(CASE WHEN p.status IN ('failed', 'expired') THEN 1 END)",
            'failedOrders',
          )
          .addSelect(
            "COUNT(DISTINCT CASE WHEN p.status = 'success' THEN p.email END)",
            'uniqueBuyers',
          )
          .where('p.createdAt >= :startDate AND p.createdAt <= :endDate', {
            startDate: range.startDate,
            endDate: range.endDate,
          })
          .getRawOne();

        if (rawMetrics) {
          grossRevenue = Number(rawMetrics.grossRevenue) || 0;
          discountTotal = Number(rawMetrics.discountTotal) || 0;
          paidOrders = Number(rawMetrics.paidOrders) || 0;
          pendingOrders = Number(rawMetrics.pendingOrders) || 0;
          failedOrders = Number(rawMetrics.failedOrders) || 0;
          uniqueBuyers = Number(rawMetrics.uniqueBuyers) || 0;
        }
      } catch {
        // Fallback safe values
      }
    }

    // 4. Previous Period Comparison Metrics
    let prevGrossRevenue = 0;
    let prevPaidOrders = 0;
    let prevUniqueBuyers = 0;

    if (
      range.previousStartDate &&
      typeof this.paymentRepo?.createQueryBuilder === 'function'
    ) {
      try {
        const prevMetrics = await this.paymentRepo
          .createQueryBuilder('p')
          .select(
            "COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0)",
            'grossRevenue',
          )
          .addSelect(
            "COUNT(CASE WHEN p.status = 'success' THEN 1 END)",
            'paidOrders',
          )
          .addSelect(
            "COUNT(DISTINCT CASE WHEN p.status = 'success' THEN p.email END)",
            'uniqueBuyers',
          )
          .where('p.createdAt >= :prevStart AND p.createdAt <= :prevEnd', {
            prevStart: range.previousStartDate,
            prevEnd: range.previousEndDate,
          })
          .getRawOne();

        if (prevMetrics) {
          prevGrossRevenue = Number(prevMetrics.grossRevenue) || 0;
          prevPaidOrders = Number(prevMetrics.paidOrders) || 0;
          prevUniqueBuyers = Number(prevMetrics.uniqueBuyers) || 0;
        }
      } catch {
        // Fallback safe values
      }
    }

    // 5. Invitations breakdown (Paid vs Free)
    let totalInvitations = 0;
    let paidInvitations = 0;
    let prevTotalInvitations = 0;

    if (typeof this.invitationRepo?.createQueryBuilder === 'function') {
      try {
        const invRaw = await this.invitationRepo
          .createQueryBuilder('inv')
          .select('COUNT(inv.id)', 'total')
          .where('inv.createdAt >= :startDate AND inv.createdAt <= :endDate', {
            startDate: range.startDate,
            endDate: range.endDate,
          })
          .getRawOne();
        totalInvitations = Number(invRaw?.total) || 0;

        if (typeof this.paymentRepo?.createQueryBuilder === 'function') {
          const paidInvRaw = await this.paymentRepo
            .createQueryBuilder('p')
            .select('COUNT(DISTINCT p.invitationId)', 'total')
            .where(
              "p.status = 'success' AND p.amount > 0 AND p.invitationId IS NOT NULL",
            )
            .andWhere('p.createdAt >= :startDate AND p.createdAt <= :endDate', {
              startDate: range.startDate,
              endDate: range.endDate,
            })
            .getRawOne();
          paidInvitations = Number(paidInvRaw?.total) || 0;
        }

        if (range.previousStartDate) {
          const prevInvRaw = await this.invitationRepo
            .createQueryBuilder('inv')
            .select('COUNT(inv.id)', 'total')
            .where(
              'inv.createdAt >= :prevStart AND inv.createdAt <= :prevEnd',
              {
                prevStart: range.previousStartDate,
                prevEnd: range.previousEndDate,
              },
            )
            .getRawOne();
          prevTotalInvitations = Number(prevInvRaw?.total) || 0;
        }
      } catch {
        // Fallback
      }
    }

    const calcGrowth = (curr: number, prev: number): number | null => {
      if (prev === 0) {
        return curr > 0 ? 100 : 0;
      }
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // 6. Actionable Queue
    const actionableItems: Array<{
      type: string;
      severity: 'danger' | 'warning' | 'info';
      title: string;
      count: number;
      description: string;
      link: string;
      actionLabel: string;
    }> = [];

    try {
      const reconQueue = await this.getReconciliationQueue();
      if (reconQueue && reconQueue.items && reconQueue.items.length > 0) {
        const byType: Record<string, any[]> = {};
        for (const item of reconQueue.items) {
          const t = item.type || 'UNKNOWN';
          if (!byType[t]) byType[t] = [];
          byType[t].push(item);
        }

        if (byType['SUCCESS_NOT_PUBLISHED']?.length) {
          actionableItems.push({
            type: 'SUCCESS_NOT_PUBLISHED',
            severity: 'danger',
            title: 'Pembayaran Lunas Tapi Belum Terbit',
            count: byType['SUCCESS_NOT_PUBLISHED'].length,
            description:
              'Customer telah membayar namun undangan belum berstatus publikasi',
            link: '/admin/payments?tab=reconciliation',
            actionLabel: 'Rekonsiliasi Sekarang',
          });
        }

        if (byType['PENDING_AGING']?.length) {
          actionableItems.push({
            type: 'PENDING_AGING',
            severity: 'warning',
            title: 'Transaksi Pending Menggantung (> 24 Jam)',
            count: byType['PENDING_AGING'].length,
            description:
              'Pembayaran belum tuntas atau notifikasi webhook Midtrans belum tersinkron',
            link: '/admin/payments?status=pending',
            actionLabel: 'Periksa Transaksi',
          });
        }

        if (byType['COMMISSION_PENDING']?.length) {
          actionableItems.push({
            type: 'COMMISSION_PENDING',
            severity: 'info',
            title: 'Komisi Referral Belum Dikreditkan',
            count: byType['COMMISSION_PENDING'].length,
            description:
              'Transaksi referral sukses tapi saldo komisi afiliasi belum dicatat',
            link: '/admin/payments?tab=reconciliation',
            actionLabel: 'Kreditkan Saldo',
          });
        }

        if (byType['PUBLISHED_UNPAID']?.length) {
          actionableItems.push({
            type: 'PUBLISHED_UNPAID',
            severity: 'warning',
            title: 'Undangan Aktif Tanpa Catatan Bayar',
            count: byType['PUBLISHED_UNPAID'].length,
            description:
              'Undangan berstatus publikasi aktif namun riwayat pembayaran lunas tidak ditemukan',
            link: '/admin/invitations',
            actionLabel: 'Audit Undangan',
          });
        }
      }
    } catch {
      // Graceful fallback
    }

    return {
      categories: categoryStats,
      trend: trendStats,
      kpi: {
        revenue: {
          value: grossRevenue,
          discount: discountTotal,
          net: grossRevenue,
          previous: prevGrossRevenue,
          growth: calcGrowth(grossRevenue, prevGrossRevenue),
        },
        paidOrders: {
          value: paidOrders,
          previous: prevPaidOrders,
          growth: calcGrowth(paidOrders, prevPaidOrders),
        },
        pendingOrders: {
          value: pendingOrders,
          failed: failedOrders,
        },
        uniqueBuyers: {
          value: uniqueBuyers,
          previous: prevUniqueBuyers,
          growth: calcGrowth(uniqueBuyers, prevUniqueBuyers),
        },
        aov: {
          value: paidOrders > 0 ? Math.round(grossRevenue / paidOrders) : 0,
          previous:
            prevPaidOrders > 0
              ? Math.round(prevGrossRevenue / prevPaidOrders)
              : 0,
          growth: calcGrowth(
            paidOrders > 0 ? Math.round(grossRevenue / paidOrders) : 0,
            prevPaidOrders > 0
              ? Math.round(prevGrossRevenue / prevPaidOrders)
              : 0,
          ),
        },
        invitations: {
          total: totalInvitations,
          paid: paidInvitations,
          free: Math.max(0, totalInvitations - paidInvitations),
          previous: prevTotalInvitations,
          growth: calcGrowth(totalInvitations, prevTotalInvitations),
        },
      },
      actionRequired: {
        count: actionableItems.reduce((acc, it) => acc + it.count, 0),
        items: actionableItems,
      },
      dateRange: {
        key: range.rangeKey,
        label: range.rangeLabel,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        timezone: 'Asia/Jakarta (WIB)',
      },
      lastUpdated: new Date().toISOString(),
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
