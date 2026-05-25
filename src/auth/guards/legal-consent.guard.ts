import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConsentService } from '../../user/consent.service';

@Injectable()
export class LegalConsentGuard implements CanActivate {
  constructor(private readonly consentService: ConsentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true; // Let JwtAuthGuard handle authentication

    const isApproved = await this.consentService.checkConsent(
      user.id || user.sub,
    );

    if (!isApproved) {
      throw new ForbiddenException({
        message: 'LEGAL_CONSENT_REQUIRED',
        statusCode: 403,
      });
    }

    return true;
  }
}
