import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invitation, InvitationPackage } from './invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationActivity, ActivityAction } from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('InvitationService', () => {
  let service: InvitationService;
  let invitationRepo: any;
  let guestRepo: any;
  let activityRepo: any;
  let templateRepo: any;
  let userRepo: any;

  beforeEach(async () => {
    invitationRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      increment: jest.fn().mockResolvedValue(true),
    };

    guestRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (g) => g),
    };

    activityRepo = {
      create: jest.fn().mockImplementation((a) => a),
      save: jest.fn().mockResolvedValue(true),
    };

    templateRepo = {
      findOne: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: getRepositoryToken(Invitation), useValue: invitationRepo },
        { provide: getRepositoryToken(Guest), useValue: guestRepo },
        { provide: getRepositoryToken(InvitationActivity), useValue: activityRepo },
        { provide: getRepositoryToken(TemplateDesign), useValue: templateRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBySlug (Public vs Private Access)', () => {
    it('should throw NotFoundException if invitation does not exist', async () => {
      invitationRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if invitation is not published', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 1,
        slug: 'unpublished-inv',
        isPublished: false,
        isGuestPublic: true,
      });

      await expect(service.findBySlug('unpublished-inv')).rejects.toThrow(
        new ForbiddenException('Undangan belum dipublikasikan'),
      );
    });

    it('should throw 403 Forbidden with Indonesian message if isGuestPublic is false', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 2,
        slug: 'private-inv',
        isPublished: true,
        isGuestPublic: false,
      });

      await expect(service.findBySlug('private-inv')).rejects.toThrow(
        new ForbiddenException(
          'Undangan ini privat. Gunakan link undangan khusus dari pemilik.',
        ),
      );
    });

    it('should return invitation data when isGuestPublic is true and published', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 3,
        slug: 'public-wedding',
        title: 'Public Wedding',
        isPublished: true,
        isGuestPublic: true,
        package: InvitationPackage.BASIC,
        templateDesign: { slug: 'dark-elegant', price: 0 },
      });

      const result = await service.findBySlug('public-wedding');

      expect(result).toBeDefined();
      expect(result.slug).toBe('public-wedding');
      expect(invitationRepo.increment).toHaveBeenCalledWith(
        { id: 3 },
        'views',
        1,
      );
      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityAction.VIEW,
          guestName: null,
        }),
      );
    });
  });

  describe('findWithGuest (Guest Access Token vs Slug)', () => {
    it('should throw NotFoundException if invitation does not exist', async () => {
      invitationRepo.findOne.mockResolvedValue(null);

      await expect(service.findWithGuest('slug', 'token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if invitation is not published', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 10,
        slug: 'slug',
        isPublished: false,
        guests: [],
      });

      await expect(service.findWithGuest('slug', 'token')).rejects.toThrow(
        new ForbiddenException('Undangan belum dipublikasikan'),
      );
    });

    it('should grant access and return 200 when guestSlug matches accessToken on private invitation', async () => {
      const mockGuest = {
        id: 101,
        name: 'Raden Budi',
        slug: 'raden-budi',
        accessToken: 'secure-token-xyz-12345678',
        group: 'VIP',
        degree: 'S.T.',
        visitCount: 0,
        firstVisitAt: null,
      };

      invitationRepo.findOne.mockResolvedValue({
        id: 20,
        slug: 'private-inv',
        title: 'The Wedding of Romeo & Juliet',
        isPublished: true,
        isGuestPublic: false,
        package: InvitationPackage.PREMIUM,
        guests: [mockGuest],
      });

      const result = await service.findWithGuest(
        'private-inv',
        'secure-token-xyz-12345678',
      );

      expect(result).toBeDefined();
      expect(result.invitation.slug).toBe('private-inv');
      expect(result.guest.name).toBe('Raden Budi');
      expect(result.guest.slug).toBe('raden-budi');
      expect(result.guest.accessToken).toBe('secure-token-xyz-12345678');
      expect(mockGuest.visitCount).toBe(1);
      expect(mockGuest.firstVisitAt).toBeInstanceOf(Date);
      expect(guestRepo.save).toHaveBeenCalledWith(mockGuest);
      expect(invitationRepo.increment).toHaveBeenCalledWith(
        { id: 20 },
        'views',
        1,
      );
      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityAction.VIEW,
          guestName: 'Raden Budi',
        }),
      );
    });

    it('should throw NotFoundException when isGuestPublic is false and guestSlug is raw slug (not accessToken)', async () => {
      const mockGuest = {
        id: 102,
        name: 'Siti Sarah',
        slug: 'siti-sarah',
        accessToken: 'secret-token-abc-999',
      };

      invitationRepo.findOne.mockResolvedValue({
        id: 21,
        slug: 'private-inv',
        isPublished: true,
        isGuestPublic: false,
        guests: [mockGuest],
      });

      // User tries to access with readable slug instead of secret accessToken
      await expect(
        service.findWithGuest('private-inv', 'siti-sarah'),
      ).rejects.toThrow(new NotFoundException('Guest not found'));
    });

    it('should grant access when isGuestPublic is true and guestSlug is raw slug', async () => {
      const mockGuest = {
        id: 103,
        name: 'Ahmad Dahlan',
        slug: 'ahmad-dahlan',
        accessToken: 'token-dahlan',
        visitCount: 2,
        firstVisitAt: new Date('2026-01-01'),
      };

      invitationRepo.findOne.mockResolvedValue({
        id: 22,
        slug: 'public-inv',
        isPublished: true,
        isGuestPublic: true,
        guests: [mockGuest],
      });

      const result = await service.findWithGuest('public-inv', 'ahmad-dahlan');

      expect(result).toBeDefined();
      expect(result.guest.name).toBe('Ahmad Dahlan');
      expect(mockGuest.visitCount).toBe(3);
    });

    it('should lazily generate accessToken if guest has none on access', async () => {
      const mockGuest = {
        id: 104,
        name: 'Tamu Legacy',
        slug: 'tamu-legacy',
        accessToken: null,
        visitCount: 0,
        firstVisitAt: null,
      };

      invitationRepo.findOne.mockResolvedValue({
        id: 23,
        slug: 'public-inv',
        isPublished: true,
        isGuestPublic: true,
        guests: [mockGuest],
      });

      const result = await service.findWithGuest('public-inv', 'tamu-legacy');

      expect(result).toBeDefined();
      expect(mockGuest.accessToken).toBeTruthy();
      expect(typeof mockGuest.accessToken).toBe('string');
      expect((mockGuest.accessToken as unknown as string).length).toBeGreaterThan(16);
      expect(guestRepo.save).toHaveBeenCalled();
    });
  });
});
