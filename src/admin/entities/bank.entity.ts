import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('master_banks')
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  code: string;

  @Column()
  logo: string;
}
