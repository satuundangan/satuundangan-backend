import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
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

  // null on an admin account means superadmin (accounts that predate roles)
  @Column({ type: 'varchar', length: 20, nullable: true })
  adminRole: string | null;

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

  // SHA-256 hashes of unused one-time recovery codes; never selected by default
  @Column({ type: 'json', nullable: true, select: false })
  totpRecoveryHashes: string[] | null;

  @Column({ type: 'bool', default: false })
  hasWeddingPlannerAccess: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  instagramHandle: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  // Captured only for self-service registrations; legacy and admin-created users remain unknown.
  @Column({ type: 'datetime', nullable: true })
  registeredAt: Date | null;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  // Only populated for successful credential, OAuth, or admin authentication
  // from the point this field is deployed. Historical login time is unknown.
  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => Invitation, (invitation) => invitation.user, {
    onDelete: 'CASCADE',
  })
  invitations: Invitation[];

  @OneToMany(() => UserConsent, (consent) => consent.user)
  consents: UserConsent[];
}
