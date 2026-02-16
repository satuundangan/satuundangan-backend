import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('master_palette_colors')
export class PaletteColor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  primary: string;

  @Column()
  secondary: string;

  @Column()
  accent: string;

  @Column({ default: true })
  is_active: boolean;
}
