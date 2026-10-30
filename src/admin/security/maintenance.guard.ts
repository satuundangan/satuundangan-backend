import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

/**
 * Closes new purchases while maintenance is active. Reads, login, the admin
 * panel and payment webhooks stay open so admins can recover and in-flight
 * payments still settle.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly maintenance: MaintenanceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    if (req.method !== 'POST') return true;
    const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
    if (path !== '/payment/create') return true;
    if (!(await this.maintenance.isActive())) return true;
    const state = await this.maintenance.get();
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'MAINTENANCE',
      message: state.message,
      until: state.until,
    });
  }
}
