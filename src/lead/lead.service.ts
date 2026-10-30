import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadNote } from './lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

export interface LeadFindAllQuery {
  stage?: string;
  source?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeadService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const notes: LeadNote[] = Array.isArray(dto.notes) ? [...dto.notes] : [];

    if (dto.note) {
      notes.push({
        note: dto.note,
        author: dto.owner || 'System',
        createdAt: new Date(),
      });
    }

    const lead = this.leadRepo.create({
      name: dto.name,
      whatsapp: dto.whatsapp,
      email: dto.email ?? null,
      weddingDate: dto.weddingDate ? new Date(dto.weddingDate) : null,
      estimatedBudget: dto.estimatedBudget ?? null,
      guestCount: dto.guestCount ?? null,
      concept: dto.concept ?? null,
      breakdown: dto.breakdown ?? null,
      source: dto.source || 'organic',
      stage: dto.stage || 'new',
      owner: dto.owner ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      notes: notes.length > 0 ? notes : null,
      customerId: dto.customerId ?? null,
      orderId: dto.orderId ?? null,
    });

    return this.leadRepo.save(lead);
  }

  async findAll(query: LeadFindAllQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const qb = this.leadRepo.createQueryBuilder('lead');

    if (query.stage) {
      qb.andWhere('lead.stage = :stage', { stage: query.stage });
    }

    if (query.source) {
      qb.andWhere('lead.source = :source', { source: query.source });
    }

    if (query.search) {
      qb.andWhere(
        '(lead.name LIKE :search OR lead.whatsapp LIKE :search OR lead.email LIKE :search OR lead.concept LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('lead.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Lead> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`Lead #${id} not found`);
    }
    return lead;
  }

  async update(id: number, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(id);

    if (dto.name !== undefined) lead.name = dto.name;
    if (dto.whatsapp !== undefined) lead.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) lead.email = dto.email ?? null;
    if (dto.weddingDate !== undefined) {
      lead.weddingDate = dto.weddingDate ? new Date(dto.weddingDate) : null;
    }
    if (dto.estimatedBudget !== undefined) {
      lead.estimatedBudget = dto.estimatedBudget ?? null;
    }
    if (dto.guestCount !== undefined) lead.guestCount = dto.guestCount ?? null;
    if (dto.concept !== undefined) lead.concept = dto.concept ?? null;
    if (dto.breakdown !== undefined) lead.breakdown = dto.breakdown ?? null;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.stage !== undefined) lead.stage = dto.stage;
    if (dto.owner !== undefined) lead.owner = dto.owner ?? null;
    if (dto.dueDate !== undefined) {
      lead.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.customerId !== undefined) lead.customerId = dto.customerId ?? null;
    if (dto.orderId !== undefined) lead.orderId = dto.orderId ?? null;
    if (dto.notes !== undefined) lead.notes = dto.notes;

    if (dto.newNote) {
      const noteEntry: LeadNote = {
        note: dto.newNote,
        author: dto.noteAuthor || lead.owner || 'Admin',
        createdAt: new Date(),
      };
      lead.notes = [...(lead.notes || []), noteEntry];
    }

    return this.leadRepo.save(lead);
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const lead = await this.findOne(id);
    await this.leadRepo.remove(lead);
    return { success: true, message: `Lead #${id} deleted successfully` };
  }
}
