import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column()
  provider: string;

  @Column({ type: 'bool', default: false })
  isAdmin: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string | null;

  @OneToMany(() => Invitation, (invitation) => invitation.user, {
    onDelete: 'CASCADE',
  })
  invitations: Invitation[];
}
