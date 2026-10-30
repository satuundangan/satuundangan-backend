import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AdminAuditLog } from './admin-audit-log.entity';

export interface AuditQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  actorId?: number;
  result?: 'success' | 'failed';
  entityId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(@InjectRepository(AdminAuditLog) private readonly repo: Repository<AdminAuditLog>) {}

  /** Audit writes must never fail the admin request that triggered them. */
  async record(entry: Partial<AdminAuditLog>): Promise<void> {
    try {
      await this.repo.insert(entry);
    } catch (error) {
      this.logger.error(`Gagal menulis jejak audit ${entry.action}: ${(error as Error).message}`);
    }
  }

  async list(query: AuditQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const where: FindOptionsWhere<AdminAuditLog> = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = Number(query.actorId);
    if (query.result) where.result = query.result;
    if (query.entityId) where.entityId = query.entityId;
    const from = query.from ? new Date(`${query.from}T00:00:00+07:00`) : null;
    const to = query.to ? new Date(`${query.to}T23:59:59.999+07:00`) : null;
    if (from && to) where.createdAt = Between(from, to);
    else if (from) where.createdAt = MoreThanOrEqual(from);
    else if (to) where.createdAt = LessThanOrEqual(to);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
