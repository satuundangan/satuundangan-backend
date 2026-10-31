import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('master_audio')
export class Audio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  category: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  format: string | null;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'char', length: 64, nullable: true })
  contentSha256: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null;

  @Column({ type: 'text', nullable: true })
  credit: string | null;

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  licenseStatus: 'unknown' | 'pending' | 'recorded' | 'restricted';
}
