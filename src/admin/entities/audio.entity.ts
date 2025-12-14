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
}
