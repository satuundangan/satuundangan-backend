import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Guest } from './guest.entity';
import { Invitation } from '../../invitation/invitation.entity';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
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
      accessToken: this.createAccessToken(),
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

  async importFromExcel(
    filepath: string,
    userId: number,
    fallbackInvitationId?: number,
  ): Promise<Guest[]> {
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
    const usedSlugsInBatch: string[] = [];

    for (const row of rows) {
      if (typeof row !== 'object' || row === null) {
        console.warn('Skipping non-object row:', row);
        continue;
      }

      // Normalized field helper
      const getVal = (possibleKeys: string[]) => {
        for (const key of possibleKeys) {
          if (row[key] !== undefined) return row[key];
        }
        return '';
      };

      const name = (getVal(['Name', 'Nama', 'nama']) || '').toString();
      const degree = (getVal(['Degree', 'Gelar', 'gelar']) || '').toString();
      const phoneNumber = (
        getVal(['Phone Number', 'Phone', 'Telepon', 'Nomor HP', 'wa']) || ''
      ).toString();
      const rawSlug = (getVal(['Slug', 'slug']) || '').toString().trim();

      const rowInvId = Number(getVal(['Invitation ID', 'ID Undangan']));
      const invitationId =
        !isNaN(rowInvId) && rowInvId > 0 ? rowInvId : fallbackInvitationId;

      if (!name || !invitationId) {
        console.warn(
          `Skipping row due to missing required data: Name="${name}", InvitationID="${invitationId}"`,
          row,
        );
        continue;
      }

      // Validate invitation ownership
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
        rawSlug ||
        (await this.generateUniqueSlug(name, invitationId, usedSlugsInBatch));
      usedSlugsInBatch.push(slug);

      const group = (getVal(['Group', 'Kategori', 'grup']) || '').toString();
      const statusSend = (getVal(['Status Send']) || '').toString();
      const rsvpStatus = (getVal(['RSVP Status']) || 'belum').toString();

      const guest = this.guestRepo.create({
        name,
        degree,
        phoneNumber,
        slug,
        group,
        statusSend,
        rsvpStatus,
        invitation,
      });

      guestsToSave.push(guest);
    }

    return this.guestRepo.save(guestsToSave);
  }

  async generateUniqueSlug(
    name: string,
    invitationId: number,
    existingInBatch: string[] = [],
  ): Promise<string> {
    const baseSlug = slugify(name.toLowerCase());

    let slug = baseSlug;
    let counter = 1;

    const isUsed = async (s: string) => {
      if (existingInBatch.includes(s)) return true;
      return !!(await this.guestRepo.findOne({
        where: {
          slug: s,
          invitation: { id: invitationId },
        },
      }));
    };

    while (await isUsed(slug)) {
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
    await this.ensureAccessToken(guest);
    const base = process.env.FRONTEND_URL || 'https://satuundangan.id';
    const invitationSlug = guest.invitation?.slug;
    if (!invitationSlug) throw new NotFoundException('Invitation slug missing');

    let url = `${base.replace(/\/$/, '')}/inv/${invitationSlug}/${guest.accessToken}`;
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

    await this.ensureAccessToken(guest);

    const base = process.env.FRONTEND_URL || 'https://satuundangan.id';
    let url = `${base.replace(/\/$/, '')}/inv/${guest.invitation.slug}/${guest.accessToken}`;

    if (guest.invitation.encryptedGuestName) {
      const encoded = Buffer.from(guest.name, 'utf-8').toString('base64');
      url += `?e=${encodeURIComponent(encoded)}`;
    }

    let message = '';
    const template = guest.invitation.whatsappMessageTemplate;
    const groomName = guest.invitation.groomName || '';
    const brideName = guest.invitation.brideName || '';
    const coupleName = guest.invitation.coupleName || `${groomName} & ${brideName}`;

    if (template) {
      message = template
        .replace(/\[GuestName\]/g, guest.name)
        .replace(/\[GroomName\]/g, groomName)
        .replace(/\[BrideName\]/g, brideName)
        .replace(/\[CoupleName\]/g, coupleName)
        .replace(/\[Link\]/g, url);
    } else {
      message = `Assalamu'alaikum Wr. Wb.\n\nYth. *${guest.name}*\n\nTanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami:\n\n*${coupleName}*\n\nMerupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan memberikan doa restu kepada kami.\n\nDetail Undangan:\n${url}\n\nAtas perhatian dan doa restunya, kami ucapkan terima kasih.\n\nWassalamu'alaikum Wr. Wb.\n\nKami yang berbahagia,\n*${coupleName}*`;
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
    const guest = await this.guestRepo.findOne({
      where: { id: Number(id) },
      relations: ['invitation'],
    });
    if (!guest) throw new NotFoundException('Guest not found');

    return this.processCheckIn(guest);
  }

  async checkInByToken(tokenOrUrlOrPayload: string | any) {
    const token = this.extractToken(tokenOrUrlOrPayload);
    if (!token) {
      throw new NotFoundException('Tiket QR atau tamu tidak ditemukan');
    }

    const guest = await this.guestRepo.findOne({
      where: { accessToken: token },
      relations: ['invitation'],
    });

    if (!guest) {
      throw new NotFoundException('Tiket QR atau tamu tidak ditemukan');
    }

    return this.processCheckIn(guest);
  }

  async getCheckInSummary(invitationId: number, userId: number) {
    const invId = Number(invitationId);
    const uId = Number(userId);

    const invitation = await this.invitationRepo.findOne({
      where: { id: invId },
      relations: ['user'],
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invId} not found`);
    }

    if (invitation.user?.id !== uId) {
      throw new ForbiddenException('You do not have access to this invitation');
    }

    const totalGuests = await this.guestRepo.count({
      where: { invitation: { id: invId } },
    });

    const totalCheckedIn = await this.guestRepo.count({
      where: {
        invitation: { id: invId },
        checkedInAt: Not(IsNull()),
      },
    });

    const percentage =
      totalGuests > 0
        ? Math.round((totalCheckedIn / totalGuests) * 10000) / 100
        : 0;

    const recentGuests = await this.guestRepo.find({
      where: {
        invitation: { id: invId },
        checkedInAt: Not(IsNull()),
      },
      order: { checkedInAt: 'DESC' },
      take: 20,
    });

    const recentCheckIns = recentGuests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      group: guest.group,
      degree: guest.degree,
      phoneNumber: guest.phoneNumber,
      rsvpStatus: guest.rsvpStatus,
      checkedInAt: guest.checkedInAt,
    }));

    return {
      totalGuests,
      totalCheckedIn,
      percentage,
      recentCheckIns,
    };
  }

  private async processCheckIn(guest: Guest) {
    if (guest.checkedInAt) {
      return {
        success: true,
        alreadyCheckedIn: true,
        message: 'Tamu sudah pernah check-in sebelumnya',
        check_in_time: guest.checkedInAt,
        guest: {
          id: guest.id,
          name: guest.name,
          group: guest.group,
          degree: guest.degree,
          phoneNumber: guest.phoneNumber,
          rsvpStatus: guest.rsvpStatus,
          checkedInAt: guest.checkedInAt,
        },
      };
    }

    guest.checkedInAt = new Date();
    await this.guestRepo.save(guest);

    return {
      success: true,
      alreadyCheckedIn: false,
      message: `Tamu ${guest.name} berhasil Check-in`,
      check_in_time: guest.checkedInAt,
      guest: {
        id: guest.id,
        name: guest.name,
        group: guest.group,
        degree: guest.degree,
        phoneNumber: guest.phoneNumber,
        rsvpStatus: guest.rsvpStatus,
        checkedInAt: guest.checkedInAt,
      },
    };
  }

  private extractToken(raw: any): string {
    if (!raw) return '';

    let input = raw;
    if (typeof input === 'object' && input !== null) {
      input = input.token || input.accessToken || input.code || '';
    }

    if (typeof input !== 'string') {
      input = String(input);
    }

    input = input.trim();

    // Check if JSON payload string
    if (input.startsWith('{') && input.endsWith('}')) {
      try {
        const parsed = JSON.parse(input);
        if (parsed && typeof parsed === 'object') {
          const candidate = parsed.token || parsed.accessToken || parsed.code;
          if (candidate && typeof candidate === 'string') {
            input = candidate.trim();
          }
        }
      } catch {
        // Continue if parse fails
      }
    }

    // Strip query parameters and fragment
    input = input.split('?')[0].split('#')[0].trim();

    // Check if full invitation URL e.g. https://.../inv/slug/token
    if (input.includes('/inv/')) {
      const parts = input.split('/inv/')[1].split('/').filter(Boolean);
      if (parts.length >= 2) {
        return parts[1];
      } else if (parts.length === 1) {
        return parts[0];
      }
    }

    // Check if standard URL ending with token
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const parts = input.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }

    return input;
  }

  private createAccessToken(): string {
    return randomBytes(24).toString('base64url');
  }

  private async ensureAccessToken(guest: Guest): Promise<void> {
    if (guest.accessToken) return;
    guest.accessToken = this.createAccessToken();
    await this.guestRepo.save(guest);
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
