import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GiftRegistryItem,
  GiftRegistryStatus,
} from './entities/gift-registry-item.entity';
import { Invitation } from '../invitation/invitation.entity';
import { CreateGiftRegistryItemDto } from './dto/create-gift-registry-item.dto';
import { UpdateGiftRegistryItemDto } from './dto/update-gift-registry-item.dto';
import { ClaimGiftRegistryItemDto } from './dto/claim-gift-registry-item.dto';

@Injectable()
export class GiftRegistryService {
  constructor(
    @InjectRepository(GiftRegistryItem)
    private readonly giftRegistryRepo: Repository<GiftRegistryItem>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
  ) {}

  /**
   * Helper to verify that an invitation exists and belongs to the given user.
   */
  private async getOwnedInvitation(
    invitationId: number,
    userId: number,
  ): Promise<Invitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, user: { id: userId } },
    });
    if (!invitation) {
      throw new NotFoundException(
        `Undangan dengan ID ${invitationId} tidak ditemukan atau bukan milik Anda.`,
      );
    }
    return invitation;
  }

  /**
   * Couple (Owner): Add a new gift registry item to an invitation.
   */
  async create(
    invitationId: number,
    dto: CreateGiftRegistryItemDto,
    userId: number,
  ): Promise<GiftRegistryItem> {
    await this.getOwnedInvitation(invitationId, userId);

    const item = this.giftRegistryRepo.create({
      invitationId,
      itemName: dto.itemName.trim(),
      category: dto.category ? dto.category.trim() : 'Lainnya',
      priceEstimate:
        dto.priceEstimate !== undefined && dto.priceEstimate !== null
          ? Math.max(0, Math.round(Number(dto.priceEstimate)))
          : null,
      productUrl: dto.productUrl ? dto.productUrl.trim() : null,
      imageUrl: dto.imageUrl ? dto.imageUrl.trim() : null,
      notes: dto.notes ? dto.notes.trim() : null,
      status: GiftRegistryStatus.AVAILABLE,
    });

    return this.giftRegistryRepo.save(item);
  }

  /**
   * Couple (Owner): Get all wishlist items for their invitation.
   */
  async findAllByInvitation(
    invitationId: number,
    userId: number,
  ): Promise<GiftRegistryItem[]> {
    await this.getOwnedInvitation(invitationId, userId);

    return this.giftRegistryRepo.find({
      where: { invitationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Couple (Owner): Update a wishlist item.
   */
  async update(
    id: string,
    dto: UpdateGiftRegistryItemDto,
    userId: number,
  ): Promise<GiftRegistryItem> {
    const item = await this.giftRegistryRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });

    if (!item) {
      throw new NotFoundException(`Item wishlist tidak ditemukan.`);
    }

    if (item.invitation?.user?.id !== userId) {
      throw new ForbiddenException(`Anda tidak memiliki akses ke item ini.`);
    }

    if (dto.itemName !== undefined) {
      item.itemName = dto.itemName.trim();
    }
    if (dto.category !== undefined) {
      item.category = dto.category ? dto.category.trim() : 'Lainnya';
    }
    if (dto.priceEstimate !== undefined) {
      item.priceEstimate =
        dto.priceEstimate !== null
          ? Math.max(0, Math.round(Number(dto.priceEstimate)))
          : null;
    }
    if (dto.productUrl !== undefined) {
      item.productUrl = dto.productUrl ? dto.productUrl.trim() : null;
    }
    if (dto.imageUrl !== undefined) {
      item.imageUrl = dto.imageUrl ? dto.imageUrl.trim() : null;
    }
    if (dto.notes !== undefined) {
      item.notes = dto.notes ? dto.notes.trim() : null;
    }

    return this.giftRegistryRepo.save(item);
  }

  /**
   * Couple (Owner): Remove a wishlist item.
   */
  async remove(id: string, userId: number): Promise<{ success: boolean; message: string }> {
    const item = await this.giftRegistryRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });

    if (!item) {
      throw new NotFoundException(`Item wishlist tidak ditemukan.`);
    }

    if (item.invitation?.user?.id !== userId) {
      throw new ForbiddenException(`Anda tidak memiliki akses ke item ini.`);
    }

    await this.giftRegistryRepo.remove(item);
    return { success: true, message: 'Item wishlist berhasil dihapus.' };
  }

  /**
   * Couple (Owner): Reset/unclaim an item so other guests can claim it again.
   */
  async unclaim(id: string, userId: number): Promise<GiftRegistryItem> {
    const item = await this.giftRegistryRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });

    if (!item) {
      throw new NotFoundException(`Item wishlist tidak ditemukan.`);
    }

    if (item.invitation?.user?.id !== userId) {
      throw new ForbiddenException(`Anda tidak memiliki akses ke item ini.`);
    }

    item.status = GiftRegistryStatus.AVAILABLE;
    item.claimedByGuestName = null;
    item.claimedByPhone = null;
    item.claimedAt = null;

    return this.giftRegistryRepo.save(item);
  }

  /**
   * Public (Guests): Get public wishlist items by invitation ID.
   */
  async findPublicByInvitationId(invitationId: number): Promise<GiftRegistryItem[]> {
    return this.giftRegistryRepo.find({
      where: { invitationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Public (Guests): Get public wishlist items by invitation slug.
   */
  async findPublicBySlug(slug: string): Promise<GiftRegistryItem[]> {
    const invitation = await this.invitationRepo.findOne({
      where: { slug: slug.toLowerCase() },
      select: ['id', 'slug', 'title'],
    });

    if (!invitation) {
      throw new NotFoundException(`Undangan dengan slug "${slug}" tidak ditemukan.`);
    }

    return this.findPublicByInvitationId(invitation.id);
  }

  /**
   * Public (Guests): Claim a wishlist item (Anti-Kado Kembar).
   * Validates that the item is currently AVAILABLE before claiming.
   */
  async claim(id: string, dto: ClaimGiftRegistryItemDto): Promise<GiftRegistryItem> {
    const item = await this.giftRegistryRepo.findOne({ where: { id } });

    if (!item) {
      throw new NotFoundException(`Item kado impian tidak ditemukan.`);
    }

    if (item.status === GiftRegistryStatus.CLAIMED) {
      throw new BadRequestException(
        `Kado ini sudah diklaim oleh tamu lain (${item.claimedByGuestName || 'Tamu'}). Silakan pilih kado lain yang masih tersedia.`,
      );
    }

    item.status = GiftRegistryStatus.CLAIMED;
    item.claimedByGuestName = dto.guestName.trim();
    item.claimedByPhone = dto.phoneNumber ? dto.phoneNumber.trim() : null;
    item.claimedAt = new Date();
    if (dto.notes) {
      item.notes = dto.notes.trim();
    }

    return this.giftRegistryRepo.save(item);
  }
}
