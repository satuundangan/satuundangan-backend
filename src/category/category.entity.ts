import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TemplateDesign } from '../template-design/template-design.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  color: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TemplateDesign, (template) => template.category)
  templates: TemplateDesign[];
}
