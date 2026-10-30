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
import { AffiliateConfigAudit } from './entities/affiliate-config-audit.entity';
import { AffiliateJobRun } from './entities/affiliate-job-run.entity';

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
    @InjectRepository(AffiliateConfigAudit)
    private readonly auditRepo: Repository<AffiliateConfigAudit>,
    @InjectRepository(AffiliateJobRun)
    private readonly jobRunRepo: Repository<AffiliateJobRun>,
  ) {}

  // --- Tier Config ---

  async listTierConfigs(): Promise<TierConfig[]> {
    return this.tierRepo.find({ order: { minSales: 'ASC' } });
  }

  async updateTierConfig(
    tier: string,
    dto: UpdateTierConfigDto,
    changedByUserId: number | null = null,
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
    const previous = {
      minSales: config.minSales,
      commissionRate: config.commissionRate,
    };
    if (dto.minSales !== undefined) config.minSales = dto.minSales;
    if (dto.commissionRate !== undefined)
      config.commissionRate = dto.commissionRate;
    const saved = await this.tierRepo.save(config);
    const changes = [
      { key: 'minSales', before: previous.minSales, after: saved.minSales },
      {
        key: 'commissionRate',
        before: previous.commissionRate,
        after: saved.commissionRate,
      },
    ].filter((change) => String(change.before) !== String(change.after));
    if (changes.length) {
      await this.auditRepo.save(
        changes.map((change) =>
          this.auditRepo.create({
            configType: 'tier',
            configKey: `${tier}.${change.key}`,
            beforeValue: String(change.before),
            afterValue: String(change.after),
            effectiveAt: saved.updatedAt,
            changedByUserId,
          }),
        ),
      );
    }
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
    changedByUserId: number | null = null,
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
        const beforeValue = existing.configValue;
        existing.configValue = String(u.value);
        await this.systemRepo.save(existing);
        if (beforeValue !== existing.configValue) {
          await this.auditRepo.save(
            this.auditRepo.create({
              configType: 'system',
              configKey: u.key,
              beforeValue,
              afterValue: existing.configValue,
              effectiveAt: new Date(),
              changedByUserId,
            }),
          );
        }
      } else {
        await this.systemRepo.save({
          configKey: u.key,
          configValue: String(u.value),
          description: null,
        });
        await this.auditRepo.save(
          this.auditRepo.create({
            configType: 'system',
            configKey: u.key,
            beforeValue: null,
            afterValue: String(u.value),
            effectiveAt: new Date(),
            changedByUserId,
          }),
        );
      }
      this.logger.log(`SystemConfig updated ${u.key}=${u.value}`);
    }
    return this.getSystemConfig();
  }

  async listConfigHistory() {
    return this.auditRepo.find({ order: { effectiveAt: 'DESC' }, take: 100 });
  }

  async listJobRuns() {
    return this.jobRunRepo.find({ order: { startedAt: 'DESC' }, take: 100 });
  }
}
