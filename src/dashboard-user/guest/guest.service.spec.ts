import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GuestService } from './guest.service';
import { Guest } from './guest.entity';
import { Invitation } from '../../invitation/invitation.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('GuestService - CheckIn', () => {
  let service: GuestService;
  let guestRepo: any;
  let invitationRepo: any;

  beforeEach(async () => {
    guestRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    invitationRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestService,
        { provide: getRepositoryToken(Guest), useValue: guestRepo },
        { provide: getRepositoryToken(Invitation), useValue: invitationRepo },
      ],
    }).compile();

    service = module.get<GuestService>(GuestService);
  });

  describe('checkIn', () => {
    it('should throw NotFoundException if guest is not found', async () => {
      guestRepo.findOne.mockResolvedValue(null);

      await expect(service.checkIn(999)).rejects.toThrow(NotFoundException);
    });

    it('should check in guest successfully when not checked in yet', async () => {
      const mockGuest = {
        id: 1,
        name: 'Budi Santoso',
        group: 'VIP',
        degree: 'S.Kom',
        phoneNumber: '08123456789',
        rsvpStatus: 'hadir',
        checkedInAt: null,
      };

      guestRepo.findOne.mockResolvedValue(mockGuest);
      guestRepo.save.mockImplementation(async (g: any) => g);

      const result = await service.checkIn(1);

      expect(result.success).toBe(true);
      expect(result.alreadyCheckedIn).toBe(false);
      expect(result.message).toBe('Tamu Budi Santoso berhasil Check-in');
      expect(result.check_in_time).toBeInstanceOf(Date);
      expect(result.guest.name).toBe('Budi Santoso');
      expect(guestRepo.save).toHaveBeenCalled();
    });

    it('should not overwrite checkedInAt if already checked in', async () => {
      const existingDate = new Date('2026-01-01T10:00:00Z');
      const mockGuest = {
        id: 2,
        name: 'Siti Aminah',
        group: 'Keluarga',
        degree: '',
        phoneNumber: '08987654321',
        rsvpStatus: 'hadir',
        checkedInAt: existingDate,
      };

      guestRepo.findOne.mockResolvedValue(mockGuest);

      const result = await service.checkIn(2);

      expect(result.success).toBe(true);
      expect(result.alreadyCheckedIn).toBe(true);
      expect(result.message).toBe('Tamu sudah pernah check-in sebelumnya');
      expect(result.check_in_time).toBe(existingDate);
      expect(guestRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('checkInByToken', () => {
    it('should throw NotFoundException if token extraction results in empty string', async () => {
      await expect(service.checkInByToken('')).rejects.toThrow(
        new NotFoundException('Tiket QR atau tamu tidak ditemukan'),
      );
    });

    it('should check in guest using raw token', async () => {
      const mockGuest = {
        id: 10,
        name: 'Andi',
        group: 'Teman',
        degree: '',
        phoneNumber: '081111111',
        rsvpStatus: 'hadir',
        accessToken: 'token-abc-123',
        checkedInAt: null,
      };

      guestRepo.findOne.mockResolvedValue(mockGuest);
      guestRepo.save.mockImplementation(async (g: any) => g);

      const result = await service.checkInByToken('token-abc-123');

      expect(guestRepo.findOne).toHaveBeenCalledWith({
        where: { accessToken: 'token-abc-123' },
        relations: ['invitation'],
      });
      expect(result.success).toBe(true);
      expect(result.alreadyCheckedIn).toBe(false);
      expect(result.message).toBe('Tamu Andi berhasil Check-in');
    });

    it('should extract token from full invitation URL', async () => {
      const mockGuest = {
        id: 11,
        name: 'Dewi',
        group: 'VIP',
        degree: 'M.Sc',
        phoneNumber: '082222222',
        rsvpStatus: 'hadir',
        accessToken: 'my-unique-token',
        checkedInAt: null,
      };

      guestRepo.findOne.mockResolvedValue(mockGuest);
      guestRepo.save.mockImplementation(async (g: any) => g);

      const result = await service.checkInByToken(
        'https://satuundangan.id/inv/the-wedding-of-andi-dewi/my-unique-token?e=ZXhhbXBsZQ==',
      );

      expect(guestRepo.findOne).toHaveBeenCalledWith({
        where: { accessToken: 'my-unique-token' },
        relations: ['invitation'],
      });
      expect(result.success).toBe(true);
    });

    it('should extract token from JSON string payload', async () => {
      const mockGuest = {
        id: 12,
        name: 'Eko',
        accessToken: 'json-token-999',
        checkedInAt: null,
      };

      guestRepo.findOne.mockResolvedValue(mockGuest);
      guestRepo.save.mockImplementation(async (g: any) => g);

      const result = await service.checkInByToken(
        JSON.stringify({ token: 'json-token-999' }),
      );

      expect(guestRepo.findOne).toHaveBeenCalledWith({
        where: { accessToken: 'json-token-999' },
        relations: ['invitation'],
      });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if token not found in database', async () => {
      guestRepo.findOne.mockResolvedValue(null);

      await expect(service.checkInByToken('invalid-token')).rejects.toThrow(
        new NotFoundException('Tiket QR atau tamu tidak ditemukan'),
      );
    });
  });

  describe('getCheckInSummary', () => {
    it('should throw NotFoundException if invitation does not exist', async () => {
      invitationRepo.findOne.mockResolvedValue(null);

      await expect(service.getCheckInSummary(1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if invitation is not owned by user', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 1,
        user: { id: 200 },
      });

      await expect(service.getCheckInSummary(1, 100)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return correct summary and recent check-ins', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 5,
        user: { id: 42 },
      });

      guestRepo.count
        .mockResolvedValueOnce(100) // totalGuests
        .mockResolvedValueOnce(25); // totalCheckedIn

      const checkInTime = new Date();
      guestRepo.find.mockResolvedValue([
        {
          id: 1,
          name: 'Tamu 1',
          group: 'VIP',
          degree: '',
          phoneNumber: '081',
          rsvpStatus: 'hadir',
          checkedInAt: checkInTime,
        },
      ]);

      const summary = await service.getCheckInSummary(5, 42);

      expect(summary.totalGuests).toBe(100);
      expect(summary.totalCheckedIn).toBe(25);
      expect(summary.percentage).toBe(25);
      expect(summary.recentCheckIns).toHaveLength(1);
      expect(summary.recentCheckIns[0].name).toBe('Tamu 1');
    });

    it('should handle percentage 0 when totalGuests is 0', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 5,
        user: { id: 42 },
      });

      guestRepo.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      guestRepo.find.mockResolvedValue([]);

      const summary = await service.getCheckInSummary(5, 42);

      expect(summary.totalGuests).toBe(0);
      expect(summary.totalCheckedIn).toBe(0);
      expect(summary.percentage).toBe(0);
      expect(summary.recentCheckIns).toEqual([]);
    });
  });

  describe('Guest AccessToken & Privacy Link Generation', () => {
    it('should create guest with secure 24-byte base64url accessToken', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 7,
        user: { id: 10 },
      });

      guestRepo.create.mockImplementation((data: any) => ({
        id: 50,
        ...data,
      }));
      guestRepo.save.mockImplementation(async (g: any) => g);

      const guest = await service.create(
        {
          name: 'Anisa Rahma',
          invitationId: 7,
          slug: 'anisa-rahma',
        },
        10,
      );

      expect(guestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Anisa Rahma',
          slug: 'anisa-rahma',
          accessToken: expect.any(String),
        }),
      );
      expect(guest.accessToken).toBeTruthy();
      expect((guest.accessToken as unknown as string).length).toBeGreaterThan(20);
    });

    it('should backfill missing accessToken in findAllByInvitation', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 8,
        user: { id: 11 },
      });

      const legacyGuest: any = {
        id: 55,
        name: 'Tamu Lama',
        accessToken: null,
      };

      guestRepo.find.mockResolvedValue([legacyGuest]);
      guestRepo.save.mockImplementation(async (g: any) => g);

      const result = await service.findAllByInvitation(8, 11);

      expect(result).toHaveLength(1);
      expect(legacyGuest.accessToken).toBeTruthy();
      expect(typeof legacyGuest.accessToken).toBe('string');
      expect(guestRepo.save).toHaveBeenCalledWith(legacyGuest);
    });

    it('should build private invite URL using accessToken', async () => {
      guestRepo.findOne.mockResolvedValue({
        id: 60,
        name: 'Citra Kirana',
        accessToken: 'private-token-777',
        invitation: {
          slug: 'citra-rezky',
          encryptedGuestName: false,
        },
      });

      const { url } = await service.buildInviteUrlForGuest(60);

      expect(url).toContain('/inv/citra-rezky/private-token-777');
    });

    it('should build WhatsApp link with private accessToken in URL and encoded message', async () => {
      guestRepo.findOne.mockResolvedValue({
        id: 61,
        name: 'Rezky Aditya',
        phoneNumber: '081234567890',
        accessToken: 'private-token-888',
        invitation: {
          slug: 'citra-rezky',
          coupleName: 'Citra & Rezky',
          user: { id: 15 },
        },
      });

      const result = await service.buildWhatsAppLink(61, 15);

      expect(result.url).toContain('/inv/citra-rezky/private-token-888');
      expect(result.waLink).toContain('https://wa.me/6281234567890');
      expect(result.waLink).toContain(encodeURIComponent(result.url));
    });
  });
});
