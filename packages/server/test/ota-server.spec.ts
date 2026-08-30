import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import * as crypto from 'crypto';
import {
  createGoatServer,
  GoatServerInstance,
  generateBsdiffPatch,
  applyBsdiffPatch,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  computeSha256,
  isDeviceInCanaryBucket,
} from '../src/index';

const ADMIN_AUTH = { Authorization: 'Bearer test_admin_token' };

describe('OTA Server REST APIs & Release Management Dashboard Suite', () => {
  let serverInstance: GoatServerInstance;
  let httpServer: http.Server;

  beforeEach(async () => {
    process.env.GOAT_ADMIN_TOKEN = 'test_admin_token';
    serverInstance = createGoatServer({ inMemoryDb: true, port: 0, cdpPort: 0, safariPort: 0 });
    httpServer = serverInstance.httpServer;
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    await serverInstance.stop();
    delete process.env.GOAT_ADMIN_TOKEN;
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Category-Partition)
  // =========================================================================
  describe('Tier 1: Feature Coverage (Category-Partition)', () => {
    it('F3-T1-1: should publish initial release v1.0.0 and compute SHA-256 + Ed25519 signature', async () => {
      const bundle = Buffer.from('Initial release bundle bytecode content for Goat Webview');
      const res = await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH)
        .send({
          version: '1.0.0',
          channel: 'production',
          rolloutPercentage: 100,
          bundleBase64: bundle.toString('base64'),
          releaseNotes: 'Initial v1.0.0 launch',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.release.version).toBe('1.0.0');
      expect(res.body.release.sha256).toBe(computeSha256(bundle));
      expect(res.body.release.signatureAlgorithm).toBe('Ed25519');
      expect(res.body.patches).toHaveLength(0);
    });

    it('F3-T1-1b: should reject unauthenticated release publishing with 401', async () => {
      const bundle = Buffer.from('Unauthenticated bundle payload');
      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases')
        .send({ version: '9.9.9', bundleBase64: bundle.toString('base64') })
        .expect(401);
    });

    it('F3-T1-1c: should reject release publishing with an invalid bearer token', async () => {
      const bundle = Buffer.from('Invalid token bundle payload');
      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases')
        .set({ Authorization: 'Bearer wrong_token' })
        .send({ version: '9.9.9', bundleBase64: bundle.toString('base64') })
        .expect(401);
    });

    it('F3-T1-2: should publish sequential release v1.1.0 and auto-generate signed BSDIFF40 delta patch', async () => {
      const v1Bundle = Buffer.from('Base bytecode string version 1.0.0 with components');
      const v2Bundle = Buffer.from('Base bytecode string version 1.1.0 with components and extra features');

      // Publish v1.0.0
      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH)
        .send({ version: '1.0.0', bundleBase64: v1Bundle.toString('base64') })
        .expect(201);

      // Publish v1.1.0
      const res = await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH)
        .send({ version: '1.1.0', bundleBase64: v2Bundle.toString('base64') })
        .expect(201);

      expect(res.body.release.version).toBe('1.1.0');
      expect(res.body.patches).toHaveLength(1);

      const patch = res.body.patches[0];
      expect(patch.fromVersion).toBe('1.0.0');
      expect(patch.toVersion).toBe('1.1.0');
      expect(patch.patchSize).toBeGreaterThan(0);
      expect(patch.signature).toBeDefined();
    });

    it('F4-T1-3: should return UPDATE_AVAILABLE with updateType=DELTA when precomputed patch exists', async () => {
      const v1Bundle = Buffer.from('Component A and Component B');
      const v2Bundle = Buffer.from('Component A and Component B modified');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Bundle.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Bundle.toString('base64') });

      const res = await request(httpServer)
        .get('/api/v1/ota/check-update')
        .query({ appId: 'com.goat.test', currentVersion: '1.0.0' })
        .expect(200);

      expect(res.body.status).toBe('UPDATE_AVAILABLE');
      expect(res.body.updateType).toBe('DELTA');
      expect(res.body.targetVersion).toBe('1.1.0');
      expect(res.body.downloadUrl).toContain('/api/v1/ota/patches/com.goat.test/1.0.0/1.1.0/patch.bin');
      expect(res.body.targetBundleSha256).toBe(computeSha256(v2Bundle));
    });

    it('F4-T1-4: should return NO_UPDATE when client is already on latest version', async () => {
      const bundle = Buffer.from('Single version bundle');
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundle.toString('base64') });

      const res = await request(httpServer)
        .get('/api/v1/ota/check-update')
        .query({ appId: 'com.goat.test', currentVersion: '1.0.0' })
        .expect(200);

      expect(res.body.status).toBe('NO_UPDATE');
      expect(res.body.currentVersion).toBe('1.0.0');
    });

    it('F7-T1-5: should serve static bundle zip and static patch bin with accurate headers', async () => {
      const v1 = Buffer.from('V1 payload');
      const v2 = Buffer.from('V2 payload with more data');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') });

      // Download Bundle
      const bundleRes = await request(httpServer)
        .get('/api/v1/ota/bundles/com.goat.test/1.0.0/bundle.zip')
        .buffer(true)
        .parse((res, callback) => {
          const data: Buffer[] = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(data)));
        })
        .expect(200);

      expect(bundleRes.header['content-type']).toContain('application/zip');
      expect(Buffer.compare(bundleRes.body, v1)).toBe(0);

      // Download Patch
      const patchRes = await request(httpServer)
        .get('/api/v1/ota/patches/com.goat.test/1.0.0/1.1.0/patch.bin')
        .buffer(true)
        .parse((res, callback) => {
          const data: Buffer[] = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(data)));
        })
        .expect(200);

      expect(patchRes.header['content-type']).toContain('application/octet-stream');
      expect(patchRes.body.length).toBeGreaterThan(0);
    });

    it('F8-T1-6: should render Admin Release Management Dashboard UI at /admin/ota and /dashboard/ota', async () => {
      const resAdmin = await request(httpServer).get('/admin/ota').expect(200);
      expect(resAdmin.header['content-type']).toContain('text/html');
      expect(resAdmin.text).toContain('Goat OTA Enterprise Release Dashboard');
      expect(resAdmin.text).toContain('canary-slider');
      expect(resAdmin.text).toContain('upload-modal');

      const resDashboard = await request(httpServer).get('/dashboard/ota').expect(200);
      expect(resDashboard.text).toContain('Goat OTA Enterprise Release Dashboard');
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY AND CORNER CASES (BVA)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (BVA)', () => {
    it('F3-T2-1: should reject invalid SemVer version strings with 400 Bad Request', async () => {
      const bundle = Buffer.from('payload').toString('base64');
      const invalidVersions = ['invalid', '1.0', '1..0', 'v1.a.b', 'version-1'];

      for (const badVer of invalidVersions) {
        const res = await request(httpServer)
          .post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH)
          .send({ version: badVer, bundleBase64: bundle })
          .expect(400);

        expect(res.body.error).toContain('Invalid SemVer version');
      }
    });

    it('F3-T2-2: should reject duplicate release version upload with 409 Conflict', async () => {
      const bundle = Buffer.from('payload').toString('base64');
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundle }).expect(201);

      const res = await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH)
        .send({ version: '1.0.0', bundleBase64: bundle })
        .expect(409);

      expect(res.body.error).toContain('already exists');
    });

    it('F4-T2-3: should reject check-update when required parameters are missing with 400', async () => {
      const res = await request(httpServer).get('/api/v1/ota/check-update').query({}).expect(400);
      expect(res.body.error).toContain('required');
    });

    it('F7-T2-4: should handle HTTP Range requests on static bundle downloads (206 Partial Content)', async () => {
      const bundle = crypto.randomBytes(4096);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundle.toString('base64') });

      const res = await request(httpServer)
        .get('/api/v1/ota/bundles/com.goat.test/1.0.0/bundle.zip')
        .set('Range', 'bytes=0-1023')
        .buffer(true)
        .parse((r, callback) => {
          const data: Buffer[] = [];
          r.on('data', (chunk) => data.push(chunk));
          r.on('end', () => callback(null, Buffer.concat(data)));
        })
        .expect(206);

      expect(res.body.length).toBe(1024);
      expect(Buffer.compare(res.body, bundle.subarray(0, 1024))).toBe(0);
    });

    it('F7-T2-4b: should reject invalid HTTP Range headers with 416 and Content-Range bytes */len', async () => {
      const bundle = crypto.randomBytes(4096);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.test/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundle.toString('base64') });

      const invalidRanges = [
        'bytes=abc-def',
        'bytes=-500',
        'bytes=5000-6000',
        'bytes=4096-',
        'bytes=2000-1000',
        'bytes=10-999999',
        'bytes=4096-4097',
        'bytes=-5-10',
      ];

      for (const range of invalidRanges) {
        const res = await request(httpServer)
          .get('/api/v1/ota/bundles/com.goat.test/1.0.0/bundle.zip')
          .set('Range', range)
          .expect(416);

        expect(res.header['content-range']).toBe(`bytes */${bundle.length}`);
      }
    });

    it('F6-T2-5: should update canary percentage via /rollout and reject out-of-bounds values', async () => {
      const resValid = await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollout').set(ADMIN_AUTH)
        .send({ rolloutPercentage: 45 })
        .expect(200);
      expect(resValid.body.rolloutPercentage).toBe(45);

      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollout').set(ADMIN_AUTH)
        .send({ rolloutPercentage: -5 })
        .expect(400);

      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollout').set(ADMIN_AUTH)
        .send({ rolloutPercentage: 105 })
        .expect(400);
    });

    it('F6-T2-5b: should reject unauthenticated /rollout requests with 401', async () => {
      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollout')
        .send({ rolloutPercentage: 45 })
        .expect(401);

      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollout')
        .set({ Authorization: 'Bearer wrong_token' })
        .send({ rolloutPercentage: 45 })
        .expect(401);
    });

    it('F6-T2-5c: should reject unauthenticated /rollback requests with 401 and validate targetVersion when authorized', async () => {
      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollback')
        .send({ targetVersion: '1.0.0' })
        .expect(401);

      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollback')
        .set({ Authorization: 'Bearer wrong_token' })
        .send({ targetVersion: '1.0.0' })
        .expect(401);

      await request(httpServer)
        .post('/api/v1/ota/apps/com.goat.test/rollback')
        .set(ADMIN_AUTH)
        .send({})
        .expect(400);
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS
  // =========================================================================
  describe('Tier 3: Pairwise Combinatorial Interactions', () => {
    it('F3-T3-1: Multi-Tenant App Isolation (App A and App B have distinct releases and keys)', async () => {
      const bundleA = Buffer.from('App A v1.0.0 bundle code');
      const bundleB = Buffer.from('App B v1.0.0 bundle code');

      await request(httpServer).post('/api/v1/ota/apps/com.tenant.alpha/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundleA.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.tenant.beta/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: bundleB.toString('base64') });

      const resListA = await request(httpServer).get('/api/v1/ota/apps/com.tenant.alpha/releases').set(ADMIN_AUTH).expect(200);
      const resListB = await request(httpServer).get('/api/v1/ota/apps/com.tenant.beta/releases').set(ADMIN_AUTH).expect(200);

      expect(resListA.body.releases[0].sha256).toBe(computeSha256(bundleA));
      expect(resListB.body.releases[0].sha256).toBe(computeSha256(bundleB));
      expect(resListA.body.releases[0].signature).not.toBe(resListB.body.releases[0].signature);
    });

    it('F4-T3-2: Channel Separation (Production vs Beta clients query independent release streams)', async () => {
      const prodBundle = Buffer.from('Production Release Bundle');
      const betaBundle = Buffer.from('Beta Feature Experimental Bundle');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.suite/releases').set(ADMIN_AUTH).send({ version: '1.0.0', channel: 'production', bundleBase64: prodBundle.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.suite/releases').set(ADMIN_AUTH).send({ version: '2.0.0-beta.1', channel: 'beta', bundleBase64: betaBundle.toString('base64') });

      const prodCheck = await request(httpServer).get('/api/v1/ota/check-update').query({ appId: 'com.goat.suite', currentVersion: '0.9.0', channel: 'production' }).expect(200);
      const betaCheck = await request(httpServer).get('/api/v1/ota/check-update').query({ appId: 'com.goat.suite', currentVersion: '0.9.0', channel: 'beta' }).expect(200);

      expect(prodCheck.body.targetVersion).toBe('1.0.0');
      expect(betaCheck.body.targetVersion).toBe('2.0.0-beta.1');
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIO
  // =========================================================================
  describe('Tier 4: Real-World Application Scenario', () => {
    it('F3-T4-1: Complete Release Lifecycle: Upload v1.0.0 -> Upload v1.1.0 -> Check Delta -> Download Patch -> Verify Reconstructed Target', async () => {
      const v1Code = Buffer.from('function main() { renderHome(); }');
      const v2Code = Buffer.from('function main() { renderHome(); renderNotifications(); }');

      // 1. Admin uploads v1.0.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.shop/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') }).expect(201);

      // 2. Admin uploads v1.1.0
      const rel2 = await request(httpServer).post('/api/v1/ota/apps/com.goat.shop/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Code.toString('base64') }).expect(201);
      expect(rel2.body.patches).toHaveLength(1);

      // 3. Client checks update from v1.0.0
      const checkRes = await request(httpServer)
        .get('/api/v1/ota/check-update')
        .query({ appId: 'com.goat.shop', currentVersion: '1.0.0' })
        .expect(200);

      expect(checkRes.body.status).toBe('UPDATE_AVAILABLE');
      expect(checkRes.body.updateType).toBe('DELTA');

      // 4. Client downloads patch binary
      const patchDownload = await request(httpServer)
        .get(checkRes.body.downloadUrl)
        .buffer(true)
        .parse((r, callback) => {
          const data: Buffer[] = [];
          r.on('data', (chunk) => data.push(chunk));
          r.on('end', () => callback(null, Buffer.concat(data)));
        })
        .expect(200);
      const patchBuf = patchDownload.body;

      // 5. Client verifies patch SHA-256
      expect(computeSha256(patchBuf)).toBe(checkRes.body.sha256);

      // 6. Client applies patch to base v1Code
      const reconstructed = applyBsdiffPatch(v1Code, patchBuf, checkRes.body.targetBundleSha256);
      expect(Buffer.compare(reconstructed, v2Code)).toBe(0);
    });
  });
});
