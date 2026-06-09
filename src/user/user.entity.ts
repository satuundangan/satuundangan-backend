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

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  emailVerificationTokenHash: string | null;

  @Column({ type: 'datetime', nullable: true })
  emailVerificationTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resetPasswordTokenHash: string | null;

  @Column({ type: 'datetime', nullable: true })
  resetPasswordTokenExpiresAt: Date | null;

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

  @Column({ type: 'varchar', length: 64, nullable: true })
  totpSecret: string | null;

  @Column({ type: 'bool', default: false })
  totpEnabled: boolean;

  @OneToMany(() => Invitation, (invitation) => invitation.user, {
    onDelete: 'CASCADE',
  })
  invitations: Invitation[];

  @OneToMany(() => UserConsent, (consent) => consent.user)
  consents: UserConsent[];
}
