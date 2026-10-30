import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  requestId: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  actorEmail: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorRole: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Index()
  @Column({ type: 'varchar', length: 60 })
  entityType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'json', nullable: true })
  before: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  after: Record<string, any> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  result: 'success' | 'failed';

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
