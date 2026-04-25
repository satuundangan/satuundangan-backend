import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import { AffiliateTier } from '../types/affiliate.type';

@Entity('tier_configs')
export class TierConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AffiliateTier, unique: true })
  tier: AffiliateTier;

  @Column({ type: 'int' })
  minSales: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  commissionRate: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
