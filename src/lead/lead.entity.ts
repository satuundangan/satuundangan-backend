import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface LeadNote {
  note: string;
  author?: string;
  createdAt: Date | string;
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  whatsapp: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'wedding_date', type: 'date', nullable: true })
  weddingDate: Date | null;

  @Column({
    name: 'estimated_budget',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: string | number | null) =>
        value !== null && value !== undefined ? Number(value) : null,
    },
  })
  estimatedBudget: number | null;

  @Column({ name: 'guest_count', type: 'int', nullable: true })
  guestCount: number | null;

  @Column({ type: 'varchar', nullable: true })
  concept: string | null;

  @Column({ type: 'json', nullable: true })
  breakdown: any;

  @Column({ default: 'organic' })
  source: string;

  @Column({ default: 'new' })
  stage: string;

  @Column({ type: 'varchar', nullable: true })
  owner: string | null;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'json', nullable: true })
  notes: LeadNote[] | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
