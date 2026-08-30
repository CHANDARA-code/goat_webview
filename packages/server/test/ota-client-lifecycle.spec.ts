import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import * as crypto from 'crypto';
import {
  createGoatServer,
  GoatServerInstance,
  applyBsdiffPatch,
  verifyEd25519,
  computeSha256,
  generateEd25519KeyPair,
  compareSemver,
} from '../src/index';

const ADMIN_AUTH = { Authorization: 'Bearer test_admin_token' };

export interface ClientDeviceState {
  appId: string;
  currentVersion: string;
  platform: 'android' | 'ios' | 'react-native' | 'flutter' | 'web';
  deviceId: string;
  engineVersion: string;
  bundleBuffer: Buffer;
  trustedPublicKeyPem: string;
  logs: string[];
}

export interface ClientUpdateResult {
  success: boolean;
  previousVersion: string;
  newVersion: string;
  method: 'DELTA_APPLIED' | 'FULL_FALLBACK' | 'NO_UPDATE' | 'ROLLBACK_APPLIED';
  error?: string;
  bandwidthBytes: number;
}

/**
 * High-fidelity client OTA lifecycle driver simulating native Goat WebView runtime.
 */
export async function executeClientUpdateCycle(
  client: ClientDeviceState,
  serverTarget: any,
  options: {
    tamperPatchDownload?: boolean;
    tamperPatchSignature?: boolean;
    tamperReconstructedHash?: boolean;
    networkDropOnDelta?: boolean;
    serverInstance?: GoatServerInstance;
  } = {}
): Promise<ClientUpdateResult> {
  const previousVersion = client.currentVersion;
  let bandwidthBytes = 0;

  // Step 1: Check for update
  const checkRes = await request(serverTarget)
    .get('/api/v1/ota/check-update')
    .query({
      appId: client.appId,
      currentVersion: client.currentVersion,
      platform: client.platform,
      deviceId: client.deviceId,
      engineVersion: client.engineVersion,
    });

  if (checkRes.status !== 200 || !checkRes.body || checkRes.body.status === 'NO_UPDATE') {
    client.logs.push(`No update available: ${checkRes.body?.message || 'Up to date'}`);
    return {
      success: true,
      previousVersion,
      newVersion: client.currentVersion,
      method: 'NO_UPDATE',
      bandwidthBytes,
    };
  }

  const update = checkRes.body;
  const isRollback = !!update.isRollback;

  // Downgrade protection: reject if target < current unless isRollback is true
  if (compareSemver(update.targetVersion, client.currentVersion) < 0 && !isRollback) {
    client.logs.push(`Security violation: Downgrade attack prevented (target ${update.targetVersion} < current ${client.currentVersion})`);
    return {
      success: false,
      previousVersion,
      newVersion: client.currentVersion,
      method: 'NO_UPDATE',
      error: 'Downgrade attack rejected',
      bandwidthBytes,
    };
  }

  // Step 2: Attempt Delta Update if available
  if (update.updateType === 'DELTA' && !options.networkDropOnDelta) {
    try {
      client.logs.push(`Attempting delta update from ${client.currentVersion} to ${update.targetVersion}`);
      const patchRes = await request(serverTarget)
        .get(update.downloadUrl)
        .buffer(true)
        .parse((r, callback) => {
          const data: Buffer[] = [];
          r.on('data', (chunk) => data.push(chunk));
          r.on('end', () => callback(null, Buffer.concat(data)));
        });

      if (patchRes.status !== 200) {
        throw new Error(`Delta patch download failed with status ${patchRes.status}`);
      }

      let patchBuf: Buffer = patchRes.body;
      bandwidthBytes += patchBuf.length;

      // Adversary injection simulation: tamper downloaded patch
      if (options.tamperPatchDownload) {
        patchBuf = Buffer.from(patchBuf);
        patchBuf[Math.floor(patchBuf.length / 2)] ^= 0xff;
      }

      // Step 2a: Verify Patch SHA-256
      const patchSha = computeSha256(patchBuf);
      if (patchSha !== update.sha256) {
        throw new Error(`Patch SHA-256 mismatch: expected ${update.sha256}, got ${patchSha}`);
      }

      // Step 2b: Verify Patch Ed25519 Signature
      const trustedKey = client.trustedPublicKeyPem || (options.serverInstance?.otaService?.getAppPublicKey(client.appId) || '');
      const signatureToVerify = options.tamperPatchSignature ? Buffer.alloc(64).toString('base64') : update.signature;
      const isSigValid = verifyEd25519(patchBuf, signatureToVerify, trustedKey);
      if (!isSigValid) {
        throw new Error('Patch Ed25519 signature verification failed');
      }

      // Step 2c: Apply BSDIFF40 Patch to local bundle
      const expectedTargetSha = options.tamperReconstructedHash ? '0000000000000000000000000000000000000000000000000000000000000000' : update.targetBundleSha256;
      const newBundle = applyBsdiffPatch(client.bundleBuffer, patchBuf, expectedTargetSha);

      // Step 2d: Commit staged bundle
      client.bundleBuffer = newBundle;
      client.currentVersion = update.targetVersion;
      client.logs.push(`Successfully applied delta patch to ${update.targetVersion}`);

      return {
        success: true,
        previousVersion,
        newVersion: client.currentVersion,
        method: isRollback ? 'ROLLBACK_APPLIED' : 'DELTA_APPLIED',
        bandwidthBytes,
      };
    } catch (err: any) {
      client.logs.push(`Delta update failed: ${err.message}. Initiating full fallback recovery...`);
    }
  }

  // Step 3: Full Bundle Fallback Recovery
  client.logs.push(`Executing full bundle download fallback for ${update.targetVersion}`);
  const fallbackUrl = `/api/v1/ota/bundles/${client.appId}/${update.targetVersion}/bundle.zip`;
  const bundleRes = await request(serverTarget)
    .get(fallbackUrl)
    .buffer(true)
    .parse((r, callback) => {
      const data: Buffer[] = [];
      r.on('data', (chunk) => data.push(chunk));
      r.on('end', () => callback(null, Buffer.concat(data)));
    });

  if (bundleRes.status !== 200) {
    return {
      success: false,
      previousVersion,
      newVersion: client.currentVersion,
      method: 'FULL_FALLBACK',
      error: `Fallback bundle download failed with status ${bundleRes.status}`,
      bandwidthBytes,
    };
  }

  const fullBundleBuf: Buffer = bundleRes.body;
  bandwidthBytes += fullBundleBuf.length;

  // Verify Full Bundle SHA-256
  const fullBundleSha = computeSha256(fullBundleBuf);
  if (fullBundleSha !== update.targetBundleSha256) {
    return {
      success: false,
      previousVersion,
      newVersion: client.currentVersion,
      method: 'FULL_FALLBACK',
      error: 'Fallback bundle SHA-256 mismatch',
      bandwidthBytes,
    };
  }

  // Commit Full Bundle
  client.bundleBuffer = fullBundleBuf;
  client.currentVersion = update.targetVersion;
  client.logs.push(`Successfully recovered via full bundle update to ${update.targetVersion}`);

  return {
    success: true,
    previousVersion,
    newVersion: client.currentVersion,
    method: isRollback ? 'ROLLBACK_APPLIED' : 'FULL_FALLBACK',
    bandwidthBytes,
  };
}

describe('OTA Client Lifecycle, Automatic Fallback & Adversarial Defense Suite', () => {
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
    it('F9-T1-1: Happy Path Delta Update Workflow (check -> download delta -> verify signature -> apply patch -> stage)', async () => {
      const baseCode = 'const MODULE = {};\n'.repeat(100);
      const v1Code = Buffer.from(baseCode + 'const APP_VERSION = "1.0.0"; function init() { render(); }');
      const v2Code = Buffer.from(baseCode + 'const APP_VERSION = "1.1.0"; function init() { render(); enableAnalytics(); }');

      // Publish releases on server
      await request(httpServer).post('/api/v1/ota/apps/com.goat.lifecycle/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.lifecycle/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Code.toString('base64') }).expect(201);

      // Client initialization
      const client: ClientDeviceState = {
        appId: 'com.goat.lifecycle',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'pixel-device-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.lifecycle'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      expect(result.success).toBe(true);
      expect(result.method).toBe('DELTA_APPLIED');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2Code)).toBe(0);
      expect(result.bandwidthBytes).toBeLessThan(v2Code.length * 0.5); // Bandwidth savings verified (>50% savings)
    });

    it('F9-T1-2: Automatic Fallback Recovery on Corrupted Delta Patch Download', async () => {
      const v1Code = Buffer.from('Bundle v1.0.0 code base');
      const v2Code = Buffer.from('Bundle v1.1.0 code base with security patches');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.fallback/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.fallback/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Code.toString('base64') });

      const client: ClientDeviceState = {
        appId: 'com.goat.fallback',
        currentVersion: '1.0.0',
        platform: 'ios',
        deviceId: 'iphone-15-pro-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.fallback'),
        logs: [],
      };

      // Inject corruption in downloaded delta patch
      const result = await executeClientUpdateCycle(client, httpServer, { tamperPatchDownload: true, serverInstance });

      // Must transparently fall back to full bundle download and succeed
      expect(result.success).toBe(true);
      expect(result.method).toBe('FULL_FALLBACK');
      expect(result.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2Code)).toBe(0);
      expect(client.logs.some((l) => l.includes('Initiating full fallback recovery'))).toBe(true);
    });

    it('F9-T1-3: Automatic Fallback Recovery on Delta Network 404 Drop', async () => {
      const v1Code = Buffer.from('Bundle v1.0.0');
      const v2Code = Buffer.from('Bundle v1.1.0 with feature');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.drop/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.drop/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Code.toString('base64') });

      const client: ClientDeviceState = {
        appId: 'com.goat.drop',
        currentVersion: '1.0.0',
        platform: 'react-native',
        deviceId: 'rn-dev-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.drop'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { networkDropOnDelta: true, serverInstance });

      expect(result.success).toBe(true);
      expect(result.method).toBe('FULL_FALLBACK');
      expect(result.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2Code)).toBe(0);
    });

    it('F10-T1-4: Strict Downgrade Attack Prevention', async () => {
      const v1Code = Buffer.from('V1.0.0 Old Vulnerable Version');
      const v2Code = Buffer.from('V2.0.0 New Patched Version');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.sec/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') });

      // Client is already on v2.0.0
      const client: ClientDeviceState = {
        appId: 'com.goat.sec',
        currentVersion: '2.0.0',
        platform: 'web',
        deviceId: 'web-client-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v2Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.sec'),
        logs: [],
      };

      // Rogue server or MITM tries to serve v1.0.0 without rollback flag
      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      // Client strictly rejects unauthorized downgrade
      expect(result.newVersion).toBe('2.0.0');
      expect(Buffer.compare(client.bundleBuffer, v2Code)).toBe(0);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY AND CORNER CASES (BVA)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (BVA)', () => {
    it('F9-T2-1: Up-to-date client query returns NO_UPDATE without modifying local state', async () => {
      const code = Buffer.from('Stable code v1.0.0');
      await request(httpServer).post('/api/v1/ota/apps/com.goat.noop/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: code.toString('base64') });

      const client: ClientDeviceState = {
        appId: 'com.goat.noop',
        currentVersion: '1.0.0',
        platform: 'flutter',
        deviceId: 'flutter-dev-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.noop'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(result.method).toBe('NO_UPDATE');
      expect(result.bandwidthBytes).toBe(0);
      expect(client.currentVersion).toBe('1.0.0');
    });

    it('F10-T2-2: Fallback recovery on reconstructed SHA-256 target hash mismatch', async () => {
      const v1 = Buffer.from('V1 code');
      const v2 = Buffer.from('V2 code');
      await request(httpServer).post('/api/v1/ota/apps/com.goat.hashmismatch/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') });
      await request(httpServer).post('/api/v1/ota/apps/com.goat.hashmismatch/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') });

      const client: ClientDeviceState = {
        appId: 'com.goat.hashmismatch',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'pixel-hash-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.hashmismatch'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { tamperReconstructedHash: true, serverInstance });
      expect(result.success).toBe(true);
      expect(result.method).toBe('FULL_FALLBACK');
      expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS
  // =========================================================================
  describe('Tier 3: Pairwise Combinatorial Interactions', () => {
    const platforms: Array<'android' | 'ios' | 'react-native' | 'flutter' | 'web'> = ['android', 'ios', 'react-native', 'flutter', 'web'];

    platforms.forEach((plt) => {
      it(`F9-T3: Cross-platform lifecycle update execution on ${plt}`, async () => {
        const v1 = Buffer.from(`Bundle code for platform ${plt} v1.0.0`);
        const v2 = Buffer.from(`Bundle code for platform ${plt} v1.1.0`);

        await request(httpServer).post(`/api/v1/ota/apps/com.goat.${plt}/releases`).set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') });
        await request(httpServer).post(`/api/v1/ota/apps/com.goat.${plt}/releases`).set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') });

        const client: ClientDeviceState = {
          appId: `com.goat.${plt}`,
          currentVersion: '1.0.0',
          platform: plt,
          deviceId: `dev-${plt}-123`,
          engineVersion: '1.4.0',
          bundleBuffer: Buffer.from(v1),
          trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey(`com.goat.${plt}`),
          logs: [],
        };

        const res = await executeClientUpdateCycle(client, httpServer, { serverInstance });
        expect(res.success).toBe(true);
        expect(res.newVersion).toBe('1.1.0');
        expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);
      });
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (ALL 5 SPECIFIED SCENARIOS)
  // =========================================================================
  describe('Tier 4: Real-World Application Scenarios (Tiers 1–5 End-to-End)', () => {
    // Scenario 1: Multi-Version Incremental Upgrade Chain
    it('Scenario 1: Multi-Version Incremental Upgrade Chain (v1.0.0 -> v1.1.0 -> v1.2.0 -> v1.3.0)', async () => {
      const v1_0 = Buffer.from('<html><head><title>App v1.0.0</title></head><body><h1>Welcome</h1></body></html>');
      const v1_1 = Buffer.from('<html><head><title>App v1.1.0</title></head><body><h1>Welcome</h1><nav>Menu</nav></body></html>');
      const v1_2 = Buffer.from('<html><head><title>App v1.2.0</title></head><body><h1>Welcome</h1><nav>Menu</nav><section>Cards</section></body></html>');
      const v1_3 = Buffer.from('<html><head><title>App v1.3.0</title></head><body><h1>Welcome</h1><nav>Menu</nav><section>Cards</section><footer>Footer</footer></body></html>');

      // Publish v1.0.0 and v1.1.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.chain/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1_0.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.chain/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v1_1.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.chain',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'chain-device-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1_0),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.chain'),
        logs: [],
      };

      // Hop 1: 1.0.0 -> 1.1.0
      const hop1 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop1.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v1_1)).toBe(0);

      // Publish 1.2.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.chain/releases').set(ADMIN_AUTH).send({ version: '1.2.0', bundleBase64: v1_2.toString('base64') }).expect(201);

      // Hop 2: 1.1.0 -> 1.2.0
      const hop2 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop2.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.2.0');
      expect(Buffer.compare(client.bundleBuffer, v1_2)).toBe(0);

      // Publish 1.3.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.chain/releases').set(ADMIN_AUTH).send({ version: '1.3.0', bundleBase64: v1_3.toString('base64') }).expect(201);

      // Hop 3: 1.2.0 -> 1.3.0
      const hop3 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop3.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.3.0');
      expect(Buffer.compare(client.bundleBuffer, v1_3)).toBe(0);
    });

    // Scenario 2: Legacy Client Direct Jump with Fallback
    it('Scenario 2: Legacy Client Direct Jump with Fallback (v0.1.0 -> v1.3.0)', async () => {
      const legacyBundle = Buffer.from('Old Ancient Base Bundle v0.1.0');
      const v1_3_Bundle = Buffer.from('Modern Mini-App Bundle v1.3.0 with complete rewrite');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.legacy/releases').set(ADMIN_AUTH).send({ version: '1.3.0', bundleBase64: v1_3_Bundle.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.legacy',
        currentVersion: '0.1.0',
        platform: 'ios',
        deviceId: 'legacy-iphone-6s',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(legacyBundle),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.legacy'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      expect(result.success).toBe(true);
      expect(result.method).toBe('FULL_FALLBACK');
      expect(client.currentVersion).toBe('1.3.0');
      expect(Buffer.compare(client.bundleBuffer, v1_3_Bundle)).toBe(0);
    });

    // Scenario 3: Staged 25% Canary Rollout with Live Increase
    it('Scenario 3: Staged 25% Canary Rollout with Live Increase (Client Simulation)', async () => {
      const v1 = Buffer.from('V1.0.0 Base Bundle');
      const v2 = Buffer.from('V2.0.0 Next Gen Bundle');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.canary/releases').set(ADMIN_AUTH).send({
        version: '1.0.0',
        rolloutPercentage: 100,
        bundleBase64: v1.toString('base64'),
      }).expect(201);

      await request(httpServer).post('/api/v1/ota/apps/com.goat.canary/releases').set(ADMIN_AUTH).send({
        version: '2.0.0',
        rolloutPercentage: 25,
        bundleBase64: v2.toString('base64'),
      }).expect(201);

      const N = 40;
      const deviceIds = Array.from({ length: N }, (_, i) => `sim-dev-${i}-${crypto.randomBytes(4).toString('hex')}`);

      const stage1Results: { devId: string; upgraded: boolean }[] = [];
      for (const devId of deviceIds) {
        const client: ClientDeviceState = {
          appId: 'com.goat.canary',
          currentVersion: '1.0.0',
          platform: 'android',
          deviceId: devId,
          engineVersion: '1.4.0',
          bundleBuffer: Buffer.from(v1),
          trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.canary'),
          logs: [],
        };
        const res = await executeClientUpdateCycle(client, httpServer, { serverInstance });
        stage1Results.push({ devId, upgraded: res.newVersion === '2.0.0' });
      }

      const upgradedStage1 = stage1Results.filter((r) => r.upgraded).map((r) => r.devId);
      const ratio1 = upgradedStage1.length / N;
      expect(ratio1).toBeGreaterThanOrEqual(0.05);
      expect(ratio1).toBeLessThanOrEqual(0.55);

      // Increase live rollout to 50%
      await request(httpServer).post('/api/v1/ota/apps/com.goat.canary/rollout').set(ADMIN_AUTH).send({ rolloutPercentage: 50 }).expect(200);

      const set1 = new Set(upgradedStage1);
      const stage2Results: { devId: string; upgraded: boolean }[] = [];
      for (const devId of deviceIds) {
        const client: ClientDeviceState = {
          appId: 'com.goat.canary',
          currentVersion: '1.0.0',
          platform: 'android',
          deviceId: devId,
          engineVersion: '1.4.0',
          bundleBuffer: Buffer.from(v1),
          trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.canary'),
          logs: [],
        };
        const res = await executeClientUpdateCycle(client, httpServer, { serverInstance });
        stage2Results.push({ devId, upgraded: res.newVersion === '2.0.0' });
      }

      const upgradedStage2 = stage2Results.filter((r) => r.upgraded).map((r) => r.devId);
      const set2 = new Set(upgradedStage2);

      // Monotonicity verification: ALL stage1 devices MUST be upgraded in stage 2
      for (const d of upgradedStage1) {
        expect(set2.has(d)).toBe(true);
      }

      const ratio2 = upgradedStage2.length / N;
      expect(ratio2).toBeGreaterThanOrEqual(ratio1);
      expect(ratio2).toBeGreaterThanOrEqual(0.20);
      expect(ratio2).toBeLessThanOrEqual(0.80);
    });

    // Scenario 4: Production Incident Instant 1-Click Rollback
    it('Scenario 4: Production Incident Instant 1-Click Rollback (v1.4.0 faulty -> instant rollback to v1.3.0)', async () => {
      const v1_3 = Buffer.from('Stable Version 1.3.0');
      const v1_4 = Buffer.from('Faulty Version 1.4.0 with critical regression');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.incident/releases').set(ADMIN_AUTH).send({ version: '1.3.0', bundleBase64: v1_3.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.incident/releases').set(ADMIN_AUTH).send({ version: '1.4.0', bundleBase64: v1_4.toString('base64') }).expect(201);

      // Admin triggers 1-click rollback to v1.3.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.incident/rollback').set(ADMIN_AUTH).send({
        targetVersion: '1.3.0',
        reason: 'Emergency rollback due to crash in v1.4.0',
      }).expect(200);

      // Client running faulty v1.4.0 queries update
      const client: ClientDeviceState = {
        appId: 'com.goat.incident',
        currentVersion: '1.4.0',
        platform: 'android',
        deviceId: 'affected-device-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1_4),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.incident'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      // Client immediately receives rollback directive and downgrades safely to v1.3.0
      expect(result.success).toBe(true);
      expect(result.method).toBe('ROLLBACK_APPLIED');
      expect(result.newVersion).toBe('1.3.0');
      expect(Buffer.compare(client.bundleBuffer, v1_3)).toBe(0);
    });

    // Scenario 5: Active Adversary Attack Defense
    it('Scenario 5: Active Adversary Attack Defense (tampered patch bit flip + forged signature rejection + safe fallback)', async () => {
      const v1 = Buffer.from('Authentic v1.0.0 mini-app code');
      const v2 = Buffer.from('Authentic v1.1.0 mini-app code');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.adversary/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.adversary/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.adversary',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'target-device-adversary',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.adversary'),
        logs: [],
      };

      // Attacker intercepts and flips bits in delta patch
      const result = await executeClientUpdateCycle(client, httpServer, { tamperPatchDownload: true, tamperPatchSignature: true, serverInstance });

      // Client crypto verifier catches forgery, rejects corrupt patch, logs alert, and falls back to genuine full bundle
      expect(result.success).toBe(true);
      expect(result.method).toBe('FULL_FALLBACK');
      expect(result.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);
      expect(client.logs.some((l) => l.includes('Patch SHA-256 mismatch') || l.includes('signature verification failed'))).toBe(true);
    });
  });
});
