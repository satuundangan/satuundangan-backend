import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class NormalizeGuestMessageMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      const b = req.body;

      const rawName = b.guestName ?? b.name;
      if (rawName !== undefined && rawName !== null) {
        b.guestName = typeof rawName === 'string' ? rawName.trim() : rawName;
      }

      const rawRsvp = b.rsvpStatus ?? b.attendance;
      if (rawRsvp !== undefined && rawRsvp !== null) {
        b.rsvpStatus = typeof rawRsvp === 'string' ? rawRsvp.trim() : rawRsvp;
      }

      if (b.totalGuests === undefined || b.totalGuests === null || b.totalGuests === '') {
        const cleanStatus = typeof b.rsvpStatus === 'string' ? b.rsvpStatus.trim().toLowerCase() : '';
        b.totalGuests = cleanStatus === 'hadir' ? 1 : 0;
      } else if (typeof b.totalGuests === 'string') {
        const parsed = parseInt(b.totalGuests, 10);
        b.totalGuests = isNaN(parsed) ? 0 : parsed;
      }

      if (!b.guestSlug) {
        const rawSlug = b.token ?? b.guestToken;
        if (rawSlug !== undefined && rawSlug !== null) {
          b.guestSlug = typeof rawSlug === 'string' ? rawSlug.trim() : rawSlug;
        }
      }

      if (b.invitationId === undefined && b.invitation_id !== undefined) {
        b.invitationId = b.invitation_id;
      }
    }
    next();
  }
}
