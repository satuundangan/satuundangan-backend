import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { AffiliateTier, AffiliateStatus } from '../types/affiliate.type';

@Entity('affiliate_profiles')
export class AffiliateProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  affiliateCode: string;

  @Column({ type: 'enum', enum: AffiliateTier, default: AffiliateTier.BRONZE })
  tier: AffiliateTier;

  @Column({ type: 'enum', enum: AffiliateStatus, default: AffiliateStatus.ACTIVE })
  status: AffiliateStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  commissionBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEarned: number;

  @Column({ type: 'int', default: 0 })
  totalSales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSalesAmount: number;

  @Column({ type: 'varchar', length: 100 })
  bankName: string;

  @Column({ type: 'varchar', length: 50 })
  bankAccountNumber: string;

  @Column({ type: 'varchar', length: 100 })
  bankAccountName: string;

  @Column({ type: 'varchar', length: 30 })
  whatsappNumber: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSaleAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
