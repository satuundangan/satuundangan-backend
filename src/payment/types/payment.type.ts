export interface MidtransNotificationPayload {
  transaction_time?: string;
  transaction_status: string;
  transaction_id?: string;
  status_message?: string;
  status_code: string;
  signature_key: string;
  payment_type?: string;
  order_id: string;
  merchant_id?: string;
  gross_amount: string;
  fraud_status?: string;
  settlement_time?: string;
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
