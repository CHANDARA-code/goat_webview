import * as crypto from 'node:crypto';
import { eq, and, sql, lt, notInArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { paymentIntents, paymentWebhookEvents } from './schema/payments.schema';
import { CreateIntentRequest, PaymentIntentRecord, PaymentIntentStatus } from './payments.types';

const INTENT_TTL_MS = 5 * 60_000;
const NONCE_GRACE_MS = 2 * 60_000;

type PaymentIntentRow = typeof paymentIntents.$inferSelect;

function rowToRecord(row: PaymentIntentRow | undefined): PaymentIntentRecord | undefined {
  if (!row) return undefined;
  return {
    intentId: row.intentId,
    tenantAppId: row.tenantAppId,
    orderId: row.orderId,
    provider: row.provider,
    amount: row.amount,
    currency: row.currency,
    nonce: row.nonce,
    status: row.status as PaymentIntentStatus,
    transactionHandle: row.transactionHandle ?? undefined,
    providerRef: row.providerRef ?? undefined,
    providerIntentRef: row.providerIntentRef ?? undefined,
    failureSubCode: row.failureSubCode ?? undefined,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export class PaymentsIdempotencyService {
  private readonly db: any;

  constructor(dbService: DatabaseService) {
    this.db = dbService.db;
  }

  public createIntent(req: CreateIntentRequest): PaymentIntentRecord {
    const intentId = `pi_goat_${crypto.randomBytes(8).toString('hex')}`;
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    this.db
      .insert(paymentIntents)
      .values({
        intentId,
        tenantAppId: req.tenantAppId,
        orderId: req.orderId,
        provider: req.provider,
        amount: req.amount,
        currency: req.currency,
        nonce,
        status: 'CREATED',
        claimed: 0,
        createdAt: now,
        expiresAt: now + INTENT_TTL_MS,
        updatedAt: now,
      })
      .run();
    return this.getIntent(intentId)!;
  }

  public getIntent(intentId: string): PaymentIntentRecord | undefined {
    const row = this.db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.intentId, intentId))
      .get();
    return rowToRecord(row);
  }

  public claim(intentId: string): { claimed: boolean; record?: PaymentIntentRecord } {
    const now = Date.now();
    const result = this.db
      .update(paymentIntents)
      .set({
        claimed: 1,
        status: sql`CASE WHEN ${paymentIntents.status} = 'CREATED' THEN 'CLAIMED' ELSE ${paymentIntents.status} END`,
        updatedAt: now,
      })
      .where(and(eq(paymentIntents.intentId, intentId), eq(paymentIntents.claimed, 0)))
      .run();
    const record = this.getIntent(intentId);
    if (!record) return { claimed: false };
    const claimed = (result.changes ?? 0) > 0;
    return { claimed, record };
  }

  public setProviderIntentRef(intentId: string, providerIntentRef: string): void {
    this.db
      .update(paymentIntents)
      .set({ providerIntentRef, updatedAt: Date.now() })
      .where(eq(paymentIntents.intentId, intentId))
      .run();
  }

  public transition(
    intentId: string,
    next: PaymentIntentStatus,
    extra?: Partial<Pick<PaymentIntentRecord, 'transactionHandle' | 'providerRef' | 'failureSubCode'>>
  ): PaymentIntentRecord | undefined {
    const record = this.getIntent(intentId);
    if (!record) return undefined;

    if (record.status === 'SUCCEEDED') {
      return record;
    }

    this.db
      .update(paymentIntents)
      .set({
        status: next,
        transactionHandle: sql`COALESCE(${extra?.transactionHandle ?? null}, ${paymentIntents.transactionHandle})`,
        providerRef: sql`COALESCE(${extra?.providerRef ?? null}, ${paymentIntents.providerRef})`,
        failureSubCode: sql`COALESCE(${extra?.failureSubCode ?? null}, ${paymentIntents.failureSubCode})`,
        updatedAt: Date.now(),
      })
      .where(eq(paymentIntents.intentId, intentId))
      .run();

    return this.getIntent(intentId);
  }

  public isWebhookEventProcessed(eventId: string): boolean {
    const row = this.db
      .select({ eventId: paymentWebhookEvents.eventId })
      .from(paymentWebhookEvents)
      .where(eq(paymentWebhookEvents.eventId, eventId))
      .get();
    return row !== undefined;
  }

  public markWebhookEventProcessed(eventId: string): void {
    this.db
      .insert(paymentWebhookEvents)
      .values({ eventId, processedAt: Date.now() })
      .onConflictDoNothing()
      .run();
  }

  public purgeExpired(now: number = Date.now()): void {
    this.db
      .update(paymentIntents)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(
        and(
          notInArray(paymentIntents.status, ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']),
          lt(paymentIntents.expiresAt, now - NONCE_GRACE_MS)
        )
      )
      .run();
  }
}
