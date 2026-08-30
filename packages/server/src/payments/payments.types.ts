export type PaymentIntentStatus =
  | 'CREATED'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'DISMISSED'
  | 'AUTHORIZED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export const TERMINAL_STATUSES: ReadonlySet<PaymentIntentStatus> = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);

export interface CreateIntentRequest {
  tenantAppId: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
}

export interface PaymentIntentRecord {
  intentId: string;
  tenantAppId: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  nonce: string;
  status: PaymentIntentStatus;
  transactionHandle?: string;
  providerRef?: string;
  failureSubCode?: string;
  createdAt: number;
  expiresAt: number;
  providerIntentRef?: string;
}

export interface TenantPublicKeyRecord {
  tenantAppId: string;
  keyBase64: string;
  algorithm: 'Ed25519' | 'ECDSA_P256';
}
