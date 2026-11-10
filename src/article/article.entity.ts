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

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'longtext', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage: string;

  // SEO Fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  focusKeyword: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ogImage: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  canonicalUrl: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'int', nullable: true })
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
