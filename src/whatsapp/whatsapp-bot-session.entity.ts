import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WhatsappBotStep {
  GROOM_NAME = 'groom_name',
  BRIDE_NAME = 'bride_name',
  EVENT_DATETIME = 'event_datetime',
  EVENT_LOCATION = 'event_location',
  MAP_URL = 'map_url',
  BRIDE_PARENTS = 'bride_parents',
  GROOM_PARENTS = 'groom_parents',
  QUOTE_TEXT = 'quote_text',
  CONFIRMATION = 'confirmation',
  COMPLETED = 'completed',
}

@Entity('whatsapp_bot_sessions')
export class WhatsappBotSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({
    type: 'varchar',
    length: 64,
    default: WhatsappBotStep.GROOM_NAME,
  })
  step: WhatsappBotStep;

  @Column({ type: 'json', nullable: true })
  draft: Record<string, string>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastMessageId: string;

  @Column({ type: 'int', nullable: true })
  invitationId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invitationSlug: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
