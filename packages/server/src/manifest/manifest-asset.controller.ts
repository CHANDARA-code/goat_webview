import { Router, Request, Response, raw } from 'express';
import { requireAdminAuth } from '../auth/api-auth.middleware';
import { ManifestAssetService } from './manifest-asset.service';

export function createManifestAssetRouter(service: ManifestAssetService): Router {
  const router = Router();

  // POST /api/manifest/validate
  router.post('/manifest/validate', (req: Request, res: Response) => {
    const result = service.validateManifest(req.body);
    if (!result.success) {
      res.status(400).json({ valid: false, error: result.error });
      return;
    }
    res.json({ valid: true, manifest: result.data });
  });

  // GET /api/manifest/:appId
  router.get('/manifest/:appId', (req: Request, res: Response) => {
    const appId = req.params.appId;
    const manifest = service.getManifest(appId);
    if (!manifest) {
      res.status(404).json({ error: `Manifest not found for appId: ${appId}` });
      return;
    }

    const etag = `"${manifest.sha256}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(manifest);
  });

  // POST /api/manifest/:appId
  router.post('/manifest/:appId', requireAdminAuth, (req: Request, res: Response) => {
    try {
      const appId = req.params.appId;
      const body = { ...req.body, appId };
      const saved = service.registerManifest(appId, body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Common asset server helper
  const serveAsset = (appId: string, assetPath: string, req: Request, res: Response) => {
    const asset = service.getAsset(appId, assetPath);
    if (!asset) {
      res.status(404).json({ error: `Asset not found: ${assetPath} for appId: ${appId}` });
      return;
    }

    if (req.headers['if-none-match'] === asset.etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('ETag', asset.etag);
    res.setHeader('Content-Length', asset.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(asset.content);
  };

  // GET /bundles/:appId/:bundleName
  router.get('/bundles/:appId/:bundleName', (req: Request, res: Response) => {
    serveAsset(req.params.appId, req.params.bundleName, req, res);
  });

  // GET /subpackages/:appId/:subpackageName
  router.get('/subpackages/:appId/:subpackageName', (req: Request, res: Response) => {
    serveAsset(req.params.appId, req.params.subpackageName, req, res);
  });

  // POST /api/assets/:appId/*
  router.post('/assets/:appId/*', requireAdminAuth, (req: Request, res: Response) => {
    const appId = req.params.appId;
    const rawPath = req.params[0] || 'index.html';

    let content: Buffer;
    if (Buffer.isBuffer(req.body)) {
      content = req.body;
    } else if (typeof req.body === 'string') {
      content = Buffer.from(req.body);
    } else {
      content = Buffer.from(JSON.stringify(req.body));
    }

    const contentType = req.headers['content-type'] as string | undefined;
    const record = service.registerAsset(appId, rawPath, content, contentType);
    res.status(201).json({
      success: true,
      path: record.path,
      sha256: record.sha256,
      etag: record.etag,
      size: record.size,
    });
  });

  // GET /api/assets/:appId/*
  router.get('/assets/:appId/*', (req: Request, res: Response) => {
    const appId = req.params.appId;
    const rawPath = req.params[0] || 'index.html';
    serveAsset(appId, rawPath, req, res);
  });

  return router;
}
