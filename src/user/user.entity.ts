import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { UserConsent } from './user-consent.entity';

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

  @Column({ default: false })
  isApproved: boolean;

  @Column({ type: 'int', default: 1 })
  aiCredits: number;

  @OneToMany(() => Invitation, (invitation) => invitation.user, {
    onDelete: 'CASCADE',
  })
  invitations: Invitation[];

  @OneToMany(() => UserConsent, (consent) => consent.user)
  consents: UserConsent[];
}
