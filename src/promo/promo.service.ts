import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Not, Repository, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PromoCode, DiscountType } from './promo-code.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Payment } from '../payment/payment.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

export type PromoComputedStatus =
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'exhausted'
  | 'inactive';

export interface PromoValidationResult {
  valid: boolean;
  message?: string;
  promoCode?: PromoCode;
  originalPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
}

@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(
    @InjectRepository(PromoCode)
    private readonly promoRepo: Repository<PromoCode>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async getActiveExitIntent(): Promise<PromoCode | null> {
    return this.promoRepo.findOne({
      where: { isActive: true, isExitIntentActive: true },
    });
  }

  computePromoStatus(
    promo: {
      isActive: boolean;
      validFrom: Date | string | null;
      validUntil: Date | string | null;
      maxUses: number | null;
    },
    redemptionsCount: number,
    now: Date = new Date(),
  ): PromoComputedStatus {
    if (!promo.isActive) {
      return 'inactive';
    }
    if (promo.validFrom && new Date(promo.validFrom) > now) {
      return 'scheduled';
    }
    if (promo.validUntil && new Date(promo.validUntil) < now) {
      return 'expired';
    }
    if (promo.maxUses !== null && redemptionsCount >= promo.maxUses) {
      return 'exhausted';
    }
    return 'active';
  }

  async validate(
    code: string,
    invitationId: number,
    baseAmount?: number,
  ): Promise<PromoValidationResult> {
    const promo = await this.promoRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!promo) {
      this.logger.warn(
        `Promo validation failed code=${code.toUpperCase()} invitationId=${invitationId} reason=not_found`,
      );
      return {
        valid: false,
        message: 'Kode promo tidak valid atau sudah tidak berlaku',
      };
    }

    if (!promo.isActive) {
      this.logger.warn(
        `Promo validation failed promoId=${promo.id} invitationId=${invitationId} reason=inactive`,
      );
      return {
        valid: false,
        message: 'Kode promo tidak valid atau sudah tidak berlaku',
      };
    }

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      this.logger.warn(
        `Promo validation failed promoId=${promo.id} invitationId=${invitationId} reason=not_started`,
      );
      return {
        valid: false,
        message: 'Kode promo tidak valid atau sudah tidak berlaku',
      };
    }
    if (promo.validUntil && now > promo.validUntil) {
      this.logger.warn(
        `Promo validation failed promoId=${promo.id} invitationId=${invitationId} reason=expired`,
      );
      return {
        valid: false,
        message: 'Kode promo tidak valid atau sudah tidak berlaku',
      };
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      this.logger.warn(
        `Promo validation failed promoId=${promo.id} invitationId=${invitationId} reason=max_uses`,
      );
      return {
        valid: false,
        message: 'Kode promo tidak valid atau sudah tidak berlaku',
      };
    }

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['templateDesign'],
    });

    if (!invitation) {
      this.logger.warn(
        `Promo validation failed promoId=${promo.id} invitationId=${invitationId} reason=invitation_not_found`,
      );
      return { valid: false, message: 'Undangan tidak ditemukan' };
    }

    // Discount applies to the package price when provided (checkout tier),
    // falling back to the template price for legacy callers.
    const originalPrice =
      baseAmount !== undefined
        ? baseAmount
        : Number(invitation.templateDesign?.price || 0);
    const { discountAmount, finalPrice } = this.calculateDiscount(
      originalPrice,
      promo,
    );
    this.logger.log(
      `Promo validation success promoId=${promo.id} invitationId=${invitationId} originalPrice=${originalPrice} discount=${discountAmount} finalPrice=${finalPrice}`,
    );

    return {
      valid: true,
      promoCode: promo,
      originalPrice,
      discountAmount,
      finalPrice,
    };
  }

  calculateDiscount(
    originalPrice: number,
    promo: PromoCode,
  ): { discountAmount: number; finalPrice: number } {
    const discountValue = Number(promo.discountValue);
    let discountAmount: number;

    if (promo.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((originalPrice * discountValue) / 100);
    } else {
      discountAmount = discountValue;
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);
    return { discountAmount, finalPrice };
  }

  /**
   * Atomically reserves one usage slot.
   * The WHERE clause enforces the max_uses limit at the DB level in a single
   * statement, so two concurrent requests cannot both "win" the last slot.
   * Returns true if a slot was reserved, false if the code is exhausted.
   */
  async tryReserve(promoId: number): Promise<boolean> {
    const usedCountColumn = this.getEscapedColumnName('usedCount');
    const maxUsesColumn = this.getEscapedColumnName('maxUses');
    const isActiveColumn = this.getEscapedColumnName('isActive');

    const result = await this.promoRepo
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => `${usedCountColumn} + 1` })
      .where(
        `id = :id AND ${isActiveColumn} = true AND (${maxUsesColumn} IS NULL OR ${usedCountColumn} < ${maxUsesColumn})`,
        { id: promoId },
      )
      .execute();

    const reserved = (result.affected ?? 0) > 0;
    this.logger.log(`Promo reserve promoId=${promoId} reserved=${reserved}`);
    return reserved;
  }

  /**
   * Compensating rollback — call this only when a reservation was made but
   * the downstream operation (e.g. Midtrans) subsequently failed.
   */
  async release(promoId: number): Promise<void> {
    const usedCountColumn = this.getEscapedColumnName('usedCount');

    await this.promoRepo
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => `GREATEST(0, ${usedCountColumn} - 1)` })
      .where('id = :id', { id: promoId })
      .execute();
    this.logger.log(`Promo reservation released promoId=${promoId}`);
  }

  private getEscapedColumnName(propertyName: keyof PromoCode): string {
    const column =
      this.promoRepo.metadata.findColumnWithPropertyName(propertyName);

    if (!column) {
      throw new Error(`PromoCode column ${String(propertyName)} not found`);
    }

    return this.promoRepo.manager.connection.driver.escape(column.databaseName);
  }

  // Admin Management & Metrics
  async list(page = 1, limit = 20, q?: string, status?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 20);

    const where = q && q.trim() ? { code: ILike(`%${q.trim()}%`) } : undefined;
    const promos = await this.promoRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const promoIds = promos.map((p) => p.id);
    const statsMap = new Map<
      number,
      {
        redemptions_count: number;
        pending_reservations_count: number;
        total_discount_amount: number;
        total_gross_revenue: number;
      }
    >();

    if (promoIds.length > 0) {
      const rawStats = await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.promoCodeId', 'promoCodeId')
        .addSelect(
          "COUNT(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN 1 END)",
          'redemptions_count',
        )
        .addSelect(
          "COUNT(CASE WHEN p.status = 'pending' THEN 1 END)",
          'pending_reservations_count',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.discountAmount ELSE 0 END), 0)",
          'total_discount_amount',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.amount ELSE 0 END), 0)",
          'total_gross_revenue',
        )
        .where('p.promoCodeId IN (:...promoIds)', { promoIds })
        .groupBy('p.promoCodeId')
        .getRawMany();

      for (const row of rawStats) {
        statsMap.set(Number(row.promoCodeId), {
          redemptions_count: Number(row.redemptions_count || 0),
          pending_reservations_count: Number(
            row.pending_reservations_count || 0,
          ),
          total_discount_amount: Number(row.total_discount_amount || 0),
          total_gross_revenue: Number(row.total_gross_revenue || 0),
        });
      }
    }

    const items = promos.map((promo) => {
      const stats = statsMap.get(promo.id) || {
        redemptions_count: 0,
        pending_reservations_count: 0,
        total_discount_amount: 0,
        total_gross_revenue: 0,
      };

      const computed_status = this.computePromoStatus(
        promo,
        stats.redemptions_count,
      );
      const remaining_slots =
        promo.maxUses !== null
          ? Math.max(0, promo.maxUses - stats.redemptions_count)
          : null;

      return {
        id: promo.id,
        code: promo.code,
        discount_type: promo.discountType,
        discount_value: promo.discountValue,
        max_uses: promo.maxUses,
        used_count: promo.usedCount,
        valid_from: promo.validFrom,
        valid_until: promo.validUntil,
        is_active: promo.isActive,
        is_exit_intent_active: promo.isExitIntentActive,
        exit_intent_text: promo.exitIntentText,
        redemptions_count: stats.redemptions_count,
        pending_reservations_count: stats.pending_reservations_count,
        total_discount_amount: stats.total_discount_amount,
        total_gross_revenue: stats.total_gross_revenue,
        remaining_slots,
        computed_status,
        createdAt: promo.createdAt,
      };
    });

    let filtered = items;
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      const targetStatus = status.trim().toLowerCase();
      filtered = items.filter((item) => item.computed_status === targetStatus);
    }

    const total = filtered.length;
    const paginatedData = filtered.slice(
      (pageNum - 1) * limitNum,
      pageNum * limitNum,
    );

    return {
      data: paginatedData,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async getSummary() {
    const promos = await this.promoRepo.find();
    const totalPromoCodes = promos.length;

    let totalRedemptions = 0;
    let totalDiscountGranted = 0;
    let totalGrossRevenue = 0;
    let totalActivePromo = 0;

    const promoIds = promos.map((p) => p.id);

    if (promoIds.length > 0) {
      const rawMetrics = await this.paymentRepo
        .createQueryBuilder('p')
        .select(
          "COUNT(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN 1 END)",
          'total_redemptions',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.discountAmount ELSE 0 END), 0)",
          'total_discount_granted',
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.amount ELSE 0 END), 0)",
          'total_gross_revenue',
        )
        .where('p.promoCodeId IS NOT NULL')
        .getRawOne();

      if (rawMetrics) {
        totalRedemptions = Number(rawMetrics.total_redemptions || 0);
        totalDiscountGranted = Number(rawMetrics.total_discount_granted || 0);
        totalGrossRevenue = Number(rawMetrics.total_gross_revenue || 0);
      }

      const redemptionCountsRaw = await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.promoCodeId', 'promoCodeId')
        .addSelect(
          "COUNT(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN 1 END)",
          'redemptions_count',
        )
        .where('p.promoCodeId IN (:...promoIds)', { promoIds })
        .groupBy('p.promoCodeId')
        .getRawMany();

      const redemptionsMap = new Map<number, number>();
      for (const row of redemptionCountsRaw) {
        redemptionsMap.set(
          Number(row.promoCodeId),
          Number(row.redemptions_count || 0),
        );
      }

      totalActivePromo = promos.filter((promo) => {
        const count = redemptionsMap.get(promo.id) || 0;
        return this.computePromoStatus(promo, count) === 'active';
      }).length;
    }

    return {
      total_promo_codes: totalPromoCodes,
      total_active_promo: totalActivePromo,
      total_redemptions: totalRedemptions,
      total_discount_granted: totalDiscountGranted,
      total_gross_revenue: totalGrossRevenue,
    };
  }

  async getDetail(id: number) {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    const rawStats = await this.paymentRepo
      .createQueryBuilder('p')
      .select(
        "COUNT(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN 1 END)",
        'redemptions_count',
      )
      .addSelect(
        "COUNT(CASE WHEN p.status = 'pending' THEN 1 END)",
        'pending_reservations_count',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.discountAmount ELSE 0 END), 0)",
        'total_discount_amount',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.status IN ('settlement', 'capture', 'success') THEN p.amount ELSE 0 END), 0)",
        'total_gross_revenue',
      )
      .where('p.promoCodeId = :id', { id })
      .getRawOne();

    const redemptions_count = Number(rawStats?.redemptions_count || 0);
    const pending_reservations_count = Number(
      rawStats?.pending_reservations_count || 0,
    );
    const total_discount_amount = Number(
      rawStats?.total_discount_amount || 0,
    );
    const total_gross_revenue = Number(rawStats?.total_gross_revenue || 0);

    const computed_status = this.computePromoStatus(promo, redemptions_count);
    const remaining_slots =
      promo.maxUses !== null
        ? Math.max(0, promo.maxUses - redemptions_count)
        : null;

    const orders = await this.paymentRepo.find({
      where: { promoCodeId: id },
      order: { createdAt: 'DESC' },
      take: 50,
      select: [
        'id',
        'orderId',
        'name',
        'email',
        'amount',
        'discountAmount',
        'package',
        'paymentMethod',
        'status',
        'createdAt',
        'settlementTime',
      ],
    });

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      name: o.name,
      email: o.email,
      amount: Number(o.amount),
      discountAmount:
        o.discountAmount !== null && o.discountAmount !== undefined
          ? Number(o.discountAmount)
          : null,
      package: o.package,
      paymentMethod: o.paymentMethod,
      status: o.status,
      createdAt: o.createdAt,
      settlementTime: o.settlementTime,
    }));

    return {
      id: promo.id,
      code: promo.code,
      discount_type: promo.discountType,
      discount_value: promo.discountValue,
      max_uses: promo.maxUses,
      used_count: promo.usedCount,
      valid_from: promo.validFrom,
      valid_until: promo.validUntil,
      is_active: promo.isActive,
      is_exit_intent_active: promo.isExitIntentActive,
      exit_intent_text: promo.exitIntentText,
      createdAt: promo.createdAt,
      updatedAt: promo.updatedAt,
      computed_status,
      remaining_slots,
      redemptions_count,
      pending_reservations_count,
      total_discount_amount,
      total_gross_revenue,
      metrics: {
        redemptions_count,
        pending_reservations_count,
        total_discount_amount,
        total_gross_revenue,
      },
      orders: formattedOrders,
    };
  }

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const promo = this.promoRepo.create({
      ...dto,
      code: dto.code.toUpperCase(),
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });
    return this.promoRepo.save(promo);
  }

  async update(id: number, dto: UpdatePromoCodeDto): Promise<PromoCode> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');

    if (dto.code) dto.code = dto.code.toUpperCase();
    const updated: Partial<PromoCode> = {
      ...dto,
      validFrom:
        dto.validFrom !== undefined
          ? dto.validFrom
            ? new Date(dto.validFrom)
            : null
          : promo.validFrom,
      validUntil:
        dto.validUntil !== undefined
          ? dto.validUntil
            ? new Date(dto.validUntil)
            : null
          : promo.validUntil,
    };

    if (updated.isExitIntentActive) {
      await this.promoRepo.update(
        { isExitIntentActive: true, id: Not(id) },
        { isExitIntentActive: false },
      );
    }
    Object.assign(promo, updated);
    return this.promoRepo.save(promo);
  }

  async remove(id: number): Promise<void> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');
    await this.promoRepo.remove(promo);
  }
}
