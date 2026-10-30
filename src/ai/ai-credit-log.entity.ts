import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type AiCreditAction = 'deduct' | 'topup' | 'refund';
export type AiFeature = 'nova_assistant' | 'copywriting' | 'theme_suggestion';

@Entity('ai_credit_logs')
export class AiCreditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column()
  action: string; // 'deduct' | 'topup' | 'refund'

  @Column({ default: 'nova_assistant' })
  feature: string; // 'nova_assistant' | 'copywriting' | 'theme_suggestion'

  @Column({ name: 'credits_change', type: 'int' })
  creditsChange: number;

  @Column({ name: 'credits_balance', type: 'int' })
  creditsBalance: number;

  @Column({ default: 'success' })
  status: string; // 'success' | 'failed'

  @Column({ default: 'deepseek-v4-flash' })
  model: string;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens: number;

  @Column({
    name: 'estimated_cost_idr',
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0,
    transformer: {
      to: (val?: number | null) => val,
      from: (val?: string | number | null) => Number(val) || 0,
    },
  })
  estimatedCostIdr: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
