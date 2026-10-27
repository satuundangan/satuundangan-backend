import { validate } from 'class-validator';
import { CreateGuestMessageDto } from './create-guest-message.dto';

const validMessage = (message: unknown) =>
  Object.assign(new CreateGuestMessageDto(), {
    invitationId: 1,
    guestName: 'Tamu Uji',
    message,
    rsvpStatus: 'hadir',
    totalGuests: 2,
  });

describe('CreateGuestMessageDto', () => {
  it('accepts an empty wish when the guest confirms attendance', async () => {
    expect(await validate(validMessage(''))).toEqual([]);
  });

  it.each([undefined, 42])('rejects an invalid wish value: %s', async (message) => {
    const errors = await validate(validMessage(message));
    expect(errors.some((error) => error.property === 'message')).toBe(true);
  });
});
