import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('affiliate_job_runs')
export class AffiliateJobRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  jobName: string;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'boolean', nullable: true })
  succeeded: boolean | null;

  @Column({ type: 'int', nullable: true })
  affectedCount: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
