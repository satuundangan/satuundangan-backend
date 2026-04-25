import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { customAlphabet } from 'nanoid';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { CommissionTransaction } from './entities/commission-transaction.entity';
import { WithdrawRequest } from './entities/withdraw-request.entity';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { Payment } from '../payment/payment.entity';
import { AffiliateTier, AffiliateStatus, CommissionStatus, WithdrawStatus } from './types/affiliate.type';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';

// Human-readable, no-look-alikes alphabet (no 0/O/1/I/L)
const codeAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generateCode = customAlphabet(codeAlphabet, 8);

export interface ValidateAffiliateCodeResult {
  valid: boolean;
  message?: string;
  affiliateProfileId?: number;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(AffiliateProfile)
    private readonly profileRepo: Repository<AffiliateProfile>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionRepo: Repository<CommissionTransaction>,
    @InjectRepository(WithdrawRequest)
    private readonly withdrawRepo: Repository<WithdrawRequest>,
    @InjectRepository(TierConfig)
    private readonly tierConfigRepo: Repository<TierConfig>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepo: Repository<SystemConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async register(userId: number, dto: RegisterAffiliateDto): Promise<AffiliateProfile> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('User is already registered as a reseller');
    }
    // Generate code, retry on extremely rare collision
    let affiliateCode = generateCode();
    for (let attempts = 0; attempts < 5; attempts++) {
      const clash = await this.profileRepo.findOne({ where: { affiliateCode } });
      if (!clash) break;
      affiliateCode = generateCode();
    }
    const profile = this.profileRepo.create({
      userId,
      affiliateCode,
      tier: AffiliateTier.BRONZE,
      status: AffiliateStatus.ACTIVE,
      commissionBalance: 0,
      totalEarned: 0,
      totalSales: 0,
      totalSalesAmount: 0,
      bankName: dto.bankName.trim(),
      bankAccountNumber: dto.bankAccountNumber.trim(),
      bankAccountName: dto.bankAccountName.trim(),
      whatsappNumber: dto.whatsappNumber.trim(),
    });
    const saved = await this.profileRepo.save(profile);
    this.logger.log(`Affiliate registered userId=${userId} code=${saved.affiliateCode}`);
    return saved;
  }

  async validateAffiliateCode(code: string): Promise<ValidateAffiliateCodeResult> {
    const normalized = code.trim().toUpperCase();
    const profile = await this.profileRepo.findOne({ where: { affiliateCode: normalized } });
    if (!profile) {
      return { valid: false, message: 'Kode afiliasi tidak ditemukan' };
    }
    if (profile.status !== AffiliateStatus.ACTIVE) {
      return { valid: false, message: 'Kode afiliasi tidak aktif' };
    }
    return { valid: true, affiliateProfileId: profile.id };
  }

  /**
   * Idempotent + transactional commission credit.
   * MUST be called from inside a parent transaction; the caller passes its EntityManager.
   *
   * Idempotency strategy (COM-03):
   *  1. Pessimistic write lock on Payment row, re-check commissionCredited flag
   *  2. UNIQUE(paymentId) on CommissionTransaction is the database backstop
   *  3. Payment.commissionCredited = true is set atomically in same transaction
   */
  async creditCommission(
    paymentId: number,
    manager: EntityManager,
  ): Promise<CommissionTransaction | null> {
    const paymentRepo = manager.getRepository(Payment);
    const profileRepo = manager.getRepository(AffiliateProfile);
    const commissionRepo = manager.getRepository(CommissionTransaction);
    const tierRepo = manager.getRepository(TierConfig);

    // Step 1: pessimistic write-lock the Payment row
    const payment = await paymentRepo.findOne({
      where: { id: paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (!payment.affiliateProfileId) {
      this.logger.log(`Skip commission paymentId=${paymentId}: no affiliateProfileId`);
      return null;
    }
    if (payment.commissionCredited) {
      this.logger.log(`Skip commission paymentId=${paymentId}: already credited (idempotency)`);
      return null;
    }

    // Step 2: load profile (no lock needed — atomic UPDATE will be used)
    const profile = await profileRepo.findOne({
      where: { id: payment.affiliateProfileId },
    });
    if (!profile) {
      throw new NotFoundException(`AffiliateProfile ${payment.affiliateProfileId} not found`);
    }
    if (profile.status !== AffiliateStatus.ACTIVE) {
      this.logger.warn(`Skip commission paymentId=${paymentId}: reseller status=${profile.status}`);
      // Still mark credited=true so we don't keep trying on retries
      await paymentRepo.update({ id: paymentId }, { commissionCredited: true });
      return null;
    }

    // Step 3: self-referral guard (D-08, COM-07)
    // Reload payment with invitation relation to access invitation.user.id
    const paymentFull = await paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['invitation', 'invitation.user'],
    });
    const buyerUserId = paymentFull?.invitation?.user?.id;
    if (buyerUserId && Number(profile.userId) === Number(buyerUserId)) {
      this.logger.warn(`Self-referral blocked paymentId=${paymentId} userId=${buyerUserId}`);
      await paymentRepo.update({ id: paymentId }, { commissionCredited: true });
      throw new ForbiddenException('Self-referral is not allowed');
    }

    // Step 4: compute commission from payment.amount * snapshot rate (COM-02, TIER-04)
    const tierConfig = await tierRepo.findOne({ where: { tier: profile.tier } });
    if (!tierConfig) {
      throw new NotFoundException(`TierConfig for ${profile.tier} not found`);
    }
    const grossAmount = Number(payment.amount);
    const rate = Number(tierConfig.commissionRate);
    const commissionAmount = Math.round(grossAmount * rate * 100) / 100;

    // Step 5: insert CommissionTransaction (UNIQUE(paymentId) enforces idempotency)
    const commission = commissionRepo.create({
      affiliateProfileId: profile.id,
      paymentId: payment.id,
      grossAmount,
      commissionRate: rate,
      commissionAmount,
      tierAtTime: profile.tier,
      status: CommissionStatus.PENDING,
      clearedAt: null,
    });
    await commissionRepo.save(commission);

    // Step 6: atomic SQL increment on running totals (D-14)
    await profileRepo
      .createQueryBuilder()
      .update(AffiliateProfile)
      .set({
        commissionBalance: () => `commissionBalance + ${commissionAmount}`,
        totalEarned: () => `totalEarned + ${commissionAmount}`,
        totalSales: () => `totalSales + 1`,
        totalSalesAmount: () => `totalSalesAmount + ${grossAmount}`,
        lastSaleAt: () => `CURRENT_TIMESTAMP`,
      })
      .where('id = :id', { id: profile.id })
      .execute();

    // Step 7: tier upgrade evaluation (TIER-01, TIER-02) — reads TierConfig thresholds from DB
    await this.evaluateTierUpgrade(profile.id, manager);

    // Step 8: mark Payment as credited (closes idempotency window for retries)
    await paymentRepo.update({ id: paymentId }, { commissionCredited: true });

    this.logger.log(
      `Commission credited paymentId=${paymentId} affiliateProfileId=${profile.id} ` +
        `gross=${grossAmount} rate=${rate} commission=${commissionAmount} tier=${profile.tier}`,
    );
    return commission;
  }

  /**
   * Real implementation (TIER-01, TIER-02): set the highest tier where
   * profile.totalSales >= tierConfig.minSales. Tier upgrades + downgrades
   * driven by sales count are both possible (downgrade only happens when
   * minSales thresholds change in admin config).
   *
   * Inactivity-based downgrade is handled separately by downgradeInactiveResellers.
   */
  async evaluateTierUpgrade(profileId: number, manager: EntityManager): Promise<void> {
    const profileRepo = manager.getRepository(AffiliateProfile);
    const tierRepo = manager.getRepository(TierConfig);

    const profile = await profileRepo.findOne({ where: { id: profileId } });
    if (!profile) return;

    const configs = await tierRepo.find();
    if (configs.length === 0) return;

    // Sort highest minSales first; choose first whose threshold is met.
    const sorted = configs.slice().sort((a, b) => Number(b.minSales) - Number(a.minSales));
    const newTier =
      sorted.find((c) => Number(profile.totalSales) >= Number(c.minSales))?.tier ??
      AffiliateTier.BRONZE;

    if (newTier !== profile.tier) {
      await profileRepo.update({ id: profileId }, { tier: newTier });
      this.logger.log(
        `Tier change profileId=${profileId} ${profile.tier} -> ${newTier} totalSales=${profile.totalSales}`,
      );
    }
  }

  /**
   * COM-05: PENDING -> CLEARED after clearingPeriodDays since createdAt.
   * Idempotent SQL bulk update; safe to run multiple times per day.
   * Returns count of rows transitioned.
   */
  async clearPendingCommissions(): Promise<number> {
    const config = await this.systemConfigRepo.findOne({
      where: { configKey: 'clearingPeriodDays' },
    });
    const days = Number(config?.configValue ?? 7);
    if (!Number.isFinite(days) || days < 0) {
      this.logger.error(`Invalid clearingPeriodDays=${config?.configValue}; skipping job`);
      return 0;
    }
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.commissionRepo
      .createQueryBuilder()
      .update(CommissionTransaction)
      .set({ status: CommissionStatus.CLEARED, clearedAt: () => 'CURRENT_TIMESTAMP' })
      .where('status = :pending AND createdAt <= :cutoff', {
        pending: CommissionStatus.PENDING,
        cutoff,
      })
      .execute();

    const count = result.affected ?? 0;
    this.logger.log(
      `clearPendingCommissions days=${days} cutoff=${cutoff.toISOString()} cleared=${count}`,
    );
    return count;
  }

  /**
   * TIER-03: downgrade tier to BRONZE for any reseller whose lastSaleAt is older
   * than inactivityDowngradeMonths (or who is non-Bronze and has lastSaleAt = NULL
   * AND createdAt older than the cutoff).
   * Returns count of profiles downgraded.
   */
  async downgradeInactiveResellers(): Promise<number> {
    const config = await this.systemConfigRepo.findOne({
      where: { configKey: 'inactivityDowngradeMonths' },
    });
    const months = Number(config?.configValue ?? 3);
    if (!Number.isFinite(months) || months <= 0) {
      this.logger.error(
        `Invalid inactivityDowngradeMonths=${config?.configValue}; skipping job`,
      );
      return 0;
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const result = await this.profileRepo
      .createQueryBuilder()
      .update(AffiliateProfile)
      .set({ tier: AffiliateTier.BRONZE })
      .where(
        '(tier <> :bronze) AND (' +
          '(lastSaleAt IS NOT NULL AND lastSaleAt < :cutoff) OR ' +
          '(lastSaleAt IS NULL AND createdAt < :cutoff)' +
          ')',
        { bronze: AffiliateTier.BRONZE, cutoff },
      )
      .execute();

    const count = result.affected ?? 0;
    this.logger.log(
      `downgradeInactiveResellers months=${months} cutoff=${cutoff.toISOString()} downgraded=${count}`,
    );
    return count;
  }

  async getProfileByUserId(userId: number): Promise<AffiliateProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Reseller profile not found');
    }
    return profile;
  }

  async getDashboard(userId: number) {
    const profile = await this.getProfileByUserId(userId);
    const balances = await this.getDashboardBalances(profile.id);
    const tierProgress = await this.getTierProgress(profile);

    return {
      affiliateCode: profile.affiliateCode,
      status: profile.status,
      balance: balances,
      tier: tierProgress,
    };
  }

  private async getDashboardBalances(profileId: number) {
    const rawCommissions = await this.commissionRepo
      .createQueryBuilder('ct')
      .select('ct.status', 'status')
      .addSelect('SUM(ct.commissionAmount)', 'total')
      .where('ct.affiliateProfileId = :id', { id: profileId })
      .andWhere('ct.status IN (:...statuses)', { statuses: [CommissionStatus.PENDING, CommissionStatus.CLEARED] })
      .groupBy('ct.status')
      .getRawMany();

    const pending = Number(rawCommissions.find((r) => r.status === CommissionStatus.PENDING)?.total ?? 0);
    const cleared = Number(rawCommissions.find((r) => r.status === CommissionStatus.CLEARED)?.total ?? 0);

    const withdrawnRaw = await this.withdrawRepo
      .createQueryBuilder('wr')
      .select('SUM(wr.requestedAmount)', 'total')
      .where('wr.affiliateProfileId = :id', { id: profileId })
      .andWhere('wr.status = :approved', { approved: WithdrawStatus.APPROVED })
      .getRawOne();

    const withdrawn = Number(withdrawnRaw?.total ?? 0);

    return {
      pending,
      cleared,
      withdrawn,
      availableToWithdraw: Math.max(0, cleared - withdrawn),
    };
  }

  private async getTierProgress(profile: AffiliateProfile) {
    const configs = await this.tierConfigRepo.find({ order: { minSales: 'ASC' } });
    const nextTierConfig = configs.find((c) => Number(c.minSales) > Number(profile.totalSales));

    return {
      current: profile.tier,
      totalSales: profile.totalSales,
      nextTier: nextTierConfig?.tier ?? null,
      nextTierMinSales: nextTierConfig ? Number(nextTierConfig.minSales) : null,
      salesNeededForNextTier: nextTierConfig
        ? Math.max(0, Number(nextTierConfig.minSales) - Number(profile.totalSales))
        : 0,
    };
  }

  async getCommissions(userId: number, page: number, limit: number) {
    const profile = await this.getProfileByUserId(userId);

    const [data, total] = await this.commissionRepo.findAndCount({
      where: { affiliateProfileId: profile.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['payment', 'payment.invitation', 'payment.invitation.user'],
    });

    const mappedData = data.map((ct) => ({
      id: ct.id,
      buyerName: ct.payment?.invitation?.user?.name ?? '—',
      grossAmount: Number(ct.grossAmount),
      commissionRate: Number(ct.commissionRate),
      commissionAmount: Number(ct.commissionAmount),
      tier: ct.tierAtTime,
      status: ct.status,
      createdAt: ct.createdAt,
      clearedAt: ct.clearedAt,
    }));

    return { data: mappedData, total, page, limit };
  }

  async submitWithdraw(userId: number, dto: CreateWithdrawDto) {
    const profile = await this.getProfileByUserId(userId);

    if (profile.status !== AffiliateStatus.ACTIVE) {
      throw new ForbiddenException('Akun reseller Anda sedang tidak aktif');
    }

    // DASH-05: One pending at a time
    const pendingCount = await this.withdrawRepo.count({
      where: { affiliateProfileId: profile.id, status: WithdrawStatus.PENDING },
    });
    if (pendingCount > 0) {
      throw new ConflictException('Anda masih memiliki permintaan penarikan yang sedang diproses');
    }

    // DASH-04: Minimum amount
    const minConfig = await this.systemConfigRepo.findOne({
      where: { configKey: 'minWithdrawalAmount' },
    });
    const minAmount = Number(minConfig?.configValue ?? 100000);
    if (dto.amount < minAmount) {
      throw new BadRequestException(`Minimal penarikan dana adalah Rp ${minAmount.toLocaleString('id-ID')}`);
    }

    // COM-06: Sufficient cleared balance
    const balances = await this.getDashboardBalances(profile.id);
    if (dto.amount > balances.availableToWithdraw) {
      throw new BadRequestException('Saldo yang tersedia untuk ditarik tidak mencukupi');
    }

    const withdraw = this.withdrawRepo.create({
      affiliateProfileId: profile.id,
      requestedAmount: dto.amount,
      status: WithdrawStatus.PENDING,
    });

    const saved = await this.withdrawRepo.save(withdraw);
    this.logger.log(`Withdraw request submitted profileId=${profile.id} amount=${dto.amount} id=${saved.id}`);

    return {
      success: true,
      data: saved,
    };
  }

  async getWithdrawals(userId: number) {
    const profile = await this.getProfileByUserId(userId);

    const data = await this.withdrawRepo.find({
      where: { affiliateProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });

    return { data };
  }

  // --- ADMIN METHODS ---

  async adminListResellers(page: number, limit: number, search?: string) {
    const query = this.profileRepo
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .orderBy('profile.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      query.andWhere('user.name LIKE :search OR profile.affiliateCode LIKE :search', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      success: true,
      data,
      total,
      page,
      limit,
    };
  }

  async adminUpdateResellerStatus(id: number, status: string) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Reseller profile not found');

    const validStatuses = Object.values(AffiliateStatus);
    if (!validStatuses.includes(status as AffiliateStatus)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    await this.profileRepo.update(id, { status: status as AffiliateStatus });
    this.logger.log(`Admin updated reseller status id=${id} status=${status}`);

    return { success: true };
  }

  async adminListWithdrawals(status?: string, page: number = 1, limit: number = 20) {
    const query = this.withdrawRepo
      .createQueryBuilder('wr')
      .leftJoinAndSelect('wr.affiliateProfile', 'profile')
      .leftJoinAndSelect('profile.user', 'user')
      .orderBy('wr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      query.andWhere('wr.status = :status', { status });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      success: true,
      data,
      total,
      page,
      limit,
    };
  }

  async adminApproveWithdrawal(id: number, proofUrl?: string, adminNote?: string) {
    return this.dataSource.transaction(async (manager) => {
      const withdrawRepo = manager.getRepository(WithdrawRequest);
      const profileRepo = manager.getRepository(AffiliateProfile);

      const request = await withdrawRepo.findOne({ 
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });
      if (!request) throw new NotFoundException('Withdraw request not found');
      if (request.status !== WithdrawStatus.PENDING) {
        throw new BadRequestException('Request is no longer pending');
      }

      // Update request status
      await withdrawRepo.update(id, {
        status: WithdrawStatus.APPROVED,
        proofUrl,
        adminNote,
        processedAt: new Date(),
      });

      // Decrement profile balance (Current balance)
      await profileRepo
        .createQueryBuilder()
        .update(AffiliateProfile)
        .set({
          commissionBalance: () => `commissionBalance - ${request.requestedAmount}`,
        })
        .where('id = :id', { id: request.affiliateProfileId })
        .execute();

      this.logger.log(`Admin approved withdrawal id=${id} amount=${request.requestedAmount}`);

      return { success: true };
    });
  }

  async adminRejectWithdrawal(id: number, adminNote: string) {
    const request = await this.withdrawRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Withdraw request not found');
    if (request.status !== WithdrawStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    await this.withdrawRepo.update(id, {
      status: WithdrawStatus.REJECTED,
      adminNote,
      processedAt: new Date(),
    });

    this.logger.log(`Admin rejected withdrawal id=${id} reason=${adminNote}`);

    return { success: true };
  }
}
