import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  INFO = 'INFO',
  ACTION = 'ACTION',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  userEmail: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string; // e.g. PAGE_VIEW, USER_LOGIN, INVITATION_CREATE, CLIENT_ERROR, QR_DOWNLOAD

  @Index()
  @Column({ type: 'varchar', length: 20, default: LogLevel.INFO })
  level: string; // INFO, ACTION, WARN, ERROR

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any> | null;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
