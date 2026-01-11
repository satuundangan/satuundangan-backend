import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../user/user.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { GuestMessage } from '../guest-messages/guest-message.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationActivity } from '../dashboard/invitation-activity.entity';
import { Payment } from '../payment/payment.entity';

@Entity()
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, unique: true })
  slug: string;

  @Column({ nullable: true })
  coupleName: string;

  @Column({ nullable: false })
  groomName: string;

  @Column({ nullable: false })
  brideName: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({
    type: 'enum',
    enum: ['islam', 'katolik', 'kristen', 'budha', 'hindu', 'bebas'],
  })
  quoteSource: string;

  @Column({ nullable: true, type: 'text' })
  quoteText: string;

  @Column({ type: 'json' })
  loveStory: any; // bisa pakai array of objects, validasi di DTO

  @Column()
  musicChoice: string;

  @Column({ default: false })
  isCustomMusic: boolean;

  @Column()
  bridePhotoUrl: string;

  @Column({ type: 'json' })
  akadLocation: {
    mapUrl: string;
    description: string;
    dateTime: string;
  };

  @Column({ type: 'json' })
  resepsiLocation: {
    mapUrl: string;
    description: string;
    dateTime: string;
  };

  @Column({ default: false })
  mergeEvents: boolean;

  @Column({ default: false })
  encryptedGuestName: boolean;

  @Column({ nullable: true })
  floorPlanImageUrl: string;

  @Column({ type: 'json' })
  menu: {
    title: string;
    items: string[];
  };

  @Column({ type: 'json' })
  galleryImages: string[];

  @Column()
  giftDeliveryAddress: string;

  @Column({ nullable: true })
  eWalletLink: string;

  @Column({ type: 'json' })
  socialMedia: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    lainnya?: string;
  };

  @Column({ type: 'json' })
  parents: {
    brideParents: string;
    groomParents: string;
  };

  @Column({ nullable: true })
  liveStreamingLink: string;

  @Column({ default: true })
  enableGuestMessage: boolean;

  // New Fields
  @Column({ default: 0 })
  views: number;

  @Column({ type: 'text', nullable: true })
  whatsappMessageTemplate: string;

  @Column({ default: false })
  isActive: boolean;

  // Relasi user & template
  @ManyToOne(() => User, (user) => user.invitations, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => TemplateDesign, (template) => template.invitations, {
    nullable: true,
  })
  @JoinColumn({ name: 'templateDesignId' })
  templateDesign: TemplateDesign;

  @Column({ nullable: true })
  templateDesignId: number;

  @OneToMany(() => GuestMessage, (gm) => gm.invitation)
  guestMessages: GuestMessage[];

  @Column({ type: 'simple-array', nullable: true })
  selectedSections: string[];

  @OneToMany(() => Guest, (guest) => guest.invitation)
  guests: Guest[];

  @OneToMany(() => InvitationActivity, (activity) => activity.invitation)
  activities: InvitationActivity[];

  @OneToMany(() => Payment, (payment) => payment.invitation)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
