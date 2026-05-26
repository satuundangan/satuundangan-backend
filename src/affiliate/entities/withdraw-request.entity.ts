import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { User } from '../../user/user.entity';
import { WithdrawStatus } from '../types/affiliate.type';

@Entity('withdraw_requests')
export class WithdrawRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateProfileId' })
  affiliateProfile: AffiliateProfile;

  @Column()
  affiliateProfileId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  requestedAmount: number;

  @Column({
    type: 'enum',
    enum: WithdrawStatus,
    default: WithdrawStatus.PENDING,
  })
  status: WithdrawStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  adminNote: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  proofUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processedByUserId' })
  processedBy: User | null;

  @Column({ nullable: true })
  processedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
