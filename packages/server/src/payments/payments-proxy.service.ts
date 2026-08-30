import { PaymentDriver } from './drivers/driver.types';
import { PaymentsIdempotencyService } from './payments-idempotency.service';
import { TenantKeysService } from './tenant-keys.service';
import { CreateIntentRequest, PaymentIntentRecord, PaymentIntentStatus } from './payments.types';

export class PaymentProxyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

/**
 * Server Payment Proxy orchestrator (Task 10206d / §5.4). Holds no PSP secrets itself — those
 * live only inside each `PaymentDriver` — and is the single source of truth for intent state.
 */
export class PaymentsProxyService {
  constructor(
    private readonly idempotency: PaymentsIdempotencyService,
    private readonly tenantKeys: TenantKeysService,
    private readonly drivers: Map<string, PaymentDriver>
  ) {}

  public createIntent(req: CreateIntentRequest): PaymentIntentRecord {
    if (!this.drivers.has(req.provider)) {
      throw new PaymentProxyError('PROVIDER_NOT_REGISTERED', `No driver registered for provider '${req.provider}'.`);
    }
    return this.idempotency.createIntent(req);
  }

  public getTenantPublicKey(tenantAppId: string) {
    return this.tenantKeys.get(tenantAppId);
  }

  public registerTenantPublicKey(tenantAppId: string, keyBase64: string, algorithm: 'Ed25519' | 'ECDSA_P256' = 'Ed25519'): void {
    this.tenantKeys.register({ tenantAppId, keyBase64, algorithm });
  }

  public claimIntent(intentId: string): { claimed: boolean; record?: PaymentIntentRecord } {
    return this.idempotency.claim(intentId);
  }

  public async mintClientToken(intentId: string): Promise<string> {
    const record = this.idempotency.getIntent(intentId);
    if (!record) {
      throw new PaymentProxyError('PAYMENT_INTENT_INVALID', `Unknown intentId '${intentId}'.`);
    }
    const driver = this.drivers.get(record.provider);
    if (!driver) {
      throw new PaymentProxyError('PROVIDER_NOT_REGISTERED', `No driver registered for provider '${record.provider}'.`);
    }
    const providerIntent = await driver.createProviderIntent({
      intentId: record.intentId,
      amount: record.amount,
      currency: record.currency,
      orderId: record.orderId,
    });
    this.idempotency.setProviderIntentRef(intentId, providerIntent.providerIntentRef);
    return providerIntent.clientToken;
  }

  public confirmIntent(
    intentId: string,
    status: PaymentIntentStatus,
    extra?: { transactionHandle?: string; providerRef?: string; failureSubCode?: string }
  ): PaymentIntentRecord | undefined {
    return this.idempotency.transition(intentId, status, extra);
  }

  public cancelIntent(intentId: string): PaymentIntentRecord | undefined {
    return this.idempotency.transition(intentId, 'CANCELLED');
  }

  public getIntent(intentId: string): PaymentIntentRecord | undefined {
    return this.idempotency.getIntent(intentId);
  }

  /** Applies PSP webhook-reported settlement under the same monotonic transition rule. */
  public applyWebhookEvent(
    eventId: string,
    intentId: string,
    status: PaymentIntentStatus,
    extra?: { transactionHandle?: string; providerRef?: string }
  ): { applied: boolean; record?: PaymentIntentRecord } {
    if (this.idempotency.isWebhookEventProcessed(eventId)) {
      return { applied: false, record: this.idempotency.getIntent(intentId) };
    }
    this.idempotency.markWebhookEventProcessed(eventId);
    const record = this.idempotency.transition(intentId, status, extra);
    return { applied: true, record };
  }

  public purgeExpired(): void {
    this.idempotency.purgeExpired();
  }
}
