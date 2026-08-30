import * as crypto from 'node:crypto';
import { PaymentDriver, PaymentDriverIntent, PaymentDriverParams } from './driver.types';

/**
 * Stripe KMS/HSM-backed driver (Task 10206d). `secretKey` is read once from the environment
 * (a real deployment would source it from a KMS/HSM, never a plain env var) and never returned
 * to any caller — only an ephemeral single-intent client secret is minted per request.
 *
 * REFERENCE SIMULATION (v1.0.0): this driver makes no real Stripe network call. It mints a local
 * client token and simulates the PSP round trip so the proxy is testable offline. Do not point it
 * at production traffic — a production driver must implement Stripe's API behind this same
 * `PaymentDriver` interface. See payment-gate-way-arch.md §5.
 */
export class StripeDriver implements PaymentDriver {
  public readonly providerId = 'stripe';

  constructor(private readonly secretKey: string = process.env.GOAT_STRIPE_SECRET_KEY || 'sk_test_dev_placeholder') {}

  public async createProviderIntent(params: PaymentDriverParams): Promise<PaymentDriverIntent> {
    // A production driver calls the Stripe API here using `this.secretKey`. This reference
    // implementation simulates the PSP round trip so the proxy is fully testable offline.
    void this.secretKey;
    const providerIntentRef = `pi_stripe_${crypto.randomBytes(8).toString('hex')}`;
    const clientToken = `${providerIntentRef}_secret_${crypto.randomBytes(12).toString('hex')}`;
    return { providerIntentRef, clientToken };
  }
}
