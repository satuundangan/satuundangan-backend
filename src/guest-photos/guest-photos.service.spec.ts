import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GuestPhotosService } from './guest-photos.service';
import { GuestPhoto } from './entities/guest-photo.entity';
import { Invitation } from '../invitation/invitation.entity';
import { UploadService } from '../modules/upload/upload.service';

describe('GuestPhotosService (SAT-69)', () => {
  let service: GuestPhotosService;

  const mockGuestPhotoRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockInvitationRepo = {
    findOne: jest.fn(),
  };

  const mockUploadService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestPhotosService,
        {
          provide: getRepositoryToken(GuestPhoto),
          useValue: mockGuestPhotoRepo,
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepo,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get<GuestPhotosService>(GuestPhotosService);
  });

  it('uploads guest photo via UploadService and saves auto-approved GuestPhoto', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      id: 10,
      slug: 'romeo-juliet',
      title: 'The Wedding of Romeo & Juliet',
    });
    mockUploadService.uploadFile.mockResolvedValue({
      fileUrl: 'https://cdn.satuundangan.id/photo.webp',
      thumbnailUrl: 'https://cdn.satuundangan.id/photo-thumb.webp',
    });
    mockGuestPhotoRepo.create.mockImplementation((dto) => dto);
    mockGuestPhotoRepo.save.mockImplementation(async (e) => ({
      id: 'uuid-1',
      ...e,
    }));

    const file = {
      originalname: 'candid.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-img'),
      size: 1024,
    } as Express.Multer.File;

    const result = await service.uploadGuestPhoto('romeo-juliet', file, {
      guestName: 'Andi Pratama',
      caption: 'Momen akad nikah',
    });

    expect(mockUploadService.uploadFile).toHaveBeenCalledWith(file);
    expect(result.invitationId).toBe(10);
    expect(result.guestName).toBe('Andi Pratama');
    expect(result.photoUrl).toBe('https://cdn.satuundangan.id/photo.webp');
    expect(result.thumbnailUrl).toBe('https://cdn.satuundangan.id/photo-thumb.webp');
    expect(result.isApproved).toBe(true);
  });

  it('rejects non-image uploads', async () => {
    const file = {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf'),
      size: 512,
    } as Express.Multer.File;

    await expect(
      service.uploadGuestPhoto('romeo-juliet', file, { guestName: 'Andi' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when slug does not exist on live-feed', async () => {
    mockInvitationRepo.findOne.mockResolvedValue(null);
    await expect(service.getLiveFeedBySlug('unknown-slug')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns only approved photos for live-feed', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({ id: 10, slug: 'romeo-juliet' });
    mockGuestPhotoRepo.find.mockResolvedValue([
      { id: 'p1', guestName: 'Andi', photoUrl: 'https://cdn/1.webp', isApproved: true },
    ]);

    const res = await service.getLiveFeedBySlug('romeo-juliet');
    expect(mockGuestPhotoRepo.find).toHaveBeenCalledWith({
      where: { invitationId: 10, isApproved: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    expect(res.photos).toHaveLength(1);
  });

  it('enforces ownership when toggling approval or deleting photo', async () => {
    mockGuestPhotoRepo.findOne.mockResolvedValue({
      id: 'p1',
      invitationId: 10,
      photoUrl: 'https://cdn/1.webp',
    });
    mockInvitationRepo.findOne.mockResolvedValue({
      id: 10,
      user: { id: 99 },
    });

    await expect(service.toggleApproval('p1', 1, false)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.deletePhoto('p1', 1)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggles approval and deletes storage file when owner matches', async () => {
    const photoRecord = {
      id: 'p1',
      invitationId: 10,
      photoUrl: 'https://cdn/1.webp',
      isApproved: true,
    };
    mockGuestPhotoRepo.findOne.mockResolvedValue(photoRecord);
    mockInvitationRepo.findOne.mockResolvedValue({
      id: 10,
      user: { id: 7 },
    });
    mockGuestPhotoRepo.save.mockImplementation(async (e) => e);
    mockUploadService.deleteFile.mockResolvedValue({ message: 'deleted' });

    const updated = await service.toggleApproval('p1', 7, false);
    expect(updated.isApproved).toBe(false);

    const deleted = await service.deletePhoto('p1', 7);
    expect(mockUploadService.deleteFile).toHaveBeenCalledWith('https://cdn/1.webp');
    expect(mockGuestPhotoRepo.remove).toHaveBeenCalledWith(photoRecord);
    expect(deleted).toEqual({ deleted: true, id: 'p1' });
  });
});
