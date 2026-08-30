import { Router, Request, Response } from 'express';
import { CDPTargetManagerService } from './cdp-target-manager.service';
import { CDPVersionResponse } from './cdp.types';

export function createCDPDiscoveryRouter(
  targetManager: CDPTargetManagerService,
  host: string = '127.0.0.1',
  cdpPort: number = 9222
): Router {
  const router = Router();

  // GET /json/version
  router.get('/json/version', (req: Request, res: Response) => {
    const versionInfo: CDPVersionResponse = {
      Browser: 'GoatEngine/1.4.0 (Node/24.12.0 Chrome/124.0.0.0 Mobile)',
      'Protocol-Version': '1.3',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; GoatEngine/1.4.0) AppleWebKit/537.36',
      'V8-Version': '12.4.254.20',
      'WebKit-Version': '537.36 (@goat-engine-v1.4.0)',
      webSocketDebuggerUrl: `ws://${host}:${cdpPort}/devtools/browser/root-relay-instance`,
    };
    res.json(versionInfo);
  });

  // GET /json/list and GET /json
  const listHandler = (req: Request, res: Response) => {
    const targets = targetManager.listTargets();
    res.json(targets);
  };
  router.get('/json/list', listHandler);
  router.get('/json', listHandler);

  // GET /json/new or PUT /json/new
  const newTargetHandler = (req: Request, res: Response) => {
    const url = (req.query.url as string) || 'about:blank';
    const title = (req.query.title as string) || 'New Tab';
    const appId = (req.query.appId as string) || 'com.goat.new';
    const target = targetManager.createTarget({ url, title, appId });
    res.status(201).json(target);
  };
  router.get('/json/new', newTargetHandler);
  router.put('/json/new', newTargetHandler);

  // GET /json/activate/:id
  router.get('/json/activate/:id', (req: Request, res: Response) => {
    const success = targetManager.activateTarget(req.params.id);
    if (success) {
      res.send('Target activated');
    } else {
      res.status(404).send('No such target');
    }
  });

  // GET /json/close/:id
  router.get('/json/close/:id', (req: Request, res: Response) => {
    const success = targetManager.closeTarget(req.params.id);
    if (success) {
      res.send('Target is closing');
    } else {
      res.status(404).send('No such target');
    }
  });

  // GET /json/protocol
  router.get('/json/protocol', (req: Request, res: Response) => {
    res.json({
      version: { major: '1', minor: '3' },
      domains: [
        { domain: 'Page', version: '1.3' },
        { domain: 'Runtime', version: '1.3' },
        { domain: 'DOM', version: '1.3' },
        { domain: 'Network', version: '1.3' },
        { domain: 'Console', version: '1.3' },
        { domain: 'GoatBridge', version: '1.0' },
      ],
    });
  });

  return router;
}
