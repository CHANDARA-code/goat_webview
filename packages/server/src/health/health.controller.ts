import { Router, Request, Response } from 'express';
import { CDPTargetManagerService } from '../cdp/cdp-target-manager.service';
import { PairingSessionManagerService } from '../pairing/pairing-session-manager.service';

export function createHealthRouter(
  targetManager: CDPTargetManagerService,
  pairingManager: PairingSessionManagerService,
  version: string = '1.4.0'
): Router {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', (req: Request, res: Response) => {
    const memory = process.memoryUsage();
    const activeTargets = targetManager.listTargets().length;
    const activeSessions = pairingManager.listSessions('ACTIVE').length;
    const totalSessions = pairingManager.listSessions().length;

    res.json({
      status: 'ok',
      version,
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      timestamp: Date.now(),
      memory: {
        rssBytes: memory.rss,
        heapTotalBytes: memory.heapTotal,
        heapUsedBytes: memory.heapUsed,
        externalBytes: memory.external,
      },
      stats: {
        activeTargets,
        activeSessions,
        totalSessions,
      },
    });
  });

  return router;
}
