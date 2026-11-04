import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class NormalizeGuestMessagePipe implements PipeTransform {
  transform(value: any, _metadata?: ArgumentMetadata) {
    if (value && typeof value === 'object') {
      const rawName = value.guestName ?? value.name;
      if (rawName !== undefined && rawName !== null) {
        value.guestName = typeof rawName === 'string' ? rawName.trim() : rawName;
      }

      const rawRsvp = value.rsvpStatus ?? value.attendance;
      if (rawRsvp !== undefined && rawRsvp !== null) {
        value.rsvpStatus = typeof rawRsvp === 'string' ? rawRsvp.trim() : rawRsvp;
      }

      if (value.totalGuests === undefined || value.totalGuests === null || value.totalGuests === '') {
        const cleanStatus = typeof value.rsvpStatus === 'string' ? value.rsvpStatus.trim().toLowerCase() : '';
        value.totalGuests = cleanStatus === 'hadir' ? 1 : 0;
      } else {
        value.totalGuests = Number(value.totalGuests);
      }

      if (!value.guestSlug) {
        const rawSlug = value.token ?? value.guestToken;
        if (rawSlug !== undefined && rawSlug !== null) {
          value.guestSlug = typeof rawSlug === 'string' ? rawSlug.trim() : rawSlug;
        }
      }
    }
    return value;
  }
}
