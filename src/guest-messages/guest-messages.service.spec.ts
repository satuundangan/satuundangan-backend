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

  it('syncs a non-attending personal RSVP with zero guests', async () => {
    await service.create({
      invitationId: 10,
      guestName: 'Tamu Contoh',
      message: 'Mohon maaf, tidak dapat hadir.',
      rsvpStatus: 'tidak',
      totalGuests: 0,
      guestSlug: 'private-token',
    });

    expect(guestRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ rsvpStatus: 'tidak', pax: 0 }),
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

describe('GuestMessagesService Drilldown & Moderation', () => {
  const invitationRepo = { findOne: jest.fn() };
  const guestRepo = { find: jest.fn() };
  const guestMessageRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const service = new GuestMessagesService(
    guestMessageRepo as never,
    invitationRepo as never,
    guestRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByInvitationId', () => {
    it('queries published and null status messages', async () => {
      guestMessageRepo.find.mockResolvedValue([
        { id: 1, status: 'published' },
      ]);

      const res = await service.findByInvitationId(10);
      expect(guestMessageRepo.find).toHaveBeenCalledWith({
        where: [
          { invitation: { id: 10 }, status: 'published' },
          { invitation: { id: 10 }, status: expect.anything() },
        ],
        order: { createdAt: 'DESC' },
      });
      expect(res).toHaveLength(1);
    });
  });

  describe('getGuestDrilldown', () => {
    it('calculates guest drilldown metrics accurately', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 10,
        user: { id: 50 },
      });

      const mockGuests = [
        { id: 1, statusSend: 'sent', firstVisitAt: new Date(), rsvpStatus: 'hadir', pax: 2 },
        { id: 2, statusSend: 'delivered', firstVisitAt: null, visitCount: 3, rsvpStatus: 'tidak', pax: 1 },
        { id: 3, statusSend: '', firstVisitAt: null, visitCount: 0, rsvpStatus: 'ragu', pax: 1 },
        { id: 4, statusSend: null, firstVisitAt: null, visitCount: 0, rsvpStatus: 'belum', pax: 1 },
      ];

      const mockMessages = [
        { id: 1, status: 'published', message: 'Selamat ya!' },
        { id: 2, status: 'hidden', message: 'Spam' },
        { id: 3, status: 'flagged_spam', message: 'Promo link' },
        { id: 4, status: null, message: 'Barakallah' },
      ];

      guestRepo.find.mockResolvedValue(mockGuests);
      guestMessageRepo.find.mockResolvedValue(mockMessages);

      const drilldown = await service.getGuestDrilldown(10, { id: 50, isAdmin: false });

      expect(drilldown.totalGuests).toBe(4);
      expect(drilldown.sentCount).toBe(2); // id 1, 2
      expect(drilldown.openedCount).toBe(2); // id 1 (firstVisitAt), id 2 (visitCount > 0)
      expect(drilldown.respondedCount).toBe(3); // hadir, tidak, ragu
      expect(drilldown.totalPax).toBe(2); // only hadir has pax = 2
      expect(drilldown.wishesSummary).toEqual({
        total: 4,
        published: 2, // 'published' and null
        hidden: 1,
        flaggedSpam: 1,
      });
      expect(drilldown.messages).toHaveLength(4);
    });
  });

  describe('moderateMessage', () => {
    it('allows owner or admin to moderate status', async () => {
      const msg = {
        id: 1,
        status: 'published',
        invitation: { user: { id: 50 } },
      };
      guestMessageRepo.findOne.mockResolvedValue(msg);
      guestMessageRepo.save.mockImplementation((val) => Promise.resolve(val));

      const updated = await service.moderateMessage(1, 'hidden', { id: 50, isAdmin: false });
      expect(updated.status).toBe('hidden');
    });

    it('rejects invalid status', async () => {
      await expect(
        service.moderateMessage(1, 'invalid_status', { id: 50, isAdmin: false }),
      ).rejects.toThrow();
    });
  });

  describe('adminGetMessages', () => {
    it('queries with search and pagination', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      };
      guestMessageRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.adminGetMessages({
        invitationId: 10,
        status: 'flagged_spam',
        search: 'bot',
        page: 1,
        limit: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('invitation.id = :invitationId', { invitationId: 10 });
      expect(mockQb.andWhere).toHaveBeenCalledWith('gm.status = :status', { status: 'flagged_spam' });
      expect(res.total).toBe(1);
    });
  });
});

