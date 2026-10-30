import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('affiliate_config_audits')
export class AffiliateConfigAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  configType: 'tier' | 'system';

  @Column({ type: 'varchar', length: 100 })
  configKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  beforeValue: string | null;

  @Column({ type: 'varchar', length: 255 })
  afterValue: string;

  @Column({ type: 'timestamp' })
  effectiveAt: Date;

  @Column({ type: 'int', nullable: true })
  changedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
