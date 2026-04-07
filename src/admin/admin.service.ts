import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../user/user.entity';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { TemplateDesignSection } from '../template-design/template-design-section.entity';
import { Category } from '../category/category.entity';
import { Section } from './entities/section.entity';
import { Audio } from './entities/audio.entity';
import { Bank } from './entities/bank.entity';
import { PaletteColor } from './entities/palette-color.entity';
import {
  CreateTemplateDesignDto,
  UpdateTemplateDesignDto,
} from './dto/template-design.dto';
import {
  CreatePaletteColorDto,
  UpdatePaletteColorDto,
} from './dto/palette-color.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    @InjectRepository(GuestMessage)
    private readonly guestMessageRepo: Repository<GuestMessage>,
    @InjectRepository(TemplateDesign)
    private readonly templateDesignRepo: Repository<TemplateDesign>,
    @InjectRepository(TemplateDesignSection)
    private readonly templateDesignSectionRepo: Repository<TemplateDesignSection>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Audio) private readonly audioRepo: Repository<Audio>,
    @InjectRepository(Bank) private readonly bankRepo: Repository<Bank>,
    @InjectRepository(PaletteColor)
    private readonly paletteColorRepo: Repository<PaletteColor>,
  ) {}

  // Users
  async listUsers(page = 1, limit = 20, q?: string) {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { email: ILike(`%${q}%`) }]
      : undefined;
    const [data, total] = await this.userRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getUser(id: number) {
    const found = await this.userRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async createUser(payload: Partial<User> & { password?: string }) {
    if (payload.email) {
      const existing = await this.userRepo.findOne({
        where: { email: payload.email },
      });
      if (existing) throw new BadRequestException('Email already exists');
    }
    const user = this.userRepo.create(payload);
    if (payload.password) {
      user.password = await bcrypt.hash(payload.password, 10);
      user.provider = user.provider || 'local';
    }
    return this.userRepo.save(user);
  }

  async updateUser(id: number, payload: Partial<User> & { password?: string }) {
    const user = await this.getUser(id);
    if (payload.email && payload.email !== user.email) {
      const exists = await this.userRepo.findOne({
        where: { email: payload.email },
      });
      if (exists) throw new BadRequestException('Email already exists');
    }
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
      payload.provider = payload.provider || 'local';
    }
    Object.assign(user, payload);
    return this.userRepo.save(user);
  }

  async deleteUser(id: number) {
    const user = await this.getUser(id);
    await this.userRepo.remove(user);
    return { success: true };
  }

  // Invitations
  async listInvitations(page = 1, limit = 20, q?: string) {
    const where = q
      ? [
          { title: ILike(`%${q}%`) },
          { coupleName: ILike(`%${q}%`) },
          { slug: ILike(`%${q}%`) },
        ]
      : undefined;
    const [data, total] = await this.invitationRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getInvitation(id: number) {
    const found = await this.invitationRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!found) throw new NotFoundException('Invitation not found');
    return found;
  }

  async updateInvitation(id: number, payload: Partial<Invitation>) {
    const inv = await this.getInvitation(id);
    Object.assign(inv, payload);
    return this.invitationRepo.save(inv);
  }

  async deleteInvitation(id: number) {
    const inv = await this.getInvitation(id);
    await this.invitationRepo.remove(inv);
    return { success: true };
  }

  // Guests
  async listGuests(page = 1, limit = 20, q?: string) {
    const where = q
      ? [
          { name: ILike(`%${q}%`) },
          { phoneNumber: ILike(`%${q}%`) },
          { slug: ILike(`%${q}%`) },
        ]
      : undefined;
    const [data, total] = await this.guestRepo.findAndCount({
      where,
      relations: ['invitation'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getGuest(id: number) {
    const found = await this.guestRepo.findOne({
      where: { id },
      relations: ['invitation'],
    });
    if (!found) throw new NotFoundException('Guest not found');
    return found;
  }

  async updateGuest(id: number, payload: Partial<Guest>) {
    const guest = await this.getGuest(id);
    Object.assign(guest, payload);
    return this.guestRepo.save(guest);
  }

  async deleteGuest(id: number) {
    const guest = await this.getGuest(id);
    await this.guestRepo.remove(guest);
    return { success: true };
  }

  // Guest Messages
  async listGuestMessages(page = 1, limit = 20, q?: string) {
    const where = q
      ? [{ guestName: ILike(`%${q}%`) }, { message: ILike(`%${q}%`) }]
      : undefined;
    const [data, total] = await this.guestMessageRepo.findAndCount({
      where,
      relations: ['invitation', 'guest'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async deleteGuestMessage(id: number) {
    const gm = await this.guestMessageRepo.findOne({ where: { id } });
    if (!gm) throw new NotFoundException('Guest message not found');
    await this.guestMessageRepo.remove(gm);
    return { success: true };
  }

  // Template Designs
  async listTemplateDesigns(page = 1, limit = 20, q?: string) {
    const where: any = q
      ? [
          { name: ILike(`%${q}%`) },
          { slug: ILike(`%${q}%`) },
          { category: { name: ILike(`%${q}%`) } },
        ]
      : undefined;
    const [data, total] = await this.templateDesignRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      relations: ['category', 'palette', 'sections', 'sections.section'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((template) => this.transformTemplateDesign(template)),
      total,
      page,
      limit,
    };
  }

  async getTemplateDesign(id: number) {
    const template = await this.templateDesignRepo.findOne({
      where: { id },
      relations: ['category', 'palette', 'sections', 'sections.section'],
    });
    if (!template) throw new NotFoundException('Template design not found');
    return this.transformTemplateDesign(template);
  }

  async createTemplateDesign(payload: CreateTemplateDesignDto) {
    try {
      const { category: categoryName, paletteId, sections, ...rest } = payload;

      const category = await this.categoryRepo.findOne({
        where: { name: categoryName },
      });
      if (!category)
        throw new BadRequestException(`Category '${categoryName}' not found`);

      let palette: PaletteColor | null = null;
      if (paletteId) {
        palette = await this.paletteColorRepo.findOne({
          where: { id: paletteId },
        });
      }

      const data = this.normalizeTemplateDesignPayload(rest);
      const template = this.templateDesignRepo.create({
        ...data,
        category,
        palette,
      });

      const savedTemplate = await this.templateDesignRepo.save(template);

      if (sections && sections.length > 0) {
        for (const s of sections) {
          const sectionMaster = await this.sectionRepo.findOne({
            where: { id: s.sectionId },
          });
          if (sectionMaster) {
            const tdSection = this.templateDesignSectionRepo.create({
              templateDesign: savedTemplate,
              section: sectionMaster,
              order: s.order,
              is_enabled: s.is_enabled,
            });
            await this.templateDesignSectionRepo.save(tdSection);
          }
        }
      }

      return this.getTemplateDesign(savedTemplate.id);
    } catch (error) {
      console.error('Error creating template design:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error.message || 'Failed to create template design',
      );
    }
  }

  async updateTemplateDesign(id: number, payload: UpdateTemplateDesignDto) {
    try {
      const template = await this.templateDesignRepo.findOne({
        where: { id },
        relations: ['category', 'palette', 'sections', 'sections.section'],
      });
      if (!template) throw new NotFoundException('Template design not found');

      const { category: categoryName, paletteId, sections, ...rest } = payload;

      if (categoryName) {
        const found = await this.categoryRepo.findOne({
          where: { name: categoryName },
        });
        if (!found)
          throw new BadRequestException(`Category '${categoryName}' not found`);
        template.category = found;
      }

      if (paletteId !== undefined) {
        if (paletteId === null) {
          template.palette = null;
        } else if (paletteId) {
          const foundPalette = await this.paletteColorRepo.findOne({
            where: { id: paletteId },
          });
          if (foundPalette) template.palette = foundPalette;
        }
      }

      const data = this.normalizeTemplateDesignPayload(rest);
      Object.assign(template, data);

      const savedTemplate = await this.templateDesignRepo.save(template);

      if (sections !== undefined) {
        // Remove old sections and replace with new ones
        await this.templateDesignSectionRepo.delete({ templateDesign: { id } });
        if (sections && sections.length > 0) {
          for (const s of sections) {
            const sectionMaster = await this.sectionRepo.findOne({
              where: { id: s.sectionId },
            });
            if (sectionMaster) {
              const tdSection = this.templateDesignSectionRepo.create({
                templateDesign: savedTemplate,
                section: sectionMaster,
                order: s.order,
                is_enabled: s.is_enabled,
              });
              await this.templateDesignSectionRepo.save(tdSection);
            }
          }
        }
      }

      return this.getTemplateDesign(id);
    } catch (error) {
      console.error('Error updating template design:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new BadRequestException(
        error.message || 'Failed to update template design',
      );
    }
  }

  async deleteTemplateDesign(id: number) {
    const template = await this.templateDesignRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template design not found');
    await this.templateDesignRepo.remove(template);
    return { success: true };
  }

  // Sections
  async listSections(q?: string, activeOnly = false) {
    let where: any;
    if (q) {
      where = [
        { label: ILike(`%${q}%`), ...(activeOnly ? { is_active: true } : {}) },
        { key: ILike(`%${q}%`), ...(activeOnly ? { is_active: true } : {}) },
      ];
    } else if (activeOnly) {
      where = { is_active: true };
    }

    const sections = await this.sectionRepo.find({
      where,
      order: { label: 'ASC' },
    });

    console.log(`[DEBUG] listSections found ${sections.length} items. Raw first item:`, sections[0]);

    return sections.map(s => {
      const raw = s as any;
      const isActive = s.is_active ?? raw.is_published ?? true;
      console.log(`[DEBUG] Mapping item ${s.key}: is_active=${s.is_active}, is_published=${raw.is_published} -> result=${isActive}`);
      return {
        id: s.id,
        label: s.label,
        key: s.key,
        is_active: isActive,
      };
    });
  }

  async createSection(payload: any) {
    try {
      console.log('Creating section with payload:', payload);
      const section = this.sectionRepo.create({
        label: payload.label,
        key: payload.key,
        is_active: payload.is_active === true || payload.is_active === 1 || payload.is_active === 'true',
      });
      const saved = await this.sectionRepo.save(section);
      console.log('Saved section:', saved);
      return saved;
    } catch (error) {
      console.error('Error creating section:', error);
      throw new BadRequestException(error.message || 'Failed to create section');
    }
  }

  async updateSection(id: string, payload: any) {
    try {
      console.log(`Updating section ${id} with payload:`, payload);
      const section = await this.sectionRepo.findOne({ where: { id } });
      if (!section) throw new NotFoundException('Section not found');
      
      if (payload.label !== undefined) section.label = payload.label;
      if (payload.key !== undefined) section.key = payload.key;
      if (payload.is_active !== undefined) {
        section.is_active = payload.is_active === true || payload.is_active === 1 || payload.is_active === 'true';
      }
      
      const saved = await this.sectionRepo.save(section);
      console.log('Updated section result:', saved);
      return saved;
    } catch (error) {
      console.error('Error updating section:', error);
      throw new BadRequestException(error.message || 'Failed to update section');
    }
  }

  async deleteSection(id: string) {
    const section = await this.sectionRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    await this.sectionRepo.remove(section);
    return { success: true };
  }

  // Audio
  async listAudio(q?: string) {
    const where = q ? { title: ILike(`%${q}%`) } : undefined;
    return this.audioRepo.find({ where, order: { title: 'ASC' } });
  }

  async createAudio(payload: Partial<Audio>) {
    const audio = this.audioRepo.create(payload);
    return this.audioRepo.save(audio);
  }

  async deleteAudio(id: string) {
    const audio = await this.audioRepo.findOne({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    await this.audioRepo.remove(audio);
    return { success: true };
  }

  // Banks
  async listBanks(q?: string) {
    const where = q
      ? [{ name: ILike(`%${q}%`) }, { code: ILike(`%${q}%`) }]
      : undefined;
    return this.bankRepo.find({ where, order: { name: 'ASC' } });
  }

  async createBank(payload: Partial<Bank>) {
    const bank = this.bankRepo.create(payload);
    return this.bankRepo.save(bank);
  }

  async deleteBank(id: string) {
    const bank = await this.bankRepo.findOne({ where: { id } });
    if (!bank) throw new NotFoundException('Bank not found');
    await this.bankRepo.remove(bank);
    return { success: true };
  }

  // Palette Colors
  async listPaletteColors(page = 1, limit = 20, q?: string) {
    const where = q ? { name: ILike(`%${q}%`) } : undefined;
    const [data, total] = await this.paletteColorRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async createPaletteColor(payload: CreatePaletteColorDto) {
    const palette = this.paletteColorRepo.create(payload);
    return this.paletteColorRepo.save(palette);
  }

  async updatePaletteColor(id: string, payload: UpdatePaletteColorDto) {
    const palette = await this.paletteColorRepo.findOne({ where: { id } });
    if (!palette) throw new NotFoundException('Palette color not found');
    Object.assign(palette, payload);
    return this.paletteColorRepo.save(palette);
  }

  async deletePaletteColor(id: string) {
    const palette = await this.paletteColorRepo.findOne({ where: { id } });
    if (!palette) throw new NotFoundException('Palette color not found');
    await this.paletteColorRepo.remove(palette);
    return { success: true };
  }

  private normalizeTemplateDesignPayload(
    payload: Partial<CreateTemplateDesignDto | UpdateTemplateDesignDto>,
  ): Partial<TemplateDesign> {
    const data: any = { ...payload };
    delete data.category;
    delete data.paletteId;
    delete data.sections;

    if (data.isActive !== undefined) {
      data.isPublished = data.isActive;
      delete data.isActive;
    }

    // paletteColors is already handled by TypeORM simple-array if it's an array of strings
    if (data.paletteColors && !Array.isArray(data.paletteColors)) {
      delete data.paletteColors;
    }

    if (data.tags) {
      if (Array.isArray(data.tags)) {
        data.tags = JSON.stringify(data.tags);
      } else if (typeof data.tags !== 'string') {
        data.tags = JSON.stringify(data.tags);
      }
    }

    return data as Partial<TemplateDesign>;
  }

  private transformTemplateDesign(template: TemplateDesign) {
    const result = { ...template } as any;
    result.tags = this.safeParse(template.tags);
    result.isActive = template.isPublished;

    // Use linked palette colors if available, otherwise use custom paletteColors
    if (template.palette) {
      result.paletteColors = [
        template.palette.primary,
        template.palette.secondary,
        template.palette.accent,
      ];
    } else if (template.paletteColors) {
      result.paletteColors = template.paletteColors;
    } else {
      result.paletteColors = [];
    }

    if (template.category && typeof template.category === 'object') {
      result.category = template.category.name;
    }

    if (template.palette) {
      result.palette = {
        id: template.palette.id,
        name: template.palette.name,
        primary: template.palette.primary,
        secondary: template.palette.secondary,
        accent: template.palette.accent,
      };
    }

    if (template.sections) {
      result.sections = template.sections
        .sort((a, b) => a.order - b.order)
        .map((ts) => ({
          id: ts.section.id,
          key: ts.section.key,
          label: ts.section.label,
          order: ts.order,
          is_enabled: ts.is_enabled,
        }));
    }

    delete result.sectionOptions;

    return result;
  }

  private safeParse(value?: string | null) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return value;
    }
  }
}
