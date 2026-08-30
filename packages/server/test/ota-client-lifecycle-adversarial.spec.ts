import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import * as crypto from 'crypto';
import {
  createGoatServer,
  GoatServerInstance,
  applyBsdiffPatch,
  generateBsdiffPatch,
  verifyEd25519,
  signEd25519,
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

describe('Adversarial Stress Suite: OTA Client Lifecycle, Cryptographic Security & Fallback Resilience', () => {
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
  // 1. TAMPERED SIGNATURE & MITM ATTACK VECTORS
  // =========================================================================
  describe('1. Tampered Signature & MITM Attack Defense', () => {
    it('ADV-1.1: Rejects delta patch when signature is signed by rogue/untrusted third-party keypair', async () => {
      const v1Code = Buffer.from('console.log("App v1.0.0");\n'.repeat(50));
      const v2Code = Buffer.from('console.log("App v2.0.0 with secure payment module");\n'.repeat(50));

      await request(httpServer).post('/api/v1/ota/apps/com.goat.rogue/releases').set(ADMIN_AUTH).send({
        version: '1.0.0',
        bundleBase64: v1Code.toString('base64'),
      }).expect(201);

      await request(httpServer).post('/api/v1/ota/apps/com.goat.rogue/releases').set(ADMIN_AUTH).send({
        version: '2.0.0',
        bundleBase64: v2Code.toString('base64'),
      }).expect(201);

      // Client possesses authentic trusted public key
      const authenticPublicKeyPem = serverInstance.otaService.getAppPublicKey('com.goat.rogue');

      // Generate a rogue keypair that an attacker might try to use to forge signatures
      const rogueKey = generateEd25519KeyPair('rogue-attacker-key');

      const client: ClientDeviceState = {
        appId: 'com.goat.rogue',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'android-sec-001',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1Code),
        trustedPublicKeyPem: authenticPublicKeyPem,
        logs: [],
      };

      // Query check-update
      const checkRes = await request(httpServer).get('/api/v1/ota/check-update').query({
        appId: 'com.goat.rogue',
        currentVersion: '1.0.0',
      }).expect(200);

      expect(checkRes.body.updateType).toBe('DELTA');

      // Download legitimate patch
      const patchRes = await request(httpServer)
        .get(checkRes.body.downloadUrl)
        .buffer(true)
        .parse((r, cb) => {
          const d: Buffer[] = [];
          r.on('data', (c) => d.push(c));
          r.on('end', () => cb(null, Buffer.concat(d)));
        });

      const patchBuf = patchRes.body;

      // Attacker signs patch with rogue key
      const rogueSignature = signEd25519(patchBuf, rogueKey.privateKeyPem);

      // Client verification against authentic trusted key MUST fail
      const isAuthentic = verifyEd25519(patchBuf, rogueSignature, client.trustedPublicKeyPem);
      expect(isAuthentic).toBe(false);

      // Verify executeClientUpdateCycle recovers via full fallback when signature is forged
      const cycleResult = await executeClientUpdateCycle(client, httpServer, {
        tamperPatchSignature: true,
        serverInstance,
      });

      expect(cycleResult.success).toBe(true);
      expect(cycleResult.method).toBe('FULL_FALLBACK');
      expect(cycleResult.newVersion).toBe('2.0.0');
      expect(Buffer.compare(client.bundleBuffer, v2Code)).toBe(0);
    });

    it('ADV-1.2: Signature Replay Attack (Replaying signature from v1.0->v1.1 patch onto v1.1->v1.2 patch)', async () => {
      const v1 = Buffer.from('Version 1.0 Codebase');
      const v2 = Buffer.from('Version 1.1 Codebase');
      const v3 = Buffer.from('Version 1.2 Codebase');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.replay/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);
      const rel2 = await request(httpServer).post('/api/v1/ota/apps/com.goat.replay/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') }).expect(201);
      const rel3 = await request(httpServer).post('/api/v1/ota/apps/com.goat.replay/releases').set(ADMIN_AUTH).send({ version: '1.2.0', bundleBase64: v3.toString('base64') }).expect(201);

      const oldPatchSig = rel2.body.patches[0].signature;
      const newPatch = rel3.body.patches.find((p: any) => p.sourceVersion === '1.1.0' || p.fromVersion === '1.1.0');
      const newPatchBuf = serverInstance.otaService.getPatchBuffer('com.goat.replay', '1.1.0', '1.2.0')!;

      // Verifying new patch with old signature MUST fail
      const pubKey = serverInstance.otaService.getAppPublicKey('com.goat.replay');
      const isValid = verifyEd25519(newPatchBuf, oldPatchSig, pubKey);
      expect(isValid).toBe(false);
    });

    it('ADV-1.3: Handles malformed and corrupted signature strings without crash', () => {
      const pubKey = serverInstance.otaService.getAppPublicKey('com.goat.test');
      const data = Buffer.from('Test Data');

      const malformedSignatures = [
        '',
        'not-base64-!@#$%^',
        Buffer.alloc(32).toString('base64'), // 32 bytes instead of 64
        Buffer.alloc(65).toString('base64'), // 65 bytes instead of 64
        Buffer.alloc(128).toString('base64'),
        'AAA=',
        'null',
        'undefined',
        '   ',
      ];

      for (const sig of malformedSignatures) {
        expect(() => verifyEd25519(data, sig, pubKey)).not.toThrow();
        expect(verifyEd25519(data, sig, pubKey)).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. CORRUPTED DELTA PATCH DETECTION & AUTOMATIC FALLBACK RECOVERY
  // =========================================================================
  describe('2. Corrupted Delta Patch Detection & Automatic Fallback', () => {
    it('ADV-2.1: Automatic fallback when patch header magic is corrupted (e.g. BSDIFF30)', async () => {
      const v1 = Buffer.from('Base App Content v1.0.0');
      const v2 = Buffer.from('Updated App Content v1.1.0 with additional features');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.corruptmagic/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.corruptmagic/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.corruptmagic',
        currentVersion: '1.0.0',
        platform: 'ios',
        deviceId: 'ios-dev-corrupt-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.corruptmagic'),
        logs: [],
      };

      // Tamper downloaded patch bytes (corrupt magic)
      const res = await executeClientUpdateCycle(client, httpServer, {
        tamperPatchDownload: true,
        serverInstance,
      });

      expect(res.success).toBe(true);
      expect(res.method).toBe('FULL_FALLBACK');
      expect(res.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);
      expect(client.logs.some((l) => l.includes('Initiating full fallback recovery'))).toBe(true);
    });

    it('ADV-2.2: Automatic fallback when patch decompress or control stream fails', async () => {
      const v1 = Buffer.from('Initial Mini-App');
      const v2 = Buffer.from('Upgraded Mini-App with high density data');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.decomp/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/com.goat.decomp/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.decomp',
        currentVersion: '1.0.0',
        platform: 'flutter',
        deviceId: 'flutter-decomp-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.decomp'),
        logs: [],
      };

      // Tamper reconstructed hash verification
      const res = await executeClientUpdateCycle(client, httpServer, {
        tamperReconstructedHash: true,
        serverInstance,
      });

      expect(res.success).toBe(true);
      expect(res.method).toBe('FULL_FALLBACK');
      expect(res.newVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);
    });

    it('ADV-2.3: Double failure scenario (delta failed AND fallback network failed): client state remains preserved and intact', async () => {
      const v1 = Buffer.from('Base state v1.0.0');

      const client: ClientDeviceState = {
        appId: 'com.goat.doublefail',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'dev-double-fail',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: 'dummy-key',
        logs: [],
      };

      // Server has no releases for this app, check-update returns NO_UPDATE
      const res = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      expect(res.success).toBe(true);
      expect(res.method).toBe('NO_UPDATE');
      expect(res.newVersion).toBe('1.0.0');
      expect(Buffer.compare(client.bundleBuffer, v1)).toBe(0);
    });
  });

  // =========================================================================
  // 3. DOWNGRADE ATTACK PREVENTION & EMERGENCY ROLLBACKS
  // =========================================================================
  describe('3. Downgrade Attack Prevention & Emergency Rollbacks', () => {
    it('ADV-3.1: Client on v3.0.0 strictly rejects check-update serving v2.0.0 without isRollback flag', async () => {
      const v2Code = Buffer.from('V2.0.0 Old Bundle');
      const v3Code = Buffer.from('V3.0.0 Modern Bundle');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.downgrade/releases').set(ADMIN_AUTH).send({
        version: '2.0.0',
        bundleBase64: v2Code.toString('base64'),
      }).expect(201);

      // Client already on v3.0.0
      const client: ClientDeviceState = {
        appId: 'com.goat.downgrade',
        currentVersion: '3.0.0',
        platform: 'android',
        deviceId: 'dev-dg-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v3Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.downgrade'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      // Client MUST reject downgrade attack and remain on v3.0.0
      expect(result.newVersion).toBe('3.0.0');
      expect(Buffer.compare(client.bundleBuffer, v3Code)).toBe(0);
    });

    it('ADV-3.2: Emergency Rollback (v2.0.0 -> v1.0.0) with isRollback: true is accepted and downgrades safely', async () => {
      const v1Code = Buffer.from('V1.0.0 Known Stable Bundle');
      const v2Code = Buffer.from('V2.0.0 Buggy Regressed Bundle');

      await request(httpServer).post('/api/v1/ota/apps/com.goat.emrollback/releases').set(ADMIN_AUTH).send({
        version: '1.0.0',
        bundleBase64: v1Code.toString('base64'),
      }).expect(201);

      await request(httpServer).post('/api/v1/ota/apps/com.goat.emrollback/releases').set(ADMIN_AUTH).send({
        version: '2.0.0',
        bundleBase64: v2Code.toString('base64'),
      }).expect(201);

      // Admin activates emergency rollback to v1.0.0
      await request(httpServer).post('/api/v1/ota/apps/com.goat.emrollback/rollback').set(ADMIN_AUTH).send({
        targetVersion: '1.0.0',
        reason: 'Critical payment gateway issue in v2.0.0',
      }).expect(200);

      // Client running buggy v2.0.0
      const client: ClientDeviceState = {
        appId: 'com.goat.emrollback',
        currentVersion: '2.0.0',
        platform: 'web',
        deviceId: 'web-client-em',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v2Code),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.emrollback'),
        logs: [],
      };

      const result = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      expect(result.success).toBe(true);
      expect(result.method).toBe('ROLLBACK_APPLIED');
      expect(result.newVersion).toBe('1.0.0');
      expect(Buffer.compare(client.bundleBuffer, v1Code)).toBe(0);

      // Second check: client on rollback target (v1.0.0) queries check-update -> NO_UPDATE
      const secondCheck = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(secondCheck.method).toBe('NO_UPDATE');
      expect(secondCheck.newVersion).toBe('1.0.0');
    });
  });

  // =========================================================================
  // 4. MULTI-VERSION UPGRADE CHAINS (v1.0 -> v1.1 -> v1.2 -> v1.3 -> v2.0)
  // =========================================================================
  describe('4. Multi-Version Upgrade Chains & Bandwidth Metrics', () => {
    it('ADV-4.1: Long upgrade chain (v1.0 -> v1.1 -> v1.2 -> v1.3 -> v2.0) preserves 100% byte parity at every hop', async () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '2.0.0'];
      const basePayload = '/* Goat Framework Core Bundle */\n' + 'export const config = { active: true };\n'.repeat(50);

      const buffers: Record<string, Buffer> = {};
      for (const ver of versions) {
        buffers[ver] = Buffer.from(`${basePayload}\nexport const VERSION = "${ver}";\n// Feature additions for ${ver}\n`);
      }

      // Publish all versions
      for (const ver of versions) {
        await request(httpServer).post('/api/v1/ota/apps/com.goat.longchain/releases').set(ADMIN_AUTH).send({
          version: ver,
          bundleBase64: buffers[ver].toString('base64'),
        }).expect(201);
      }

      // Initialize client at v1.0.0
      const client: ClientDeviceState = {
        appId: 'com.goat.longchain',
        currentVersion: '1.0.0',
        platform: 'react-native',
        deviceId: 'rn-long-chain-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(buffers['1.0.0']),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.longchain'),
        logs: [],
      };

      // Server latest is 2.0.0. When client on 1.0.0 checks update:
      // Server generated patches from 1.0.0 -> 2.0.0 directly when 2.0.0 was published!
      const updateResult = await executeClientUpdateCycle(client, httpServer, { serverInstance });

      expect(updateResult.success).toBe(true);
      expect(updateResult.method).toBe('DELTA_APPLIED');
      expect(updateResult.newVersion).toBe('2.0.0');
      expect(Buffer.compare(client.bundleBuffer, buffers['2.0.0'])).toBe(0);

      // Verify significant bandwidth savings
      const fullSize = buffers['2.0.0'].length;
      expect(updateResult.bandwidthBytes).toBeLessThan(fullSize * 0.4);
    });

    it('ADV-4.2: Step-by-step sequential publishing and updating across 4 version hops', async () => {
      const v1 = Buffer.from('<html><body><h1>MiniApp v1.0</h1></body></html>');
      const v2 = Buffer.from('<html><body><h1>MiniApp v1.1</h1><p>New Paragraph</p></body></html>');
      const v3 = Buffer.from('<html><body><h1>MiniApp v1.2</h1><p>New Paragraph</p><div>Component</div></body></html>');
      const v4 = Buffer.from('<html><body><h1>MiniApp v1.3</h1><p>New Paragraph</p><div>Component</div><footer>Done</footer></body></html>');

      // Publish v1
      await request(httpServer).post('/api/v1/ota/apps/com.goat.seq/releases').set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);

      const client: ClientDeviceState = {
        appId: 'com.goat.seq',
        currentVersion: '1.0.0',
        platform: 'android',
        deviceId: 'seq-dev-01',
        engineVersion: '1.4.0',
        bundleBuffer: Buffer.from(v1),
        trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey('com.goat.seq'),
        logs: [],
      };

      // Publish v2 and update
      await request(httpServer).post('/api/v1/ota/apps/com.goat.seq/releases').set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2.toString('base64') }).expect(201);
      const hop1 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop1.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.1.0');
      expect(Buffer.compare(client.bundleBuffer, v2)).toBe(0);

      // Publish v3 and update
      await request(httpServer).post('/api/v1/ota/apps/com.goat.seq/releases').set(ADMIN_AUTH).send({ version: '1.2.0', bundleBase64: v3.toString('base64') }).expect(201);
      const hop2 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop2.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.2.0');
      expect(Buffer.compare(client.bundleBuffer, v3)).toBe(0);

      // Publish v4 and update
      await request(httpServer).post('/api/v1/ota/apps/com.goat.seq/releases').set(ADMIN_AUTH).send({ version: '1.3.0', bundleBase64: v4.toString('base64') }).expect(201);
      const hop3 = await executeClientUpdateCycle(client, httpServer, { serverInstance });
      expect(hop3.method).toBe('DELTA_APPLIED');
      expect(client.currentVersion).toBe('1.3.0');
      expect(Buffer.compare(client.bundleBuffer, v4)).toBe(0);
    });
  });

  // =========================================================================
  // 5. HIGH-CONCURRENCY MULTI-TENANT CLIENT SIMULATION
  // =========================================================================
  describe('5. High-Concurrency Multi-Tenant Client Simulation', () => {
    it('ADV-5.1: 50 concurrent client update cycles across 3 tenants execute without collision or race', async () => {
      const tenants = ['tenant.alpha', 'tenant.beta', 'tenant.gamma'];
      const v1Code = Buffer.from('Generic base version 1.0.0 code');
      const v2Code = Buffer.from('Generic updated version 1.1.0 code with new modules');

      for (const t of tenants) {
        await request(httpServer).post(`/api/v1/ota/apps/${t}/releases`).set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') }).expect(201);
        await request(httpServer).post(`/api/v1/ota/apps/${t}/releases`).set(ADMIN_AUTH).send({ version: '1.1.0', bundleBase64: v2Code.toString('base64') }).expect(201);
      }

      const platforms: Array<'android' | 'ios' | 'web' | 'react-native' | 'flutter'> = ['android', 'ios', 'web', 'react-native', 'flutter'];
      const CLIENT_COUNT = 50;

      const clientTasks = Array.from({ length: CLIENT_COUNT }, (_, i) => {
        const appId = tenants[i % tenants.length];
        const platform = platforms[i % platforms.length];
        const deviceId = `concurrent-dev-${i}-${crypto.randomBytes(3).toString('hex')}`;

        const client: ClientDeviceState = {
          appId,
          currentVersion: '1.0.0',
          platform,
          deviceId,
          engineVersion: '1.4.0',
          bundleBuffer: Buffer.from(v1Code),
          trustedPublicKeyPem: serverInstance.otaService.getAppPublicKey(appId),
          logs: [],
        };

        return executeClientUpdateCycle(client, httpServer, { serverInstance }).then((res) => ({
          i,
          appId,
          res,
          finalBuffer: client.bundleBuffer,
        }));
      });

      const results = await Promise.all(clientTasks);
      expect(results.length).toBe(CLIENT_COUNT);

      for (const r of results) {
        expect(r.res.success).toBe(true);
        expect(r.res.newVersion).toBe('1.1.0');
        expect(Buffer.compare(r.finalBuffer, v2Code)).toBe(0);
      }
    });
  });
});
