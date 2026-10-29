import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityTarget } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { Article } from '../../article/article.entity';
import { Category } from '../../category/category.entity';
import { Invitation } from '../../invitation/invitation.entity';
import { Payment } from '../../payment/payment.entity';
import { PromoCode } from '../../promo/promo-code.entity';
import { TemplateDesign } from '../../template-design/template-design.entity';
import { User } from '../../user/user.entity';
import { Audio } from '../entities/audio.entity';
import { Bank } from '../entities/bank.entity';
import { PaletteColor } from '../entities/palette-color.entity';
import { Section } from '../entities/section.entity';
import { AdminAuditService } from './admin-audit.service';
import { adminResourceFromPath, resolveAdminRole } from './admin-roles';
import { redactForAudit } from './audit-redaction';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Entities whose "before" state is loaded so a change can be traced to what it replaced. */
const BEFORE_LOADERS: Record<string, EntityTarget<any>> = {
  users: User,
  invitations: Invitation,
  payments: Payment,
  'promo-codes': PromoCode,
  'template-designs': TemplateDesign,
  categories: Category,
  banks: Bank,
  sections: Section,
  audio: Audio,
  'palette-colors': PaletteColor,
  articles: Article,
};

const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

export function describeAdminRequest(method: string, path: string) {
  const segments = path.split('?')[0].replace(/^\/admin\//, '').split('/').filter(Boolean);
  const entityType = segments[0] ?? 'admin';
  const entityId = segments.length > 1 && !/^[a-z-]+$/.test(segments[1]) ? segments[1] : null;
  const tail = segments.slice(entityId ? 2 : 1).join('-');
  const base = ACTION_BY_METHOD[method.toUpperCase()] ?? method.toLowerCase();
  const action = `${entityType}.${tail && base === 'create' ? tail : tail ? `${base}-${tail}` : base}`;
  return { entityType, entityId, action };
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AdminAuditService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (SAFE_METHODS.has(req.method) || !adminResourceFromPath(path) || !req.user?.id) {
      return next.handle();
    }

    const requestId = String(req.headers['x-request-id'] || randomUUID()).slice(0, 64);
    res.setHeader('x-request-id', requestId);
    const { entityType, entityId, action } = describeAdminRequest(req.method, path);
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const before = await this.loadBefore(entityType, entityId, body);
    const actor = await this.dataSource.getRepository(User).findOne({
      where: { id: req.user.id },
      select: { id: true, email: true, isAdmin: true, adminRole: true },
    });
    const base = {
      requestId,
      actorId: req.user.id,
      actorEmail: actor?.email ?? req.user.email ?? null,
      actorRole: actor ? resolveAdminRole(actor) : null,
      action,
      entityType,
      entityId,
      before,
      after: redactForAudit(body),
      reason: String(req.headers['x-admin-reason'] || '').trim().slice(0, 500) || null,
      ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 64) || null,
    };

    return next.handle().pipe(
      tap({
        next: () => void this.audit.record({ ...base, result: 'success', statusCode: res.statusCode }),
        error: (error) =>
          void this.audit.record({
            ...base,
            result: 'failed',
            statusCode: error instanceof HttpException ? error.getStatus() : 500,
            errorMessage: String(error?.message ?? 'Error').slice(0, 255),
          }),
      }),
    );
  }

  private async loadBefore(entityType: string, entityId: string | null, body: Record<string, any> | null) {
    const target = BEFORE_LOADERS[entityType];
    if (!target || !entityId) return null;
    try {
      const row = await this.dataSource.getRepository(target).findOne({
        where: { id: /^\d+$/.test(entityId) ? Number(entityId) : entityId } as any,
      });
      if (!row) return null;
      // Keep only what the request touches; a delete keeps the whole (redacted) row.
      const picked = body && Object.keys(body).length
        ? Object.fromEntries(Object.keys(body).map((key) => [key, (row as any)[key]]))
        : row;
      return redactForAudit(picked);
    } catch {
      return null;
    }
  }
}
