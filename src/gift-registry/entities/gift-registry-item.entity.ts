import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Invitation } from '../../invitation/invitation.entity';

export enum GiftRegistryStatus {
  AVAILABLE = 'AVAILABLE',
  CLAIMED = 'CLAIMED',
}

@Index('idx_gift_registry_invitation_status', ['invitationId', 'status'])
@Entity('gift_registry_items')
export class GiftRegistryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invitation_id' })
  invitationId: number;

  @ManyToOne(() => Invitation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitation_id' })
  invitation: Invitation;

  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'varchar', length: 100, default: 'Lainnya' })
  category: string;

  @Column({ type: 'int', nullable: true })
  priceEstimate: number | null;

  @Column({ type: 'text', nullable: true })
  productUrl: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: GiftRegistryStatus.AVAILABLE,
  })
  status: GiftRegistryStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  claimedByGuestName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  claimedByPhone: string | null;

  @Column({ type: 'datetime', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
