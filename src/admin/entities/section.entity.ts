import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('master_sections')
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  is_active: boolean;
}
