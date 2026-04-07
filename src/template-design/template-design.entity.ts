import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { Category } from '../category/category.entity';
import { PaletteColor } from '../admin/entities/palette-color.entity';
import { TemplateDesignSection } from './template-design-section.entity';

@Entity('template_designs')
export class TemplateDesign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  previewUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ default: true })
  isPublished: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @ManyToOne(() => Category, (category) => category.templates, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  category: Category;

  @ManyToOne(() => PaletteColor, { nullable: true, onDelete: 'SET NULL' })
  palette?: PaletteColor | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'simple-array', nullable: true })
  paletteColors?: string[];

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  tags: string;

  @Column({ type: 'text', nullable: true })
  sectionOptions?: string;

  @OneToMany(() => TemplateDesignSection, (tds) => tds.templateDesign, {
    cascade: true,
  })
  sections?: TemplateDesignSection[];

  @OneToMany(() => Invitation, (invitation) => invitation.templateDesign)
  invitations: Invitation[];
}
