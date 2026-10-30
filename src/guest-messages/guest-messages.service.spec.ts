import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('GuestMessagesService delete', () => {
  const mockMessage = {
    id: 1,
    guestName: 'Tamu Contoh',
    message: 'Selamat!',
    rsvpStatus: 'hadir',
    totalGuests: 2,
    invitation: {
      id: 10,
      user: { id: 100 },
    },
    guest: {
      id: 20,
      rsvpStatus: 'hadir',
      pax: 2,
    },
  };

  const invitationRepo = { findOne: jest.fn() };
  const guestRepo = { findOne: jest.fn(), save: jest.fn() };
  const guestMessageRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const service = new GuestMessagesService(
    guestMessageRepo as never,
    invitationRepo as never,
    guestRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Case 1: Pemilik undangan berhasil menghapus ucapan', async () => {
    const message = { ...mockMessage, guest: { ...mockMessage.guest } };
    guestMessageRepo.findOne.mockResolvedValue(message);
    guestMessageRepo.remove.mockResolvedValue(message);

    const ownerUser = { id: 100, isAdmin: false };
    await service.delete(1, ownerUser);

    expect(guestMessageRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ['invitation', 'invitation.user', 'guest'],
    });
    expect(guestMessageRepo.remove).toHaveBeenCalledWith(message);
  });

  it('Case 2: Admin berhasil menghapus ucapan milik siapa saja', async () => {
    const message = { ...mockMessage, guest: { ...mockMessage.guest } };
    guestMessageRepo.findOne.mockResolvedValue(message);
    guestMessageRepo.remove.mockResolvedValue(message);

    const adminUser = { id: 999, isAdmin: true };
    await service.delete(1, adminUser);

    expect(guestMessageRepo.remove).toHaveBeenCalledWith(message);
  });

  it('Case 3: Bukan pemilik dan bukan admin mendapat ForbiddenException', async () => {
    const message = { ...mockMessage, guest: { ...mockMessage.guest } };
    guestMessageRepo.findOne.mockResolvedValue(message);

    const nonOwnerUser = { id: 200, isAdmin: false };
    await expect(service.delete(1, nonOwnerUser)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.delete(1, nonOwnerUser)).rejects.toThrow(
      'You are not allowed to delete this message',
    );
    expect(guestMessageRepo.remove).not.toHaveBeenCalled();
  });

  it('Case 4: Pesan tidak ditemukan mendapat NotFoundException', async () => {
    guestMessageRepo.findOne.mockResolvedValue(null);

    const user = { id: 100, isAdmin: false };
    await expect(service.delete(999, user)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.delete(999, user)).rejects.toThrow(
      'Guest message not found',
    );
    expect(guestMessageRepo.remove).not.toHaveBeenCalled();
  });

  it('Case 5: RSVP status pada relasi guest tetap tidak berubah', async () => {
    const guestObj = { ...mockMessage.guest, rsvpStatus: 'hadir', pax: 2 };
    const message = {
      ...mockMessage,
      guest: guestObj,
    };
    guestMessageRepo.findOne.mockResolvedValue(message);
    guestMessageRepo.remove.mockResolvedValue(message);

    const ownerUser = { id: 100, isAdmin: false };
    await service.delete(1, ownerUser);

    expect(guestObj.rsvpStatus).toBe('hadir');
    expect(guestObj.pax).toBe(2);
    expect(guestRepo.save).not.toHaveBeenCalled();
    expect(guestMessageRepo.remove).toHaveBeenCalledWith(message);
  });
});
