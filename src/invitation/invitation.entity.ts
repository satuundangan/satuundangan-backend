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

const jsonTextArrayTransformer = {
  to: (value: unknown) =>
    JSON.stringify(Array.isArray(value) ? value : value ? [value] : []),
  from: (value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      return value ? [value] : [];
    }
  },
};

// Pricing tier (feature-gating). All templates free to all; features gated by tier.
export enum InvitationPackage {
  BASIC = 'basic',
  PREMIUM = 'premium',
  EKSKLUSIF = 'eksklusif',
}

// Tier prices (IDR). Source of truth for checkout — not template price.
export const PACKAGE_PRICES: Record<InvitationPackage, number> = {
  [InvitationPackage.BASIC]: 89000,
  [InvitationPackage.PREMIUM]: 179000,
  [InvitationPackage.EKSKLUSIF]: 239000,
};

export const PACKAGE_LABELS: Record<InvitationPackage, string> = {
  [InvitationPackage.BASIC]: 'Basic',
  [InvitationPackage.PREMIUM]: 'Premium',
  [InvitationPackage.EKSKLUSIF]: 'Eksklusif',
};

// Feature gating per tier. Single source of truth — enforced in invitation
// service + surfaced via GET /payment/packages. Tier comes from the package the
// user buys, NOT the template (all templates are free & tier-neutral).
// watermark=true means the "Created with SatuUndangan" branding shows.
// galleryLimit: max gallery photos (0 = none). guestLimit is phase 2 (not enforced yet).
export interface PackageFeatures {
  gallery: boolean;
  galleryLimit: number;
  customMusic: boolean;
  watermark: boolean;
  whatsapp: boolean;
  subdomain: boolean;
}

export const PACKAGE_FEATURES: Record<InvitationPackage, PackageFeatures> = {
  [InvitationPackage.BASIC]: {
    gallery: false,
    galleryLimit: 0,
    customMusic: false,
    watermark: true,
    whatsapp: false,
    subdomain: false,
  },
  [InvitationPackage.PREMIUM]: {
    gallery: true,
    galleryLimit: 8,
    customMusic: true,
    watermark: false,
    whatsapp: true,
    subdomain: false,
  },
  [InvitationPackage.EKSKLUSIF]: {
    gallery: true,
    galleryLimit: 20,
    customMusic: true,
    watermark: false,
    whatsapp: true,
    subdomain: true,
  },
};

@Entity()
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, unique: true })
  slug: string;

  // Pricing tier. Set at checkout when user picks a package. Gates premium features.
  @Column({
    type: 'enum',
    enum: InvitationPackage,
    default: InvitationPackage.BASIC,
  })
  package: InvitationPackage;

  // Custom subdomain (tier Eksklusif), e.g. "namapasangan" → namapasangan.satuundangan.id
  // Explicit type: TS union string|null reflects as Object, which TypeORM can't map.
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  subdomain: string | null;

  @Column({ nullable: true })
  coupleName: string;

  @Column({ nullable: false })
  groomName: string;

  @Column({ nullable: false })
  brideName: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  quoteSource: string;

  @Column({ nullable: true, type: 'text' })
  quoteText: string;

  @Column({ type: 'json' })
  loveStory: any; // bisa pakai array of objects, validasi di DTO

  @Column()
  musicChoice: string;

  @Column({ default: false })
  isCustomMusic: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  audioStart: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  audioEnd: number;

  @Column({ nullable: true })
  templateName: string;

  @Column()
  bridePhotoUrl: string;

  @Column({ nullable: true })
  groomPhotoUrl: string;

  @Column({ nullable: true })
  photoCoupleUrl: string;

  @Column({ nullable: true })
  videoPrewedding: string;

  @Column({ default: 'default' })
  quoteType: string;

  @Column({ type: 'timestamp', nullable: true })
  dateTime: Date;

  @Column({ type: 'json', nullable: true })
  akadLocation: {
    mapUrl: string;
    description: string;
    dateTime: string;
  };

  @Column({ type: 'json', nullable: true })
  resepsiLocation: {
    mapUrl: string;
    description: string;
    dateTime: string;
  };

  @Column({ default: true })
  isSingleEvent: boolean;

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

  @Column({ type: 'text', transformer: jsonTextArrayTransformer })
  giftDeliveryAddress: string[];

  @Column({ type: 'json', nullable: true })
  eWalletLink: {
    wallet_provider: string;
    wallet_number: string;
    wallet_image?: string;
  }[];

  @Column({ type: 'json', nullable: true })
  bankAccounts: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankLogoUrl?: string;
  }[];

  @Column({ type: 'json' })
  socialMedia: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    lainnya?: string;
  };

  @Column({ type: 'json', nullable: true })
  socialMediaBrides: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    lainnya?: string;
  };

  @Column({ type: 'json', nullable: true })
  socialMediaGroom: {
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

  @Column({ nullable: true, type: 'text' })
  turutMengundang: string;

  @Column({ nullable: true })
  liveStreamingLink: string;

  @Column({ nullable: true, type: 'text' })
  footerText: string;

  @Column({ default: true })
  enableCover: boolean;

  @Column({ default: true })
  enableGuestMessage: boolean;

  // New Fields
  @Column({ default: 0 })
  views: number;

  @Column({ type: 'text', nullable: true })
  whatsappMessageTemplate: string;

  @Column({ type: 'timestamp', nullable: true })
  expiredAt: Date;

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
