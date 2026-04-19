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
import { Invitation } from '../invitation/invitation.entity';
import { PromoCode } from '../promo/promo-code.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
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

  @ManyToOne(() => PromoCode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode: PromoCode | null;

  @Column({ nullable: true })
  promoCodeId: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
