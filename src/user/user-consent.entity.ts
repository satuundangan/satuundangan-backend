import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  tos_version: string;

  @Column()
  privacy_version: string;

  @Column()
  ip_address: string;

  @Column()
  user_agent: string;

  @CreateDateColumn()
  agreed_at: Date;
}
