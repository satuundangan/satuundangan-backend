import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest } from './guest.entity';
import { Invitation } from '../../invitation/invitation.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { slugify } from 'transliteration';

@Injectable()
export class GuestService {
  constructor(
    @InjectRepository(Guest)
    private readonly guestRepo: Repository<Guest>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
  ) {}

  async create(dto: CreateGuestDto, userId: number): Promise<Guest> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: dto.invitationId, user: { id: userId } },
    });

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID ${dto.invitationId} not found or not owned by you.`,
      );
    }

    const slug =
      dto.slug && dto.slug.trim().length > 0
        ? dto.slug
        : await this.generateUniqueSlug(dto.name, dto.invitationId);

    const guest = this.guestRepo.create({
      name: dto.name,
      degree: dto.degree,
      phoneNumber: dto.phoneNumber,
      slug,
      group: dto.group,
      statusSend: dto.statusSend,
      rsvpStatus: dto.rsvpStatus ?? 'belum',
      invitation,
    });

    return this.guestRepo.save(guest);
  }

  async findAllByInvitation(
    invitationId: number,
    userId: number,
  ): Promise<Guest[]> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, user: { id: userId } },
    });
    if (!invitation)
      throw new ForbiddenException('You do not have access to this invitation');

    return this.guestRepo.find({
      where: { invitation: { id: invitationId } },
      order: { id: 'ASC' },
    });
  }

  async update(
    id: number,
    dto: UpdateGuestDto,
    userId: number,
  ): Promise<Guest> {
    const guest = await this.guestRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });
    if (!guest) {
      throw new NotFoundException(`Guest with ID ${id} not found.`);
    }
    if (guest.invitation.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this guest',
      );
    }

    Object.assign(guest, dto);

    return this.guestRepo.save(guest);
  }

  async remove(id: number, userId: number): Promise<void> {
    const guest = await this.guestRepo.findOne({
      where: { id },
      relations: ['invitation', 'invitation.user'],
    });
    if (!guest) {
      throw new NotFoundException(`Guest with ID ${id} not found.`);
    }
    if (guest.invitation.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this guest',
      );
    }

    await this.guestRepo.remove(guest);
  }

  async importFromExcel(filepath: string, userId: number): Promise<Guest[]> {
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filepath);
    } catch (error) {
      throw new Error(
        `Failed to read Excel file at ${filepath}. Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const workbook = xlsx.read(buffer, { type: 'buffer' });

    if (workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in the Excel workbook.');
    }

    const sheetName: string = workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found in the workbook.`);
    }

    const rows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(sheet);

    const guestsToSave: Guest[] = [];

    for (const row of rows) {
      if (typeof row !== 'object' || row === null) {
        console.warn('Skipping non-object row:', row);
        continue;
      }

      const name = ((row['Name'] as string) || '').toString();
      const degree = ((row['Degree'] as string) || '').toString();
      const phoneNumber = ((row['Phone Number'] as string) || '').toString();
      const rawSlug = ((row['Slug'] as string) || '').toString().trim();
      const invitationId = Number(row['Invitation ID']);

      // Validate invitation ownership for each row
      const invitation = await this.invitationRepo.findOne({
        where: { id: invitationId, user: { id: userId } },
      });
      if (!invitation) {
        console.warn(
          `Skipping row: Invitation ${invitationId} not found or not owned by user ${userId}`,
        );
        continue;
      }

      const slug =
        rawSlug || (await this.generateUniqueSlug(name, invitationId));
      const group = ((row['Group'] as string) || '').toString();
      const statusSend = ((row['Status Send'] as string) || '').toString();
      const rsvpStatus = ((row['RSVP Status'] as string) || 'belum').toString();

      if (!name || isNaN(invitationId) || !slug) {
        console.warn(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Skipping row due to missing or invalid required data: Name="${name}", Invitation ID="${row['Invitation ID']}", Slug="${slug}"`,
          row,
        );
        continue;
      }

      const guest = this.guestRepo.create({
        name,
        degree,
        phoneNumber,
        slug,
        group,
        statusSend,
        rsvpStatus,
        invitation: { id: invitationId } as Invitation,
      });

      guestsToSave.push(guest);
    }

    return this.guestRepo.save(guestsToSave);
  }

  async generateUniqueSlug(
    name: string,
    invitationId: number,
  ): Promise<string> {
    const baseSlug = slugify(name.toLowerCase());

    let slug = baseSlug;
    let counter = 1;

    while (
      await this.guestRepo.findOne({
        where: {
          slug,
          invitation: { id: invitationId },
        },
      })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    return slug;
  }

  async buildInviteUrlForGuest(guestId: number): Promise<{ url: string }> {
    const guest = await this.guestRepo.findOne({
      where: { id: guestId },
      relations: ['invitation'],
    });
    if (!guest) throw new NotFoundException('Guest not found');
    const base = process.env.FRONTEND_URL || 'https://satuundangan.id';
    const invitationSlug = guest.invitation?.slug;
    if (!invitationSlug) throw new NotFoundException('Invitation slug missing');

    let url = `${base.replace(/\/$/, '')}/inv/${invitationSlug}/${guest.slug}`;
    if (guest.invitation.encryptedGuestName) {
      const encoded = Buffer.from(guest.name, 'utf-8').toString('base64');
      url += `?e=${encodeURIComponent(encoded)}`;
    }
    return { url };
  }

  async buildWhatsAppLink(
    guestId: number,
    userId: number,
  ): Promise<{ url: string; waLink: string; message: string }> {
    const guest = await this.guestRepo.findOne({
      where: { id: guestId },
      relations: ['invitation', 'invitation.user'],
    });

    if (!guest) throw new NotFoundException('Guest not found');
    if (!guest.invitation) throw new NotFoundException('Invitation not found');
    if (guest.invitation.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this guest',
      );
    }

    const base = process.env.FRONTEND_URL || 'https://satuundangan.id';
    let url = `${base.replace(/\/$/, '')}/inv/${guest.invitation.slug}/${guest.slug}`;

    if (guest.invitation.encryptedGuestName) {
      const encoded = Buffer.from(guest.name, 'utf-8').toString('base64');
      url += `?e=${encodeURIComponent(encoded)}`;
    }

    let message = '';
    const template = guest.invitation.whatsappMessageTemplate;

    if (template) {
      message = template
        .replace(/\[GuestName\]/g, guest.name)
        .replace(/\[Link\]/g, url);
    } else {
      const name = guest.name?.split(' ')[0] || 'Teman';
      message = `Hai ${name}! Ini undangan pernikahan kami 🎉\nKlik untuk lihat: ${url}`;
    }

    const phone = (guest.phoneNumber || '').replace(/[^0-9]/g, '');
    const waNumber = phone.startsWith('0')
      ? `62${phone.slice(1)}`
      : phone.startsWith('62')
        ? phone
        : phone;

    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    return { url, waLink, message };
  }

  async checkIn(id: number) {
    const guest = await this.guestRepo.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');

    guest.checkedInAt = new Date();
    await this.guestRepo.save(guest);

    return {
      success: true,
      message: `Tamu ${guest.name} berhasil Check-in`,
      check_in_time: guest.checkedInAt,
    };
  }

  async findAllByInvitationWithMessages(
    invitationId: number,
    userId: number,
  ): Promise<
    {
      id: number;
      name: string;
      phoneNumber: string;
      slug: string;
      rsvpStatus: string;
      firstVisitAt: Date | null;
      lastMessage?: string | null;
      checkedInAt?: Date | null;
    }[]
  > {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, user: { id: userId } },
    });
    if (!invitation)
      throw new ForbiddenException('You do not have access to this invitation');

    const guests = await this.guestRepo.find({
      where: { invitation: { id: invitationId } },
      relations: ['messages'],
      order: { id: 'ASC' },
    });

    return guests.map((g) => ({
      id: g.id,
      name: g.name,
      phoneNumber: g.phoneNumber,
      slug: g.slug,
      rsvpStatus: g.rsvpStatus,
      firstVisitAt: g.firstVisitAt ?? null,
      checkedInAt: g.checkedInAt ?? null,
      lastMessage:
        g.messages && g.messages.length > 0
          ? g.messages.sort(
              (a, b) =>
                (b.createdAt?.getTime?.() || 0) -
                (a.createdAt?.getTime?.() || 0),
            )[0].message
          : null,
    }));
  }
}
