import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Invitation } from '../../invitation/invitation.entity';
import { GuestMessage } from '../../guest-messages/guest-message.entity';

@Entity('guest')
export class Guest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  degree: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column()
  slug: string;

  @Column({ nullable: true })
  group: string;

  @Column({ name: 'status_send', nullable: true })
  statusSend: string;

  @Column({ name: 'rsvp_status', nullable: true, default: 'belum' })
  rsvpStatus: string;

  @Column({ name: 'first_visit_at', type: 'datetime', nullable: true })
  firstVisitAt: Date | null;

  @Column({ name: 'visit_count', type: 'int', default: 0 })
  visitCount: number;

  @Column({ name: 'checked_in_at', type: 'datetime', nullable: true })
  checkedInAt: Date | null;

  @ManyToOne(() => Invitation, (invitation) => invitation.guests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitation_id' })
  invitation: Invitation;

  @OneToMany(() => GuestMessage, (gm) => gm.guest)
  messages: GuestMessage[];
}
