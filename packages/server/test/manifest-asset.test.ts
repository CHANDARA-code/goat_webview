import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

const ADMIN_AUTH = { Authorization: 'Bearer test_admin_token' };

describe('Mini-App Manifest & Asset Cache Server', () => {
  let server: GoatServerInstance;

  beforeEach(async () => {
    process.env.GOAT_ADMIN_TOKEN = 'test_admin_token';
    server = createGoatServer({
      port: 0,
      cdpPort: 0,
      safariPort: 0,
      inMemoryDb: true,
      enableCors: true,
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    delete process.env.GOAT_ADMIN_TOKEN;
  });

  it('should serve and validate default manifest with ETag headers', async () => {
    const res = await request(server.app).get('/api/manifest/com.goat.default').expect(200);

    expect(res.body.appId).toBe('com.goat.default');
    expect(res.body.name).toBe('Goat MiniApp Container');
    expect(res.headers.etag).toBeDefined();

    // Test 304 Not Modified
    const cachedRes = await request(server.app)
      .get('/api/manifest/com.goat.default')
      .set('If-None-Match', res.headers.etag)
      .expect(304);

    expect(cachedRes.text).toBe('');
  });

  it('should validate manifest schema via POST /api/manifest/validate', async () => {
    const validManifest = {
      appId: 'com.goat.wallet',
      name: 'Goat Wallet',
      version: '1.0.0',
      entry: 'index.html',
      pages: ['pages/home', 'pages/cards'],
      window: {
        navigationBarTitleText: 'My Wallet',
        navigationBarBackgroundColor: '#121212',
        navigationBarTextStyle: 'white',
      },
    };

    const validRes = await request(server.app)
      .post('/api/manifest/validate')
      .send(validManifest)
      .expect(200);

    expect(validRes.body.valid).toBe(true);
    expect(validRes.body.manifest.appId).toBe('com.goat.wallet');

    // Invalid manifest (missing pages and appId)
    const invalidRes = await request(server.app)
      .post('/api/manifest/validate')
      .send({ name: 'Broken App' })
      .expect(400);

    expect(invalidRes.body.valid).toBe(false);
    expect(invalidRes.body.error).toBeDefined();
  });

  it('should register and serve static assets with SHA-256 ETag & Cache-Control', async () => {
    const jsCode = 'console.log("Goat MiniApp Asset Loaded");';
    const appId = 'com.goat.assets-test';

    // Register asset
    const uploadRes = await request(server.app)
      .post(`/api/assets/${appId}/static/app.bundle.js`)
      .set(ADMIN_AUTH)
      .set('Content-Type', 'application/javascript')
      .send(jsCode)
      .expect(201);

    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.sha256).toBeDefined();
    expect(uploadRes.body.etag).toBeDefined();

    // Serve asset
    const getRes = await request(server.app)
      .get(`/api/assets/${appId}/static/app.bundle.js`)
      .expect(200);

    expect(getRes.text).toBe(jsCode);
    expect(getRes.headers['content-type']).toContain('application/javascript');
    expect(getRes.headers['cache-control']).toContain('max-age=31536000');
    expect(getRes.headers.etag).toBe(uploadRes.body.etag);

    // Test 304 caching
    await request(server.app)
      .get(`/api/assets/${appId}/static/app.bundle.js`)
      .set('If-None-Match', getRes.headers.etag)
      .expect(304);
  });

  it('should serve bundles and subpackages via shortcut routes', async () => {
    const appId = 'com.goat.bundles-test';
    server.manifestService.registerAsset(
      appId,
      'main.bundle.js',
      'export default function() { return 42; };',
      'application/javascript'
    );
    server.manifestService.registerAsset(
      appId,
      'subpackage-pay.goat',
      Buffer.from([0x00, 0x67, 0x6f, 0x61, 0x74]),
      'application/octet-stream'
    );

    // /bundles/:appId/:bundleName
    const bundleRes = await request(server.app).get(`/bundles/${appId}/main.bundle.js`).expect(200);
    expect(bundleRes.text).toContain('export default');

    // /subpackages/:appId/:subpackageName
    const subRes = await request(server.app).get(`/subpackages/${appId}/subpackage-pay.goat`).expect(200);
    expect(subRes.body).toBeDefined();
  });

  it('should canonicalize asset paths with redundant ./, ../, and leading slashes', async () => {
    const appId = 'com.goat.normalize-test';

    // 1. Register asset with redundant parent traversal
    server.manifestService.registerAsset(
      appId,
      'pages/sub/../sub/index.js',
      'console.log("sub index");',
      'application/javascript'
    );

    // 2. Register asset with leading dot-slash
    server.manifestService.registerAsset(
      appId,
      './pages/home/index.js',
      'console.log("home index");',
      'application/javascript'
    );

    // 3. Register asset with leading slashes
    server.manifestService.registerAsset(
      appId,
      '///pages/settings/index.js',
      'console.log("settings index");',
      'application/javascript'
    );

    // Verify retrieval via normalized clean key
    const subRes = await request(server.app).get(`/api/assets/${appId}/pages/sub/index.js`).expect(200);
    expect(subRes.text).toBe('console.log("sub index");');

    const homeRes = await request(server.app).get(`/api/assets/${appId}/pages/home/index.js`).expect(200);
    expect(homeRes.text).toBe('console.log("home index");');

    const settingsRes = await request(server.app).get(`/api/assets/${appId}/pages/settings/index.js`).expect(200);
    expect(settingsRes.text).toBe('console.log("settings index");');

    // Direct manifest service lookup should also resolve cleanly
    const directRecord = server.manifestService.getAsset(appId, './pages/sub/../sub/index.js');
    expect(directRecord).toBeDefined();
    expect(directRecord?.path).toBe('pages/sub/index.js');
  });

  it('should reject unauthenticated manifest registration with 401', async () => {
    await request(server.app)
      .post('/api/manifest/com.goat.secure-app')
      .send({ name: 'Secure App', version: '1.0.0', entry: 'index.html', pages: ['pages/index'] })
      .expect(401);

    await request(server.app)
      .post('/api/manifest/com.goat.secure-app')
      .set({ Authorization: 'Bearer wrong_token' })
      .send({ name: 'Secure App', version: '1.0.0', entry: 'index.html', pages: ['pages/index'] })
      .expect(401);
  });

  it('should register manifests with a valid admin bearer token', async () => {
    const res = await request(server.app)
      .post('/api/manifest/com.goat.secure-app')
      .set(ADMIN_AUTH)
      .send({ name: 'Secure App', version: '1.0.0', entry: 'index.html', pages: ['pages/index'] })
      .expect(201);

    expect(res.body.appId).toBe('com.goat.secure-app');
  });

  it('should reject unauthenticated asset uploads with 401', async () => {
    await request(server.app)
      .post('/api/assets/com.goat.secure-assets/static/app.js')
      .send('console.log("unauthorized");')
      .expect(401);

    await request(server.app)
      .post('/api/assets/com.goat.secure-assets/static/app.js')
      .set({ Authorization: 'Bearer wrong_token' })
      .send('console.log("unauthorized");')
      .expect(401);
  });

  it('should still serve assets and manifests anonymously (GET stays open)', async () => {
    await request(server.app)
      .post('/api/assets/com.goat.anon/assets/app.js')
      .set(ADMIN_AUTH)
      .set('Content-Type', 'application/javascript')
      .send('console.log("anonymous read");')
      .expect(201);

    const getRes = await request(server.app)
      .get('/api/assets/com.goat.anon/assets/app.js')
      .expect(200);
    expect(getRes.text).toBe('console.log("anonymous read");');

    await request(server.app).get('/api/manifest/com.goat.default').expect(200);
  });
});

describe('Manifest persistence across restarts', () => {
  it('persists registered manifests and assets to sqlite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-manifest-'));
    const dbPath = path.join(dir, 'manifest.db');
    try {
      const first = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, dbPath, inMemoryDb: false });
      const manifest = {
        appId: 'com.goat.persist',
        name: 'Persisted MiniApp',
        version: '2.0.0',
        entry: 'index.html',
        pages: ['pages/home'],
        window: { navigationBarTitleText: 'Persisted' },
      };
      first.manifestService.registerManifest('com.goat.persist', manifest as any);
      first.manifestService.registerAsset('com.goat.persist', 'app.js', Buffer.from('console.log("persisted");'), 'application/javascript');
      first.dbService.close();

      const second = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, dbPath, inMemoryDb: false });
      try {
        const reloaded = second.manifestService.getManifest('com.goat.persist');
        expect(reloaded?.name).toBe('Persisted MiniApp');
        const asset = second.manifestService.getAsset('com.goat.persist', 'app.js');
        expect(asset?.content.toString()).toBe('console.log("persisted");');
        expect(asset?.sha256).toBeTruthy();
      } finally {
        second.dbService.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
