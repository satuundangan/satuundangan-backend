import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('template_design_revisions')
export class TemplateDesignRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  templateId: number;

  @Column()
  templateName: string;

  @Column()
  version: number;

  @Column({ type: 'json' })
  snapshot: Record<string, any>;

  @Column({ nullable: true })
  actorId: number | null;

  @Column({ nullable: true })
  actorEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
