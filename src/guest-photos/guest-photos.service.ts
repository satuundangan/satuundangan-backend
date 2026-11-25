import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestPhoto } from './entities/guest-photo.entity';
import { Invitation } from '../invitation/invitation.entity';
import { UploadService } from '../modules/upload/upload.service';

@Injectable()
export class GuestPhotosService {
  private readonly logger = new Logger(GuestPhotosService.name);

  constructor(
    @InjectRepository(GuestPhoto)
    private readonly guestPhotoRepo: Repository<GuestPhoto>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    private readonly uploadService: UploadService,
  ) {}

  private async verifyOwnership(invitationId: number, userId: number) {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['user'],
    });
    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }
    if (invitation.user?.id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke undangan ini');
    }
    return invitation;
  }

  async getPublicInfoBySlug(slug: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { slug },
    });
    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }

    const approvedPhotos = await this.guestPhotoRepo.find({
      where: { invitationId: invitation.id, isApproved: true },
      order: { createdAt: 'DESC' },
      take: 24,
    });

    const coupleName =
      invitation.groomName && invitation.brideName
        ? `${invitation.groomName} & ${invitation.brideName}`
        : invitation.title;

    return {
      invitation: {
        id: invitation.id,
        slug: invitation.slug,
        title: invitation.title,
        coupleName,
      },
      photos: approvedPhotos,
    };
  }

  async uploadGuestPhoto(
    slug: string,
    file: Express.Multer.File,
    body: { guestName?: string; caption?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File foto wajib diunggah');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('File harus berupa gambar (JPG, PNG, atau WebP)');
    }

    const invitation = await this.invitationRepo.findOne({
      where: { slug },
    });
    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }

    const guestName = String(body?.guestName || '').trim().slice(0, 120) || 'Tamu Undangan';
    const captionRaw = String(body?.caption || '').trim().slice(0, 280);
    const caption = captionRaw.length > 0 ? captionRaw : null;

    const uploaded = await this.uploadService.uploadFile(file);

    const entity = this.guestPhotoRepo.create({
      invitationId: invitation.id,
      guestName,
      photoUrl: uploaded.fileUrl,
      thumbnailUrl: uploaded.thumbnailUrl ?? null,
      caption,
      isApproved: true,
    });

    return this.guestPhotoRepo.save(entity);
  }

  async getLiveFeedBySlug(slug: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { slug },
    });
    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }

    const photos = await this.guestPhotoRepo.find({
      where: { invitationId: invitation.id, isApproved: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return { photos };
  }

  async getOwnerPhotos(invitationId: number, userId: number) {
    await this.verifyOwnership(invitationId, userId);
    return this.guestPhotoRepo.find({
      where: { invitationId },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleApproval(id: string, userId: number, isApproved: boolean) {
    const photo = await this.guestPhotoRepo.findOne({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Foto tamu tidak ditemukan');
    }
    await this.verifyOwnership(photo.invitationId, userId);

    photo.isApproved = Boolean(isApproved);
    return this.guestPhotoRepo.save(photo);
  }

  async deletePhoto(id: string, userId: number) {
    const photo = await this.guestPhotoRepo.findOne({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Foto tamu tidak ditemukan');
    }
    await this.verifyOwnership(photo.invitationId, userId);

    try {
      await this.uploadService.deleteFile(photo.photoUrl);
    } catch (err) {
      this.logger.warn(
        `Failed to delete photo file from storage (${photo.photoUrl}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.guestPhotoRepo.remove(photo);
    return { deleted: true, id };
  }
}
