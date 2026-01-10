import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';

export enum ActivityAction {
  VIEW = 'viewed_invitation',
  RSVP = 'sent_rsvp',
  WISH = 'sent_wishes',
}

@Entity('invitation_activities')
export class InvitationActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  guestName: string | null;

  @Column({
    type: 'enum',
    enum: ActivityAction,
    default: ActivityAction.VIEW,
  })
  action: ActivityAction;

  @ManyToOne(() => Invitation, (invitation) => invitation.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitationId' })
  invitation: Invitation;

  @Column()
  invitationId: number;

  @CreateDateColumn()
  createdAt: Date;
}
