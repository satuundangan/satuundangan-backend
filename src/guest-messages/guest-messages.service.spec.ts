import { GuestMessagesService } from './guest-messages.service';

describe('GuestMessagesService.create', () => {
  let service: GuestMessagesService;
  let guestMessageRepo: { create: jest.Mock; save: jest.Mock };
  let invitationRepo: { findOne: jest.Mock };
  let guestRepo: { findOne: jest.Mock; save: jest.Mock };

  const invitation = { id: 42 };
  const guest = {
    id: 7,
    accessToken: 'guest-access-token',
    slug: 'guest-slug',
    pax: 1,
    rsvpStatus: 'belum',
  };

  beforeEach(() => {
    guestMessageRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 99 })),
    };
    invitationRepo = { findOne: jest.fn(async () => invitation) };
    guestRepo = {
      findOne: jest.fn(async () => guest),
      save: jest.fn(async (value) => value),
    };
    service = new GuestMessagesService(
      guestMessageRepo as any,
      invitationRepo as any,
      guestRepo as any,
    );
    guest.pax = 1;
    guest.rsvpStatus = 'belum';
  });

  it('links a personal access token and stores the attending headcount', async () => {
    const result = await service.create({
      invitationId: 42,
      guestName: 'Dina',
      message: 'Sampai bertemu',
      rsvpStatus: 'hadir',
      totalGuests: 3,
      guestSlug: 'guest-access-token',
    });

    expect(guestRepo.findOne).toHaveBeenCalledWith({
      where: [
        { accessToken: 'guest-access-token', invitation: { id: 42 } },
        { slug: 'guest-access-token', invitation: { id: 42 } },
      ],
    });
    expect(guest.pax).toBe(3);
    expect(guest.rsvpStatus).toBe('hadir');
    expect(guestMessageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ guest, totalGuests: 3 }),
    );
    expect(result.id).toBe(99);
  });

  it('stores zero attendees for a declined personal RSVP', async () => {
    await service.create({
      invitationId: 42,
      guestName: 'Dina',
      message: 'Belum bisa hadir',
      rsvpStatus: 'tidak',
      totalGuests: 0,
      guestSlug: 'guest-access-token',
    });

    expect(guest.pax).toBe(0);
    expect(guest.rsvpStatus).toBe('tidak');
    expect(guestMessageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalGuests: 0 }),
    );
  });
});
