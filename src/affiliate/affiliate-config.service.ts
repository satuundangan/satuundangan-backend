import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierConfig } from './entities/tier-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { AffiliateTier } from './types/affiliate.type';
import { UpdateTierConfigDto } from './dto/update-tier-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

const SYSTEM_KEYS = [
  'minWithdrawalAmount',
  'clearingPeriodDays',
  'inactivityDowngradeMonths',
] as const;
type SystemKey = (typeof SYSTEM_KEYS)[number];

@Injectable()
export class AffiliateConfigService {
  private readonly logger = new Logger(AffiliateConfigService.name);

  constructor(
    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,
    @InjectRepository(SystemConfig)
    private readonly systemRepo: Repository<SystemConfig>,
  ) {}

  // --- Tier Config ---

  async listTierConfigs(): Promise<TierConfig[]> {
    return this.tierRepo.find({ order: { minSales: 'ASC' } });
  }

  async updateTierConfig(
    tier: string,
    dto: UpdateTierConfigDto,
  ): Promise<TierConfig> {
    const allowed = Object.values(AffiliateTier) as string[];
    if (!allowed.includes(tier)) {
      throw new BadRequestException(
        `Unknown tier '${tier}'. Allowed: ${allowed.join(', ')}`,
      );
    }
    const config = await this.tierRepo.findOne({
      where: { tier: tier as AffiliateTier },
    });
    if (!config) {
      throw new NotFoundException(`TierConfig for ${tier} not found`);
    }
    if (dto.minSales !== undefined) config.minSales = dto.minSales;
    if (dto.commissionRate !== undefined)
      config.commissionRate = dto.commissionRate;
    const saved = await this.tierRepo.save(config);
    this.logger.log(
      `TierConfig updated tier=${tier} minSales=${saved.minSales} rate=${saved.commissionRate}`,
    );
    return saved;
  }

  // --- System Config ---

  async getSystemConfig(): Promise<Record<SystemKey, number>> {
    const rows = await this.systemRepo.find();
    const result: Partial<Record<SystemKey, number>> = {};
    for (const key of SYSTEM_KEYS) {
      const found = rows.find((r) => r.configKey === key);
      result[key] = found ? Number(found.configValue) : Number.NaN;
    }
    return result as Record<SystemKey, number>;
  }

  async updateSystemConfig(
    dto: UpdateSystemConfigDto,
  ): Promise<Record<SystemKey, number>> {
    const updates: Array<{ key: SystemKey; value: number | undefined }> = [
      { key: 'minWithdrawalAmount', value: dto.minWithdrawalAmount },
      { key: 'clearingPeriodDays', value: dto.clearingPeriodDays },
      {
        key: 'inactivityDowngradeMonths',
        value: dto.inactivityDowngradeMonths,
      },
    ];
    for (const u of updates) {
      if (u.value === undefined) continue;
      const existing = await this.systemRepo.findOne({
        where: { configKey: u.key },
      });
      if (existing) {
        existing.configValue = String(u.value);
        await this.systemRepo.save(existing);
      } else {
        await this.systemRepo.save({
          configKey: u.key,
          configValue: String(u.value),
          description: null,
        });
      }
      this.logger.log(`SystemConfig updated ${u.key}=${u.value}`);
    }
    return this.getSystemConfig();
  }
}
