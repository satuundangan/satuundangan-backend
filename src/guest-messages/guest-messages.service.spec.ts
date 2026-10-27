import { GuestMessagesService } from './guest-messages.service';

describe('GuestMessagesService personal RSVP', () => {
  const invitation = { id: 10 };
  const guest = {
    id: 20,
    accessToken: 'private-token',
    slug: 'named-guest',
    rsvpStatus: 'belum',
    pax: 1,
  };

  const invitationRepo = { findOne: jest.fn() };
  const guestRepo = { findOne: jest.fn(), save: jest.fn() };
  const guestMessageRepo = { create: jest.fn(), save: jest.fn() };

  const service = new GuestMessagesService(
    guestMessageRepo as never,
    invitationRepo as never,
    guestRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    invitationRepo.findOne.mockResolvedValue(invitation);
    guestRepo.findOne.mockResolvedValue({ ...guest });
    guestMessageRepo.create.mockImplementation((value: unknown) => value);
    guestMessageRepo.save.mockImplementation((value: unknown) => Promise.resolve(value));
  });

  it('matches a personal access token within the invitation and syncs status and pax', async () => {
    await service.create({
      invitationId: 10,
      guestName: 'Tamu Contoh',
      message: 'Selamat!',
      rsvpStatus: 'hadir',
      totalGuests: 2,
      guestSlug: 'private-token',
    });

    expect(guestRepo.findOne).toHaveBeenCalledWith({
      where: [
        { accessToken: 'private-token', invitation: { id: 10 } },
        { slug: 'private-token', invitation: { id: 10 } },
      ],
    });
    expect(guestRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ rsvpStatus: 'hadir', pax: 2 }),
    );
  });

  it('keeps a public RSVP unlinked to the guest list', async () => {
    await service.create({
      invitationId: 10,
      guestName: 'Tamu Publik',
      message: 'Selamat!',
      rsvpStatus: 'hadir',
      totalGuests: 1,
    });

    expect(guestRepo.findOne).not.toHaveBeenCalled();
    expect(guestRepo.save).not.toHaveBeenCalled();
    expect(guestMessageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ guest: null }),
    );
  });
});
