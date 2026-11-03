import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus } from './types/payment.type';
import { Invitation, type InvitationPackage } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  // UNIQUE is the DB-level backstop for the webhook lookup: handleMidtransNotification
  // resolves a payment purely by orderId, so a duplicate row would make findOne
  // silently ambiguous (TypeORM returns an arbitrary match).
  @Column({ type: 'varchar', length: 100, unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  snapToken: string | null;

  @Column({ type: 'text', nullable: true })
  redirectUrl: string | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus | string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fraudStatus: string | null;

  @Column({ type: 'timestamp', nullable: true })
  settlementTime: Date | null;

  @ManyToOne(() => Invitation, (invitation) => invitation.payments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'invitationId' })
  invitation: Invitation;

  @Column({ nullable: true })
  invitationId: number;

  // Template selected when this invitation checkout was created. Legacy rows
  // without this snapshot stay unattributed in historical template reporting.
  @Column({ type: 'int', nullable: true })
  templateDesignIdSnapshot: number | null;

  @ManyToOne(() => PromoCode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode: PromoCode | null;

  @Column({ nullable: true })
  promoCodeId: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountAmount: number | null;

  @Column({ type: 'int', nullable: true })
  affiliateProfileId: number | null;

  @Column({ type: 'boolean', default: false })
  commissionCredited: boolean;

  @Column({ type: 'varchar', length: 20, default: 'invitation' })
  purpose: string;

  // Pricing tier purchased. Applied to invitation.package on settlement.
  // Stored as varchar (not enum) to avoid the Invitation<->Payment circular import
  // leaving the enum undefined at decorator evaluation time.
  @Column({ type: 'varchar', length: 20, nullable: true })
  package: InvitationPackage | null;

  @Column({ type: 'int', nullable: true })
  aiCreditsAmount: number | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  // GA client id and first-touch campaign sent by the browser at checkout. Used
  // only to attribute a server-verified purchase; absent for non-browser flows.
  @Column({ type: 'varchar', length: 40, nullable: true })
  gaClientId: string | null;

  @Column({ type: 'json', nullable: true })
  acquisition: { source?: string; medium?: string; campaign?: string } | null;

  // Outbox state for the server-side GA4 purchase event (one event per order).
  @Column({ type: 'datetime', nullable: true })
  ga4PurchaseSentAt: Date | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  ga4PurchaseStatus: 'sent' | 'failed' | 'skipped' | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ga4PurchaseError: string | null;

  @Column({ type: 'int', default: 0 })
  ga4PurchaseAttempts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
