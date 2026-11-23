import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Invitation } from '../../invitation/invitation.entity';
import { GuestMessage } from '../../guest-messages/guest-message.entity';

@Index('idx_guest_invitation_slug', ['invitation', 'slug'])
@Index('idx_guest_invitation_checked_in_at', ['invitation', 'checkedInAt'])
@Index('idx_guest_invitation_access_token', ['invitation', 'accessToken'])
@Entity('guest')
export class Guest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  degree: string;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string;

  @Column()
  slug: string;

  @Column({
    name: 'access_token',
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
  })
  accessToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  group: string;

  @Column({ name: 'status_send', type: 'varchar', nullable: true })
  statusSend: string;

  @Column({ name: 'rsvp_status', type: 'varchar', nullable: true, default: 'belum' })
  rsvpStatus: string;

  @Column({ name: 'pax', type: 'int', default: 1 })
  pax: number;

  @Column({ name: 'is_physical', type: 'boolean', default: false })
  isPhysical: boolean;
  @Column({ name: 'first_visit_at', type: 'datetime', nullable: true })
  firstVisitAt: Date | null;

  @Column({ name: 'visit_count', type: 'int', default: 0 })
  visitCount: number;

  @Column({ name: 'checked_in_at', type: 'datetime', nullable: true })
  checkedInAt: Date | null;

  @Column({ name: 'table_number', type: 'varchar', length: 100, nullable: true })
  tableNumber: string | null;

  @Column({ name: 'session_name', type: 'varchar', length: 100, nullable: true })
  sessionName: string | null;

  @Column({ name: 'session_access', type: 'simple-json', nullable: true })
  sessionAccess: string[] | null;

  @Column({ name: 'souvenir_given', type: 'boolean', default: false })
  souvenirGiven: boolean;

  @Column({ name: 'souvenir_given_at', type: 'datetime', nullable: true })
  souvenirGivenAt: Date | null;

  @Column({ name: 'physical_gift_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  physicalGiftAmount: number | null;

  @Column({ name: 'physical_gift_notes', type: 'varchar', length: 255, nullable: true })
  physicalGiftNotes: string | null;

  @ManyToOne(() => Invitation, (invitation) => invitation.guests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitation_id' })
  invitation: Invitation;

  @OneToMany(() => GuestMessage, (gm) => gm.guest)
  messages: GuestMessage[];
}
