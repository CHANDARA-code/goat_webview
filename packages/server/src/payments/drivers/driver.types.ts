export interface PaymentDriverIntent {
  /** Driver-specific reference for the created PSP-side payment intent/order. */
  providerIntentRef: string;
  /** Opaque, single-intent, short-lived token handed to native — never a PSP secret key. */
  clientToken: string;
}

export interface PaymentDriverParams {
  intentId: string;
  amount: number;
  currency: string;
  orderId: string;
}

/**
 * Server-side KMS/HSM-backed driver for a single PSP (Task 10206d / §5.4). Secret API keys are
 * only ever read here, inside the Server Payment Proxy process — they never leave it.
 */
export interface PaymentDriver {
  readonly providerId: string;
  createProviderIntent(params: PaymentDriverParams): Promise<PaymentDriverIntent>;
}
