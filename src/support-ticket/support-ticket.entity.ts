import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';

export interface SupportTicketMessage {
  sender: 'customer' | 'staff';
  authorName?: string;
  message: string;
  timestamp: Date | string;
}

export function isUrgentWeddingDate(date?: Date | string | null): boolean {
  if (!date) return false;
  const target = new Date(date);
  if (isNaN(target.getTime())) return false;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

export function generateTicketNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${yyyy}${mm}-${rand}`;
}

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_number', unique: true })
  ticketNumber: string;

  @Column()
  subject: string;

  @Column({ default: 'other' })
  category: string; // 'order' | 'invitation' | 'payment' | 'technical' | 'other'

  @Column({ default: 'medium' })
  priority: string; // 'low' | 'medium' | 'high' | 'urgent'

  @Column({ default: 'open' })
  status: string; // 'open' | 'in_progress' | 'resolved' | 'closed'

  @Column({ name: 'contact_channel', default: 'web_form' })
  contactChannel: string; // 'whatsapp' | 'email' | 'web_form'

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string | null;

  @Column({ name: 'customer_email', nullable: true })
  customerEmail: string | null;

  @Column({ name: 'invitation_id', type: 'int', nullable: true })
  invitationId: number | null;

  @Column({ name: 'order_id', nullable: true })
  orderId: string | null;

  @Column({ name: 'wedding_date', type: 'date', nullable: true })
  weddingDate: Date | null;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'first_response_at', type: 'datetime', nullable: true })
  firstResponseAt: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ type: 'json', nullable: true })
  messages: SupportTicketMessage[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  beforeInsert() {
    if (!this.ticketNumber) {
      this.ticketNumber = generateTicketNumber();
    }
    if (this.weddingDate && isUrgentWeddingDate(this.weddingDate)) {
      this.priority = 'urgent';
    }
  }
}
