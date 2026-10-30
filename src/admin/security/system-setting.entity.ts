import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'json' })
  value: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  updatedById: number | null;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
