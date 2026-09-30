import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepo.create({
      name: dto.name.trim(),
      whatsapp: dto.whatsapp.trim(),
      email: dto.email ? dto.email.trim().toLowerCase() : null,
      weddingDate: dto.weddingDate?.trim() || null,
      estimatedBudget: dto.estimatedBudget ?? null,
      guestCount: dto.guestCount ?? null,
      concept: dto.concept?.trim() || null,
      breakdown: dto.breakdown ?? null,
      source: dto.source?.trim() || 'budget_calculator',
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.leadRepo.save(lead);
    this.logger.log(
      `Lead captured id=${saved.id} name=${saved.name} whatsapp=${saved.whatsapp} source=${saved.source}`,
    );
    return saved;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.leadRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
