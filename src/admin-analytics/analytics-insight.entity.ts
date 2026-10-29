import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_insights')
export class AnalyticsInsight {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  kind: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  detail: string;

  /** Probable cause, always phrased as a guess to verify. */
  @Column({ type: 'text' })
  hypothesis: string;

  @Column({ type: 'json' })
  sample: Record<string, any>;

  @Column({ type: 'varchar', length: 120 })
  link: string;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  generatedAt: Date;
}

@Entity('analytics_annotations')
export class AnalyticsAnnotation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  kind: 'release' | 'campaign' | 'note';

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
