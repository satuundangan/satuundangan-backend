import { NormalizeGuestMessagePipe } from './normalize-guest-message.pipe';

describe('NormalizeGuestMessagePipe', () => {
  let pipe: NormalizeGuestMessagePipe;

  beforeEach(() => {
    pipe = new NormalizeGuestMessagePipe();
  });

  it('normalizes legacy payload with name and attendance to guestName and rsvpStatus', () => {
    const raw = {
      invitationId: 1,
      name: '  Tamu Undangan Lama  ',
      attendance: 'hadir',
      message: 'Selamat berbahagia!',
    };
    const result = pipe.transform(raw);

    expect(result.guestName).toBe('Tamu Undangan Lama');
    expect(result.rsvpStatus).toBe('hadir');
    expect(result.totalGuests).toBe(1);
  });

  it('sets totalGuests to 0 when legacy attendance is tidak_hadir and totalGuests is missing', () => {
    const raw = {
      invitationId: 2,
      name: 'Tamu Berhalangan',
      attendance: 'tidak_hadir',
      message: 'Maaf belum bisa hadir',
    };
    const result = pipe.transform(raw);

    expect(result.guestName).toBe('Tamu Berhalangan');
    expect(result.rsvpStatus).toBe('tidak_hadir');
    expect(result.totalGuests).toBe(0);
  });

  it('preserves existing correct fields guestName and rsvpStatus', () => {
    const raw = {
      invitationId: 3,
      guestName: 'Tamu Modern',
      rsvpStatus: 'hadir',
      totalGuests: 3,
      message: 'Hadir sekeluarga!',
    };
    const result = pipe.transform(raw);

    expect(result.guestName).toBe('Tamu Modern');
    expect(result.rsvpStatus).toBe('hadir');
    expect(result.totalGuests).toBe(3);
  });

  it('maps legacy token or guestToken to guestSlug', () => {
    const raw = {
      invitationId: 4,
      guestName: 'Tamu VIP',
      rsvpStatus: 'hadir',
      totalGuests: 2,
      message: 'Hadir!',
      token: '  tok-vip-123  ',
    };
    const result = pipe.transform(raw);

    expect(result.guestSlug).toBe('tok-vip-123');
  });

  it('handles non-object inputs gracefully', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('string')).toBe('string');
  });
});
