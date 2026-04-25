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
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { Payment } from '../payment/payment.entity';
import { AffiliateTier, AffiliateStatus, CommissionStatus } from './types/affiliate.type';
import { RegisterAffiliateDto } from './dto/register-affiliate.dto';

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

    // Step 7: tier upgrade evaluation (real logic added in Plan 03 — this is a placeholder hook)
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
}
