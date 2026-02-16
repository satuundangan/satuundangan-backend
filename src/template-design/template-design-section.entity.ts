import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { TemplateDesign } from './template-design.entity';
import { Section } from '../admin/entities/section.entity';

@Entity('template_design_sections')
export class TemplateDesignSection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemplateDesign, (td) => td.sections, { onDelete: 'CASCADE' })
  templateDesign: TemplateDesign;

  @ManyToOne(() => Section, { eager: true })
  section: Section;

  @Column({ default: true })
  is_enabled: boolean;

  @Column({ default: 0 })
  order: number;
}
