import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { PaymentIntentStatus } from '../payments.types';

export const paymentIntents = sqliteTable(
  'payment_intents',
  {
    intentId: text('intent_id').primaryKey(),
    tenantAppId: text('tenant_app_id').notNull(),
    orderId: text('order_id').notNull(),
    provider: text('provider').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    nonce: text('nonce').notNull(),
    status: text('status').$type<PaymentIntentStatus>().notNull().default('CREATED'),
    claimed: integer('claimed').notNull().default(0),
    transactionHandle: text('transaction_handle'),
    providerRef: text('provider_ref'),
    providerIntentRef: text('provider_intent_ref'),
    failureSubCode: text('failure_sub_code'),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_payment_intents_tenant').on(table.tenantAppId),
  })
);

export const paymentWebhookEvents = sqliteTable('payment_webhook_events', {
  eventId: text('event_id').primaryKey(),
  processedAt: integer('processed_at').notNull(),
});

export const tenantKeys = sqliteTable('tenant_keys', {
  tenantAppId: text('tenant_app_id').primaryKey(),
  keyBase64: text('key_base64').notNull(),
  algorithm: text('algorithm').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
