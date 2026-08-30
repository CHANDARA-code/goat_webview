import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../auth/api-auth.middleware';
import { PaymentsProxyService } from './payments-proxy.service';

/**
 * Zone 4 tenant public key directory API (Task 10206 / §7 L2). `GET` is what native fetches
 * out-of-band during signature verification; `POST` is the one-time tenant onboarding step that
 * registers the public half of a mini-app backend's payment-intent signing key.
 */
export function createTenantKeysRouter(proxy: PaymentsProxyService): Router {
  const router = Router();

  router.get('/tenant-keys/:tenantAppId', (req: Request, res: Response) => {
    const record = proxy.getTenantPublicKey(req.params.tenantAppId);
    if (!record) {
      res.status(404).json({ error: `No public key registered for tenant '${req.params.tenantAppId}'` });
      return;
    }
    res.json({ tenantAppId: record.tenantAppId, publicKeyBase64: record.keyBase64, algorithm: record.algorithm });
  });

  router.post('/tenant-keys/:tenantAppId', requireAdminAuth, (req: Request, res: Response) => {
    const { publicKeyBase64, algorithm } = req.body ?? {};
    if (!publicKeyBase64) {
      res.status(400).json({ error: 'publicKeyBase64 is required' });
      return;
    }
    const resolvedAlgorithm = algorithm === 'ECDSA_P256' ? 'ECDSA_P256' : 'Ed25519';
    proxy.registerTenantPublicKey(req.params.tenantAppId, publicKeyBase64, resolvedAlgorithm);
    res.status(201).json({ tenantAppId: req.params.tenantAppId, publicKeyBase64, algorithm: resolvedAlgorithm });
  });

  return router;
}
