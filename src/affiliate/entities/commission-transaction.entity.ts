import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { Payment } from '../../payment/payment.entity';
import { AffiliateTier, CommissionStatus } from '../types/affiliate.type';

@Entity('commission_transactions')
export class CommissionTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateProfileId' })
  affiliateProfile: AffiliateProfile;

  @Column()
  affiliateProfileId: number;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ unique: true })
  paymentId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commissionAmount: number;

  @Column({ type: 'enum', enum: AffiliateTier })
  tierAtTime: AffiliateTier;

  @Column({
    type: 'enum',
    enum: CommissionStatus,
    default: CommissionStatus.PENDING,
  })
  status: CommissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  clearedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
