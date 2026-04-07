export interface FlipWebhookPayload {
  id: number;
  bill_link: string;
  bill_link_id: number;
  bill_title: string;
  sender_name: string;
  sender_bank: string;
  sender_bank_type: string;
  amount: number;
  status: string; // 'SUCCESSFUL' | 'FAILED' | 'CANCELLED'
  settlement_status: string;
  created_at: string;
}

export interface PaymentResponse {
  paymentType: string;
  status: string;
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILURE = 'failure',
  EXPIRED = 'expired',
  FAILED = 'failed',
}
