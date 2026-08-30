import { Router, Request, Response } from 'express';
import { requirePaymentsAuth } from '../auth/api-auth.middleware';
import { PaymentProxyError, PaymentsProxyService } from './payments-proxy.service';
import { PaymentIntentStatus } from './payments.types';

function intentToJson(record: ReturnType<PaymentsProxyService['getIntent']>) {
  if (!record) return null;
  return {
    intentId: record.intentId,
    orderId: record.orderId,
    provider: record.provider,
    amount: record.amount,
    currency: record.currency,
    nonce: record.nonce,
    status: record.status,
    expiresAt: record.expiresAt,
    transactionHandle: record.transactionHandle,
    providerRef: record.providerRef,
    failureSubCode: record.failureSubCode,
  };
}

/**
 * Server Payment Proxy REST API (Task 10206d): `POST /pay/intents`, `POST /pay/intents/:id/claim`,
 * `GET /pay/intents/:id/client-token`, `POST /pay/intents/:id/confirm`,
 * `POST /pay/intents/:id/cancel`, `GET /pay/intents/:id`.
 */
export function createPaymentsRouter(proxy: PaymentsProxyService): Router {
  const router = Router();

  router.post('/pay/intents', (req: Request, res: Response) => {
    try {
      const { tenantAppId, orderId, provider, amount, currency } = req.body ?? {};
      if (!tenantAppId || !orderId || !provider || typeof amount !== 'number' || !currency) {
        res.status(400).json({ error: 'tenantAppId, orderId, provider, amount, and currency are required' });
        return;
      }
      const record = proxy.createIntent({ tenantAppId, orderId, provider, amount, currency });
      res.status(201).json(intentToJson(record));
    } catch (err: any) {
      const status = err instanceof PaymentProxyError ? 400 : 500;
      res.status(status).json({ error: err.message, code: err.code });
    }
  });

  router.post('/pay/intents/:id/claim', (req: Request, res: Response) => {
    const { tenantAppId } = req.body ?? {};
    if (!tenantAppId) {
      res.status(400).json({ error: 'tenantAppId is required' });
      return;
    }
    const result = proxy.claimIntent(req.params.id);
    if (!result.record) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    if (result.record.tenantAppId !== tenantAppId) {
      res.status(403).json({ error: 'tenantAppId does not match the intent owner' });
      return;
    }
    res.json({ claimed: result.claimed, priorOutcome: result.claimed ? undefined : intentToJson(result.record) });
  });

  router.get('/pay/intents/:id/client-token', async (req: Request, res: Response) => {
    try {
      const clientToken = await proxy.mintClientToken(req.params.id);
      res.json({ clientToken });
    } catch (err: any) {
      const status = err instanceof PaymentProxyError ? 400 : 500;
      res.status(status).json({ error: err.message, code: err.code });
    }
  });

  router.post('/pay/intents/:id/confirm', requirePaymentsAuth, (req: Request, res: Response) => {
    const { status, transactionHandle, providerRef, failureSubCode, tenantAppId } = req.body ?? {};
    const validStatuses: PaymentIntentStatus[] = [
      'CREATED', 'CLAIMED', 'PROCESSING', 'DISMISSED', 'AUTHORIZED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status '${status}'` });
      return;
    }
    if (!tenantAppId) {
      res.status(400).json({ error: 'tenantAppId is required' });
      return;
    }
    const existing = proxy.getIntent(req.params.id);
    if (!existing) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    if (existing.tenantAppId !== tenantAppId) {
      res.status(403).json({ error: 'tenantAppId does not match the intent owner' });
      return;
    }
    const record = proxy.confirmIntent(req.params.id, status, { transactionHandle, providerRef, failureSubCode });
    if (!record) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    res.json(intentToJson(record));
  });

  router.post('/pay/intents/:id/cancel', requirePaymentsAuth, (req: Request, res: Response) => {
    const { tenantAppId } = req.body ?? {};
    if (!tenantAppId) {
      res.status(400).json({ error: 'tenantAppId is required' });
      return;
    }
    const existing = proxy.getIntent(req.params.id);
    if (!existing) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    if (existing.tenantAppId !== tenantAppId) {
      res.status(403).json({ error: 'tenantAppId does not match the intent owner' });
      return;
    }
    const record = proxy.cancelIntent(req.params.id);
    if (!record) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    res.json(intentToJson(record));
  });

  router.get('/pay/intents/:id', (req: Request, res: Response) => {
    const record = proxy.getIntent(req.params.id);
    if (!record) {
      res.status(404).json({ error: `Unknown intentId '${req.params.id}'` });
      return;
    }
    res.json(intentToJson(record));
  });

  return router;
}
