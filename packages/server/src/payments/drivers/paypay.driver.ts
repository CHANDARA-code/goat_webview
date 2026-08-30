import * as crypto from 'node:crypto';
import { PaymentDriver, PaymentDriverIntent, PaymentDriverParams } from './driver.types';

/**
 * PayPay KMS/HSM-backed driver (Task 10206d). `apiSecret` is read once from the environment and
 * never returned to any caller — only an opaque `merchantPaymentId` for the native OPA SDK /
 * `paypay://` app2app deep link is minted per request.
 *
 * REFERENCE SIMULATION (v1.0.0): this driver makes no real PayPay/OPA network call. The
 * `merchantPaymentId` it returns is locally generated and not registered with PayPay. Do not point
 * it at production traffic — a production driver must implement PayPay's OPA API behind this same
 * `PaymentDriver` interface. See payment-gate-way-arch.md §5.
 */
export class PayPayDriver implements PaymentDriver {
  public readonly providerId = 'paypay';

  constructor(private readonly apiSecret: string = process.env.GOAT_PAYPAY_API_SECRET || 'dev_placeholder') {}

  public async createProviderIntent(params: PaymentDriverParams): Promise<PaymentDriverIntent> {
    void this.apiSecret;
    const providerIntentRef = `paypay_${crypto.randomBytes(8).toString('hex')}`;
    const merchantPaymentId = `mpid_${params.orderId}_${crypto.randomBytes(6).toString('hex')}`;
    return { providerIntentRef, clientToken: merchantPaymentId };
  }
}
