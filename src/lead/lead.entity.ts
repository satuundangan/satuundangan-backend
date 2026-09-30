import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  whatsapp: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  weddingDate: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  estimatedBudget: number | null;

  @Column({ type: 'int', nullable: true })
  guestCount: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  concept: string | null;

  @Column({ type: 'json', nullable: true })
  breakdown: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, default: 'budget_calculator' })
  source: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
