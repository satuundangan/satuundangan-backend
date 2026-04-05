import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PromoCode, DiscountType } from './promo-code.entity';
import { Invitation } from '../invitation/invitation.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

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
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoRepo: Repository<PromoCode>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
  ) {}

  async validate(
    code: string,
    invitationId: number,
  ): Promise<PromoValidationResult> {
    const promo = await this.promoRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!promo) {
      return { valid: false, message: 'Kode promo tidak valid atau sudah tidak berlaku' };
    }

    if (!promo.isActive) {
      return { valid: false, message: 'Kode promo tidak valid atau sudah tidak berlaku' };
    }

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      return { valid: false, message: 'Kode promo tidak valid atau sudah tidak berlaku' };
    }
    if (promo.validUntil && now > promo.validUntil) {
      return { valid: false, message: 'Kode promo tidak valid atau sudah tidak berlaku' };
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, message: 'Kode promo tidak valid atau sudah tidak berlaku' };
    }

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['templateDesign'],
    });

    if (!invitation) {
      return { valid: false, message: 'Undangan tidak ditemukan' };
    }

    const originalPrice = Number(invitation.templateDesign?.price || 0);
    const { discountAmount, finalPrice } = this.calculateDiscount(
      originalPrice,
      promo,
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
    const result = await this.promoRepo
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => 'used_count + 1' })
      .where(
        'id = :id AND is_active = true AND (max_uses IS NULL OR used_count < max_uses)',
        { id: promoId },
      )
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * Compensating rollback — call this only when a reservation was made but
   * the downstream operation (e.g. Midtrans) subsequently failed.
   */
  async release(promoId: number): Promise<void> {
    await this.promoRepo
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => 'GREATEST(0, used_count - 1)' })
      .where('id = :id', { id: promoId })
      .execute();
  }

  // Admin CRUD
  async list(page = 1, limit = 20, q?: string) {
    const where = q ? { code: ILike(`%${q}%`) } : undefined;
    const [data, total] = await this.promoRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
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
      validFrom: dto.validFrom !== undefined
        ? (dto.validFrom ? new Date(dto.validFrom) : null)
        : promo.validFrom,
      validUntil: dto.validUntil !== undefined
        ? (dto.validUntil ? new Date(dto.validUntil) : null)
        : promo.validUntil,
    };

    Object.assign(promo, updated);
    return this.promoRepo.save(promo);
  }

  async remove(id: number): Promise<void> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');
    await this.promoRepo.remove(promo);
  }
}
