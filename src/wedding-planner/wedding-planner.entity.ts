import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('wedding_planners')
export class WeddingPlanner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  budgetTotal: number;

  @Column({ type: 'json', nullable: true })
  budgetItems: Array<{
    id: string;
    category: string;
    name: string;
    estimatedCost: number;
    actualCost: number;
    paidAmount: number;
    notes?: string;
  }>;

  @Column({ type: 'json', nullable: true })
  checklists: Array<{
    id: string;
    phase: string; // e.g. 'H-180 s/d H-120', 'H-90 s/d H-60', 'H-30 s/d H-7', 'Minggu Terakhir & Hari H'
    task: string;
    isCompleted: boolean;
    dueDate?: string;
    notes?: string;
  }>;

  @Column({ type: 'json', nullable: true })
  vendors: Array<{
    id: string;
    category: string; // e.g. 'Venue', 'Catering', 'MUA & Busana', 'Fotografi', 'Dekorasi', 'Musik'
    name: string;
    picName?: string;
    phoneNumber?: string;
    instagram?: string;
    price: number;
    paymentStatus: 'unpaid' | 'dp' | 'paid';
    notes?: string;
  }>;

  @Column({ type: 'json', nullable: true })
  rundown: Array<{
    id: string;
    time: string;
    activity: string;
    location?: string;
    pic?: string;
    notes?: string;
  }>;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
