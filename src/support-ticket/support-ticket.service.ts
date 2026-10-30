import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SupportTicket,
  SupportTicketMessage,
  isUrgentWeddingDate,
  generateTicketNumber,
} from './support-ticket.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';

export interface SupportTicketFindAllQuery {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function calculateOperationalMinutes(
  startInput: Date | string,
  endInput: Date | string,
): number {
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  // WIB is UTC+7
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const startWib = new Date(start.getTime() + WIB_OFFSET_MS);
  const endWib = new Date(end.getTime() + WIB_OFFSET_MS);

  const startYear = startWib.getUTCFullYear();
  const startMonth = startWib.getUTCMonth();
  const startDate = startWib.getUTCDate();

  const endYear = endWib.getUTCFullYear();
  const endMonth = endWib.getUTCMonth();
  const endDate = endWib.getUTCDate();

  const startDayTime = Date.UTC(startYear, startMonth, startDate);
  const endDayTime = Date.UTC(endYear, endMonth, endDate);

  const startMinute =
    startWib.getUTCHours() * 60 +
    startWib.getUTCMinutes() +
    startWib.getUTCSeconds() / 60;
  const endMinute =
    endWib.getUTCHours() * 60 +
    endWib.getUTCMinutes() +
    endWib.getUTCSeconds() / 60;

  const OP_START = 8 * 60; // 08:00 = 480 mins
  const OP_END = 21 * 60; // 21:00 = 1260 mins
  const OP_HOURS_PER_DAY = OP_END - OP_START; // 780 mins

  if (startDayTime === endDayTime) {
    const effectiveStart = Math.max(OP_START, Math.min(OP_END, startMinute));
    const effectiveEnd = Math.max(OP_START, Math.min(OP_END, endMinute));
    return Math.max(0, Math.round(effectiveEnd - effectiveStart));
  }

  let totalMinutes = 0;

  // Day 1
  const firstDayStart = Math.max(OP_START, Math.min(OP_END, startMinute));
  totalMinutes += Math.max(0, OP_END - firstDayStart);

  // Intermediate full days
  const oneDayMs = 24 * 60 * 60 * 1000;
  let currentDayTime = startDayTime + oneDayMs;
  while (currentDayTime < endDayTime) {
    totalMinutes += OP_HOURS_PER_DAY;
    currentDayTime += oneDayMs;
  }

  // Last day
  const lastDayEnd = Math.max(OP_START, Math.min(OP_END, endMinute));
  totalMinutes += Math.max(0, lastDayEnd - OP_START);

  return Math.round(totalMinutes);
}

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
  ) {}

  async create(dto: CreateSupportTicketDto): Promise<SupportTicket> {
    const messages: SupportTicketMessage[] = Array.isArray(dto.messages)
      ? [...dto.messages]
      : [];

    if (dto.message) {
      messages.push({
        sender: 'customer',
        authorName: dto.customerName,
        message: dto.message,
        timestamp: new Date(),
      });
    }

    const weddingDate = dto.weddingDate ? new Date(dto.weddingDate) : null;
    let priority = dto.priority || 'medium';
    if (weddingDate && isUrgentWeddingDate(weddingDate)) {
      priority = 'urgent';
    }

    const ticket = this.ticketRepo.create({
      ticketNumber: generateTicketNumber(),
      subject: dto.subject,
      category: dto.category || 'other',
      priority,
      status: 'open',
      contactChannel: dto.contactChannel || 'web_form',
      customerName: dto.customerName,
      customerPhone: dto.customerPhone ?? null,
      customerEmail: dto.customerEmail ?? null,
      invitationId: dto.invitationId ?? null,
      orderId: dto.orderId ?? null,
      weddingDate,
      messages: messages.length > 0 ? messages : null,
    });

    return this.ticketRepo.save(ticket);
  }

  async findAll(query: SupportTicketFindAllQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const qb = this.ticketRepo.createQueryBuilder('ticket');

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }

    if (query.category) {
      qb.andWhere('ticket.category = :category', { category: query.category });
    }

    if (query.search) {
      qb.andWhere(
        '(ticket.ticketNumber LIKE :search OR ticket.subject LIKE :search OR ticket.customerName LIKE :search OR ticket.customerPhone LIKE :search OR ticket.customerEmail LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('ticket.createdAt', 'DESC');
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

  async findOne(id: number): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket #${id} not found`);
    }
    return ticket;
  }

  async update(id: number, dto: UpdateSupportTicketDto): Promise<SupportTicket> {
    const ticket = await this.findOne(id);

    if (dto.subject !== undefined) ticket.subject = dto.subject;
    if (dto.category !== undefined) ticket.category = dto.category;
    if (dto.priority !== undefined) ticket.priority = dto.priority;
    if (dto.contactChannel !== undefined)
      ticket.contactChannel = dto.contactChannel;
    if (dto.customerName !== undefined) ticket.customerName = dto.customerName;
    if (dto.customerPhone !== undefined)
      ticket.customerPhone = dto.customerPhone ?? null;
    if (dto.customerEmail !== undefined)
      ticket.customerEmail = dto.customerEmail ?? null;
    if (dto.invitationId !== undefined)
      ticket.invitationId = dto.invitationId ?? null;
    if (dto.orderId !== undefined) ticket.orderId = dto.orderId ?? null;
    if (dto.assignedTo !== undefined)
      ticket.assignedTo = dto.assignedTo ?? null;
    if (dto.resolutionNotes !== undefined)
      ticket.resolutionNotes = dto.resolutionNotes ?? null;

    if (dto.weddingDate !== undefined) {
      ticket.weddingDate = dto.weddingDate ? new Date(dto.weddingDate) : null;
      if (ticket.weddingDate && isUrgentWeddingDate(ticket.weddingDate)) {
        ticket.priority = 'urgent';
      }
    }

    if (dto.status !== undefined) {
      ticket.status = dto.status;
      if (dto.status === 'resolved' && !ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
    }

    if (dto.newMessage) {
      const sender = dto.sender || 'staff';
      const msg: SupportTicketMessage = {
        sender,
        authorName: dto.authorName || (sender === 'staff' ? ticket.assignedTo || 'Staff' : ticket.customerName),
        message: dto.newMessage,
        timestamp: new Date(),
      };
      ticket.messages = [...(ticket.messages || []), msg];

      if (sender === 'staff' && !ticket.firstResponseAt) {
        ticket.firstResponseAt = new Date();
      }
    }

    return this.ticketRepo.save(ticket);
  }

  async getMetrics() {
    const tickets = await this.ticketRepo.find();

    const backlogOpen = tickets.filter((t) => t.status === 'open').length;
    const backlogInProgress = tickets.filter(
      (t) => t.status === 'in_progress',
    ).length;

    const urgentTickets = tickets.filter((t) => {
      const isUrgentStatus = ['open', 'in_progress'].includes(t.status);
      const isUrgentPriority = t.priority === 'urgent';
      const isUrgentWedding = isUrgentWeddingDate(t.weddingDate);
      return isUrgentStatus && (isUrgentPriority || isUrgentWedding);
    });

    const categoryBreakdown: Record<string, number> = {
      order: 0,
      invitation: 0,
      payment: 0,
      technical: 0,
      other: 0,
    };
    for (const t of tickets) {
      const cat = t.category || 'other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    // First response times
    const ticketsWithFirstResponse = tickets.filter(
      (t) => t.firstResponseAt && t.createdAt,
    );
    const totalFirstResponseMinutes = ticketsWithFirstResponse.reduce(
      (acc, t) =>
        acc + calculateOperationalMinutes(t.createdAt, t.firstResponseAt!),
      0,
    );
    const avgFirstResponseMinutes = ticketsWithFirstResponse.length
      ? Math.round(
          totalFirstResponseMinutes / ticketsWithFirstResponse.length,
        )
      : 0;

    // Resolution times
    const ticketsWithResolution = tickets.filter(
      (t) => t.resolvedAt && t.createdAt,
    );
    const totalResolutionMinutes = ticketsWithResolution.reduce(
      (acc, t) => acc + calculateOperationalMinutes(t.createdAt, t.resolvedAt!),
      0,
    );
    const avgResolutionMinutes = ticketsWithResolution.length
      ? Math.round(totalResolutionMinutes / ticketsWithResolution.length)
      : 0;
    const avgResolutionHours =
      Math.round((avgResolutionMinutes / 60) * 10) / 10;

    return {
      operationalHours: '08:00–21:00 WIB (UTC+7)',
      backlog: {
        open: backlogOpen,
        inProgress: backlogInProgress,
        total: backlogOpen + backlogInProgress,
      },
      urgentCount: urgentTickets.length,
      avgFirstResponseTime: {
        minutes: avgFirstResponseMinutes,
        hours: Math.round((avgFirstResponseMinutes / 60) * 10) / 10,
      },
      avgResolutionTime: {
        minutes: avgResolutionMinutes,
        hours: avgResolutionHours,
      },
      categoryBreakdown,
      totalTickets: tickets.length,
    };
  }
}
