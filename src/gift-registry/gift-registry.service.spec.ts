import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  GiftRegistryService,
} from './gift-registry.service';
import {
  GiftRegistryItem,
  GiftRegistryStatus,
} from './entities/gift-registry-item.entity';
import { Invitation } from '../invitation/invitation.entity';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('GiftRegistryService', () => {
  let service: GiftRegistryService;
  let giftRegistryRepo: any;
  let invitationRepo: any;

  beforeEach(async () => {
    giftRegistryRepo = {
      create: jest.fn((data) => ({ id: 'mock-uuid-1', ...data })),
      save: jest.fn(async (item) => ({ id: item.id || 'mock-uuid-1', ...item })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      remove: jest.fn(async (item) => item),
    };

    invitationRepo = {
      findOne: jest.fn(async () => null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftRegistryService,
        {
          provide: getRepositoryToken(GiftRegistryItem),
          useValue: giftRegistryRepo,
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: invitationRepo,
        },
      ],
    }).compile();

    service = module.get<GiftRegistryService>(GiftRegistryService);
  });

  describe('create', () => {
    it('creates an item when user owns the invitation', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({ id: 1, user: { id: 10 } });

      const dto = {
        itemName: 'Air Fryer Philips HD9252',
        category: 'Dapur',
        priceEstimate: 1200000,
        productUrl: 'https://shopee.co.id/item-123',
        notes: 'Warna hitam kalau ada',
      };

      const result = await service.create(1, dto, 10);

      expect(invitationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, user: { id: 10 } },
      });
      expect(giftRegistryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invitationId: 1,
          itemName: 'Air Fryer Philips HD9252',
          category: 'Dapur',
          priceEstimate: 1200000,
          status: GiftRegistryStatus.AVAILABLE,
        }),
      );
      expect(result.status).toBe(GiftRegistryStatus.AVAILABLE);
    });

    it('throws NotFoundException if invitation is not owned by user', async () => {
      invitationRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(99, { itemName: 'Sofa' }, 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByInvitation', () => {
    it('returns items ordered by createdAt DESC', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({ id: 1, user: { id: 10 } });
      const mockList = [
        { id: '1', itemName: 'Kulkas 2 Pintu', status: GiftRegistryStatus.AVAILABLE },
        { id: '2', itemName: 'Blender', status: GiftRegistryStatus.CLAIMED },
      ];
      giftRegistryRepo.find.mockResolvedValueOnce(mockList);

      const result = await service.findAllByInvitation(1, 10);

      expect(result).toHaveLength(2);
      expect(giftRegistryRepo.find).toHaveBeenCalledWith({
        where: { invitationId: 1 },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('update', () => {
    it('updates item when owned by user', async () => {
      const mockItem = {
        id: 'mock-1',
        itemName: 'Microwave',
        priceEstimate: 1000000,
        invitation: { id: 1, user: { id: 10 } },
      };
      giftRegistryRepo.findOne.mockResolvedValueOnce(mockItem);

      const result = await service.update(
        'mock-1',
        { itemName: 'Microwave Digital 23L', priceEstimate: 1300000 },
        10,
      );

      expect(result.itemName).toBe('Microwave Digital 23L');
      expect(result.priceEstimate).toBe(1300000);
      expect(giftRegistryRepo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException if item belongs to different user', async () => {
      const mockItem = {
        id: 'mock-1',
        invitation: { id: 1, user: { id: 99 } },
      };
      giftRegistryRepo.findOne.mockResolvedValueOnce(mockItem);

      await expect(
        service.update('mock-1', { itemName: 'Beda User' }, 10),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('claim & unclaim (Anti-Kado Kembar)', () => {
    it('claims an available item successfully and sets status to CLAIMED', async () => {
      const mockItem = {
        id: 'item-free',
        itemName: 'Set Cangkir Keramik',
        status: GiftRegistryStatus.AVAILABLE,
        claimedByGuestName: null,
      };
      giftRegistryRepo.findOne.mockResolvedValueOnce(mockItem);

      const claimDto = {
        guestName: 'Budi Santoso',
        phoneNumber: '08123456789',
        notes: 'Semoga suka ya kado dari kami!',
      };

      const result = await service.claim('item-free', claimDto);

      expect(result.status).toBe(GiftRegistryStatus.CLAIMED);
      expect(result.claimedByGuestName).toBe('Budi Santoso');
      expect(result.claimedByPhone).toBe('08123456789');
      expect(result.notes).toBe('Semoga suka ya kado dari kami!');
      expect(giftRegistryRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException if item is ALREADY CLAIMED to prevent double-claiming race condition', async () => {
      const mockClaimedItem = {
        id: 'item-already-claimed',
        itemName: 'Robot Vacuum',
        status: GiftRegistryStatus.CLAIMED,
        claimedByGuestName: 'Dian Permata',
      };
      giftRegistryRepo.findOne.mockResolvedValueOnce(mockClaimedItem);

      await expect(
        service.claim('item-already-claimed', { guestName: 'Rian' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('unclaim resets status back to AVAILABLE and clears claimer info', async () => {
      const mockClaimedItem = {
        id: 'item-reset',
        status: GiftRegistryStatus.CLAIMED,
        claimedByGuestName: 'Dian Permata',
        claimedByPhone: '0812999',
        claimedAt: new Date(),
        invitation: { id: 1, user: { id: 10 } },
      };
      giftRegistryRepo.findOne.mockResolvedValueOnce(mockClaimedItem);

      const result = await service.unclaim('item-reset', 10);

      expect(result.status).toBe(GiftRegistryStatus.AVAILABLE);
      expect(result.claimedByGuestName).toBeNull();
      expect(result.claimedByPhone).toBeNull();
      expect(result.claimedAt).toBeNull();
      expect(giftRegistryRepo.save).toHaveBeenCalled();
    });
  });

  describe('findPublicBySlug', () => {
    it('looks up invitation by slug and returns wishlist items', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 77,
        slug: 'dimas-rara',
        title: 'Dimas & Rara',
      });

      const mockItems = [
        { id: '1', itemName: 'Toaster', status: GiftRegistryStatus.AVAILABLE },
      ];
      giftRegistryRepo.find.mockResolvedValueOnce(mockItems);

      const result = await service.findPublicBySlug('dimas-rara');

      expect(invitationRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'dimas-rara' },
        select: ['id', 'slug', 'title'],
      });
      expect(result).toEqual(mockItems);
    });

    it('throws NotFoundException if slug not found', async () => {
      invitationRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findPublicBySlug('slug-tidak-ada')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
