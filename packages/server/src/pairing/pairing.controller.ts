import { Router, Request, Response } from 'express';
import { PairingSessionManagerService } from './pairing-session-manager.service';
import { HandshakeRequest } from './pairing.types';

export function createPairingRouter(pairingManager: PairingSessionManagerService): Router {
  const router = Router();

  // POST /api/pair/init
  router.post('/pair/init', async (req: Request, res: Response) => {
    try {
      const appId = req.body?.appId || 'com.goat.app';
      const port = req.body?.port ? Number(req.body.port) : undefined;
      const session = await pairingManager.createSession(appId, port);
      res.status(201).json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/pair/handshake
  router.post('/pair/handshake', (req: Request, res: Response) => {
    try {
      const body = req.body as HandshakeRequest;
      if (!body || !body.token || !body.deviceInfo) {
        res.status(400).json({ error: 'token and deviceInfo are required' });
        return;
      }
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const session = pairingManager.handshake(body.token, body.deviceInfo, clientIp);
      if (!session) {
        res.status(404).json({ error: `Pairing session not found or closed for token: ${body.token}` });
        return;
      }
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pair/status/:token
  router.get('/pair/status/:token', (req: Request, res: Response) => {
    try {
      const session = pairingManager.getSession(req.params.token);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({
        token: session.token,
        status: session.status,
        deviceName: session.deviceName,
        platform: session.platform,
        connectedAt: session.connectedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pair/qr/:token
  router.get('/pair/qr/:token', (req: Request, res: Response) => {
    try {
      const session = pairingManager.getSession(req.params.token);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      const format = req.query.format as string;
      if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(session.qrSvg);
      } else if (format === 'terminal') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(session.qrTerminal);
      } else {
        res.json({
          token: session.token,
          pairingUrl: session.pairingUrl,
          qrTerminal: session.qrTerminal,
          qrDataUrl: session.qrDataUrl,
          qrSvg: session.qrSvg,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions
  router.get('/sessions', (req: Request, res: Response) => {
    try {
      const status = req.query.status as any;
      const sessions = pairingManager.listSessions(status);
      res.json({ total: sessions.length, data: sessions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
