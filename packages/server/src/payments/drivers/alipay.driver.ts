import * as crypto from 'node:crypto';
import { PaymentDriver, PaymentDriverIntent, PaymentDriverParams } from './driver.types';

/**
 * Alipay KMS/HSM-backed driver (Task 10206d). `appPrivateKey` is read once from the environment
 * and never returned to any caller — only an opaque `orderInfo` blob for the native `PayTask`
 * SDK / `alipays://` app2app deep link is minted per request.
 *
 * REFERENCE SIMULATION (v1.0.0): this driver makes no real Alipay network call and does not sign
 * `orderInfo` with `appPrivateKey`. The blob it returns is structurally shaped but not accepted by
 * a real Alipay endpoint. Do not point it at production traffic — a production driver must
 * implement Alipay's API behind this same `PaymentDriver` interface. See payment-gate-way-arch.md §5.
 */
export class AlipayDriver implements PaymentDriver {
  public readonly providerId = 'alipay';

  constructor(private readonly appPrivateKey: string = process.env.GOAT_ALIPAY_APP_PRIVATE_KEY || 'dev_placeholder') {}

  public async createProviderIntent(params: PaymentDriverParams): Promise<PaymentDriverIntent> {
    void this.appPrivateKey;
    const providerIntentRef = `alipay_${crypto.randomBytes(8).toString('hex')}`;
    const orderInfo =
      `partner="goat_webview"&out_trade_no="${params.orderId}"&subject="Goat WebView Order"` +
      `&total_fee="${(params.amount / 100).toFixed(2)}"&notify_url="pending"&intent_ref="${providerIntentRef}"`;
    return { providerIntentRef, clientToken: orderInfo };
  }
}
