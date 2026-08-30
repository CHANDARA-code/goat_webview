import { Router, Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { PaymentsProxyService } from './payments-proxy.service';
import { PaymentIntentStatus } from './payments.types';

const WEBHOOK_STATUSES: PaymentIntentStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];

function verifyWebhookSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * PSP webhook reconciliation API (Task 10206d / §5.4, §9): one route per PSP, verifies the
 * webhook's shared-secret header (a stand-in here for each PSP's real signature scheme —
 * Stripe-Signature, Alipay's `sign` field, etc., which a production driver would verify),
 * dedupes by `eventId`, and applies the monotonic state transition. `SUCCEEDED` reached via a
 * webhook overrides any provisional client-sent `CANCELLED` (Task 10206 / §9 monotonic engine).
 */
export function createPaymentsWebhookRouter(proxy: PaymentsProxyService): Router {
  const router = Router();

  router.post('/pay/webhooks/:psp', (req: Request, res: Response) => {
    const expectedSecret = process.env.GOAT_WEBHOOK_SHARED_SECRET;
    if (!expectedSecret) {
      res.status(503).json({ error: 'Webhook shared secret is not configured' });
      return;
    }
    if (!verifyWebhookSecret(req.headers['x-goat-webhook-secret'], expectedSecret)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const { eventId, intentId, status, transactionHandle, providerRef } = req.body ?? {};
    if (!eventId || !intentId || !WEBHOOK_STATUSES.includes(status)) {
      res.status(400).json({ error: 'eventId, intentId, and a terminal status are required' });
      return;
    }

    const result = proxy.applyWebhookEvent(eventId, intentId, status, { transactionHandle, providerRef });
    if (!result.record) {
      res.status(404).json({ error: `Unknown intentId '${intentId}'` });
      return;
    }

    res.json({
      psp: req.params.psp,
      applied: result.applied,
      intentId: result.record.intentId,
      status: result.record.status,
    });
  });

  return router;
}
