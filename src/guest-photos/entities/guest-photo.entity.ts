import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('guest_photos')
@Index('idx_guest_photo_invitation_created', ['invitationId', 'createdAt'])
export class GuestPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invitation_id', type: 'int' })
  invitationId: number;

  @Column({ name: 'guest_name', type: 'varchar', length: 120 })
  guestName: string;

  @Column({ name: 'photo_url', type: 'varchar', length: 500 })
  photoUrl: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  caption: string | null;

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
