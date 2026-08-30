import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as http from 'http';
import { DatabaseService } from './database/database.service';
import { TracesService } from './traces/traces.service';
import { CDPTargetManagerService } from './cdp/cdp-target-manager.service';
import { CDPRelayGateway } from './cdp/cdp-relay.gateway';
import { createCDPDiscoveryRouter } from './cdp/cdp-discovery.controller';
import { PairingSessionManagerService } from './pairing/pairing-session-manager.service';
import { createPairingRouter } from './pairing/pairing.controller';
import { TunnelGateway } from './pairing/tunnel.gateway';
import { ManifestAssetService } from './manifest/manifest-asset.service';
import { createManifestAssetRouter } from './manifest/manifest-asset.controller';
import { createHealthRouter } from './health/health.controller';
import { createTracesRouter } from './traces/traces.controller';
import { OtaService } from './ota/services/ota.service';
import { OtaGovernanceService } from './ota/services/ota-governance.service';
import { createOtaRouter } from './ota/controllers/ota.controller';
import { createOtaDashboardRouter } from './ota/controllers/ota-dashboard.controller';
import { PaymentsIdempotencyService } from './payments/payments-idempotency.service';
import { TenantKeysService } from './payments/tenant-keys.service';
import { PaymentsProxyService } from './payments/payments-proxy.service';
import { createPaymentsRouter } from './payments/payments.controller';
import { createTenantKeysRouter } from './payments/tenant-keys.controller';
import { createPaymentsWebhookRouter } from './payments/payments-webhook.controller';
import { PaymentDriver } from './payments/drivers/driver.types';
import { StripeDriver } from './payments/drivers/stripe.driver';
import { AlipayDriver } from './payments/drivers/alipay.driver';
import { PayPayDriver } from './payments/drivers/paypay.driver';
import { BakongDriver } from './payments/drivers/bakong.driver';

export interface GoatServerOptions {
  port?: number;
  cdpPort?: number;
  safariPort?: number;
  host?: string;
  dbPath?: string;
  inMemoryDb?: boolean;
  mock?: boolean;
  enableCors?: boolean;
}

export interface GoatServerInstance {
  app: Express;
  httpServer: http.Server;
  cdpHttpServer?: http.Server;
  safariHttpServer?: http.Server;
  dbService: DatabaseService;
  tracesService: TracesService;
  targetManager: CDPTargetManagerService;
  cdpGateway: CDPRelayGateway;
  pairingManager: PairingSessionManagerService;
  tunnelGateway: TunnelGateway;
  manifestService: ManifestAssetService;
  otaService: OtaService;
  otaGovernanceService: OtaGovernanceService;
  paymentsProxyService: PaymentsProxyService;
  options: Required<GoatServerOptions>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createGoatServer(opts: GoatServerOptions = {}): GoatServerInstance {
  const host = opts.host || process.env.HOST || '127.0.0.1';
  const port = opts.port !== undefined ? opts.port : (Number(process.env.PORT || process.env.GOAT_SERVER_PORT) || 3001);
  const cdpPort = opts.cdpPort !== undefined ? opts.cdpPort : (Number(process.env.CDP_PORT) || 9222);
  const safariPort = opts.safariPort !== undefined ? opts.safariPort : (Number(process.env.SAFARI_PORT) || 9223);
  const dbPath = opts.dbPath || process.env.GOAT_DB_PATH || './data/goat_telemetry.db';
  const inMemoryDb = opts.inMemoryDb || dbPath === ':memory:';
  const mock = opts.mock !== undefined ? opts.mock : true;
  const enableCors = opts.enableCors !== undefined ? opts.enableCors : true;

  const resolvedOptions: Required<GoatServerOptions> = {
    port,
    cdpPort,
    safariPort,
    host,
    dbPath,
    inMemoryDb,
    mock,
    enableCors,
  };

  // Instantiate services
  const dbService = new DatabaseService({ dbPath, inMemory: inMemoryDb });
  const tracesService = new TracesService(dbService);
  const targetManager = new CDPTargetManagerService(host, cdpPort);
  const pairingManager = new PairingSessionManagerService(dbService, host, port);
  const manifestService = new ManifestAssetService(dbService);
  const otaService = new OtaService(dbService);
  const otaGovernanceService = new OtaGovernanceService();
  const paymentsIdempotencyService = new PaymentsIdempotencyService(dbService);
  const tenantKeysService = new TenantKeysService(dbService);
  const paymentDrivers = new Map<string, PaymentDriver>();
  const stripeDriver = new StripeDriver();
  paymentDrivers.set('stripe', stripeDriver);
  paymentDrivers.set('link', stripeDriver);
  paymentDrivers.set('alipay', new AlipayDriver());
  paymentDrivers.set('paypay', new PayPayDriver());
  paymentDrivers.set('bakong_khqr', new BakongDriver());
  const paymentsProxyService = new PaymentsProxyService(paymentsIdempotencyService, tenantKeysService, paymentDrivers);

  const app: Express = express();

  let corsMiddleware: ((req: Request, res: Response, next: NextFunction) => void) | null = null;
  if (enableCors) {
    const defaultCorsOrigins = [
      'https://appassets.androidplatform.net',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];
    const corsOriginAllowlist = new Set(
      (process.env.GOAT_CORS_ORIGINS || defaultCorsOrigins.join(','))
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    );
    corsMiddleware = cors({
      origin: (origin, callback) => {
        if (!origin || corsOriginAllowlist.has(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
    });
    app.use(corsMiddleware);
  }

  app.use('/api/v1', express.json({ limit: '50mb' }));
  app.use('/api/v1', express.raw({ limit: '100mb', type: ['application/octet-stream', 'application/wasm', 'image/*'] }));
  app.use('/api/traces', express.json({ limit: '50mb' }));
  app.use(['/api/assets', '/assets'], express.raw({ limit: '100mb', type: ['application/octet-stream', 'application/wasm', 'image/*'] }));
  app.use(['/api/assets', '/assets'], express.text({ limit: '50mb', type: ['text/*', 'application/javascript', 'application/xml'] }));
  app.use('/api/assets', express.json({ limit: '50mb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ limit: '1mb', type: ['text/*', 'application/javascript', 'application/xml'] }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.raw({ limit: '1mb', type: ['application/octet-stream', 'application/wasm', 'image/*'] }));

  // Mount discovery routes on main app
  const cdpDiscoveryRouter = createCDPDiscoveryRouter(targetManager, host, cdpPort);
  app.use(cdpDiscoveryRouter);

  // Mount API routers
  const tracesRouter = createTracesRouter(tracesService);
  const pairingRouter = createPairingRouter(pairingManager);
  const manifestRouter = createManifestAssetRouter(manifestService);
  const healthRouter = createHealthRouter(targetManager, pairingManager, '1.4.0');
  const otaRouter = createOtaRouter(otaService);
  const otaDashboardRouter = createOtaDashboardRouter();
  const paymentsRouter = createPaymentsRouter(paymentsProxyService);
  const tenantKeysRouter = createTenantKeysRouter(paymentsProxyService);
  const paymentsWebhookRouter = createPaymentsWebhookRouter(paymentsProxyService);

  app.use('/api', tracesRouter);
  app.use('/api', pairingRouter);
  app.use('/api', manifestRouter);
  app.use('/api', healthRouter);
  app.use('/api', paymentsRouter);
  app.use('/api', tenantKeysRouter);
  app.use('/api', paymentsWebhookRouter);
  app.use('/api/v1', otaRouter);
  app.use(otaDashboardRouter);

  // Also mount bundles and subpackages at root level as per spec
  app.use(manifestRouter);

  // Root welcome / index
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: '@goat/server',
      version: '1.4.0',
      status: 'running',
      cdpUrl: `http://${host}:${cdpPort}/json/version`,
      apiHealth: `http://${host}:${port}/api/health`,
      otaApi: `http://${host}:${port}/api/v1/ota`,
      otaDashboard: `http://${host}:${port}/admin/ota`,
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  const httpServer = http.createServer(app);

  // Gateways on primary server
  const cdpGateway = new CDPRelayGateway(httpServer, tracesService, targetManager);
  const tunnelGateway = new TunnelGateway(httpServer, pairingManager);

  let cdpHttpServer: http.Server | undefined;
  let safariHttpServer: http.Server | undefined;

  // Dedicated CDP Server if cdpPort differs from primary port and is > 0
  if (cdpPort > 0 && cdpPort !== port) {
    const cdpApp = express();
    if (corsMiddleware) cdpApp.use(corsMiddleware);
    cdpApp.use(express.json());
    cdpApp.use(createCDPDiscoveryRouter(targetManager, host, cdpPort));
    cdpHttpServer = http.createServer(cdpApp);
    new CDPRelayGateway(cdpHttpServer, tracesService, targetManager);
  }

  // Dedicated Safari WebKit Proxy Server on 9223 if needed
  if (safariPort > 0 && safariPort !== port && safariPort !== cdpPort) {
    const safariApp = express();
    if (corsMiddleware) safariApp.use(corsMiddleware);
    safariApp.use(express.json());
    safariApp.use(createCDPDiscoveryRouter(targetManager, host, safariPort));
    safariHttpServer = http.createServer(safariApp);
    new CDPRelayGateway(safariHttpServer, tracesService, targetManager);
  }

  const start = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, host, () => {
        resolve();
      });
      httpServer.once('error', reject);
    });

    if (cdpHttpServer) {
      await new Promise<void>((resolve, reject) => {
        cdpHttpServer!.listen(cdpPort, host, () => {
          resolve();
        });
        cdpHttpServer!.once('error', (err) => {
          // If port is already in use (e.g. system CDP), warn rather than crash
          console.warn(`[CDP] Notice: Port ${cdpPort} in use or restricted: ${err.message}`);
          resolve();
        });
      });
    }

    if (safariHttpServer) {
      await new Promise<void>((resolve) => {
        safariHttpServer!.listen(safariPort, host, () => {
          resolve();
        });
        safariHttpServer!.once('error', (err) => {
          console.warn(`[Safari] Notice: Port ${safariPort} in use or restricted: ${err.message}`);
          resolve();
        });
      });
    }
  };

  const stop = async (): Promise<void> => {
    cdpGateway.close();
    tunnelGateway.close();

    if (typeof (httpServer as any).closeAllConnections === 'function') {
      (httpServer as any).closeAllConnections();
    }
    if (cdpHttpServer && typeof (cdpHttpServer as any).closeAllConnections === 'function') {
      (cdpHttpServer as any).closeAllConnections();
    }
    if (safariHttpServer && typeof (safariHttpServer as any).closeAllConnections === 'function') {
      (safariHttpServer as any).closeAllConnections();
    }

    const closePromises: Promise<void>[] = [];

    closePromises.push(
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      })
    );

    if (cdpHttpServer && cdpHttpServer.listening) {
      closePromises.push(
        new Promise<void>((resolve) => {
          cdpHttpServer!.close(() => resolve());
        })
      );
    }

    if (safariHttpServer && safariHttpServer.listening) {
      closePromises.push(
        new Promise<void>((resolve) => {
          safariHttpServer!.close(() => resolve());
        })
      );
    }

    await Promise.all(closePromises);
    dbService.close();
  };

  return {
    app,
    httpServer,
    cdpHttpServer,
    safariHttpServer,
    dbService,
    tracesService,
    targetManager,
    cdpGateway,
    pairingManager,
    tunnelGateway,
    manifestService,
    otaService,
    otaGovernanceService,
    paymentsProxyService,
    options: resolvedOptions,
    start,
    stop,
  };
}
