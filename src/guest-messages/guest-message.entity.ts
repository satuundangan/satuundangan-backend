import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';

@Index('idx_guest_messages_invitation_status_created', [
  'invitation',
  'status',
  'createdAt',
])
@Entity('guest_messages')
export class GuestMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guestName: string;

  @Column('text')
  message: string;

  @Column('text')
  rsvpStatus: string;

  @Column('int')
  totalGuests: number;

  @Column({ default: 'published' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Invitation, (invitation) => invitation.guestMessages, {
    onDelete: 'CASCADE',
  })
  invitation: Invitation;

  @ManyToOne(() => Guest, (guest) => guest.messages, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest | null;
}
