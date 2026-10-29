import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export interface ArticleRevision {
  id: string;
  savedAt: string;
  savedByUserId: number | null;
  reason: string | null;
  snapshot: Record<string, any>;
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'longtext', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({ nullable: true })
  coverImage: string;

  // SEO Fields
  @Column({ nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ nullable: true })
  focusKeyword: string;

  @Column({ nullable: true })
  ogImage: string;

  @Column({ nullable: true })
  canonicalUrl: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ nullable: true })
  authorId: number;

  @Column({ type: 'int', default: 1 })
  editVersion: number;

  @Column({ type: 'json', nullable: true, select: false })
  revisionHistory: ArticleRevision[] | null;

  @Column({ type: 'bool', default: false })
  generatedByAi: boolean;

  @Column({ type: 'json', nullable: true })
  sourceUrls: string[] | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  @Column({ type: 'int', nullable: true })
  reviewedByUserId: number | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  scheduledPublishAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
