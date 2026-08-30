import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import * as crypto from 'crypto';
import {
  createGoatServer,
  GoatServerInstance,
  computeDeviceCanaryBucket,
  isDeviceInCanaryBucket,
  isEligibleForCanary,
  compareSemver,
  isValidSemver,
  isNewerVersion,
  evaluateGovernance,
  RollbackRule,
  UpdateEvaluationParams,
} from '../src/index';

const ADMIN_AUTH = { Authorization: 'Bearer test_admin_token' };

describe('Adversarial & Empirical Stress Verification for OTA Traffic Governance & Rollback', () => {
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
  // ATTACK VECTOR 1: STATISTICAL UNIFORMITY ACROSS 10,000 SIMULATED UUIDs
  // =========================================================================
  describe('Vector 1: Statistical Uniformity & Chi-Square Goodness-of-Fit (N=10,000)', () => {
    it('ADV-1.1: Chi-Square Test across 100 buckets confirms uniform distribution for RFC4122 v4 UUIDs', () => {
      const appId = 'com.goat.adversarial.bank';
      const N = 10000;
      const numBuckets = 100;
      const expectedPerBucket = N / numBuckets; // 100

      const bucketCounts = new Array(numBuckets).fill(0);

      // Generate 10,000 random v4-like UUIDs
      for (let i = 0; i < N; i++) {
        const uuid = crypto.randomUUID();
        const bucket = computeDeviceCanaryBucket(appId, uuid);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);
        bucketCounts[bucket]++;
      }

      // Compute Chi-Square Statistic: sum((Observed - Expected)^2 / Expected)
      let chiSquare = 0;
      for (let i = 0; i < numBuckets; i++) {
        const diff = bucketCounts[i] - expectedPerBucket;
        chiSquare += (diff * diff) / expectedPerBucket;
      }

      // For df = 99:
      // Critical value at alpha = 0.05 is 123.23
      // Critical value at alpha = 0.01 is 134.64
      // Critical value at alpha = 0.001 is 148.23
      // A cryptographically sound SHA-256 modulo 100 should reliably pass < 150
      expect(chiSquare).toBeLessThan(150);

      // Verify no bucket is completely starved or excessively populated
      // At N=10,000 (mean 100), 3-sigma range is roughly 100 +/- 30 (70 to 130)
      for (let i = 0; i < numBuckets; i++) {
        expect(bucketCounts[i]).toBeGreaterThan(50);
        expect(bucketCounts[i]).toBeLessThan(160);
      }
    });

    it('ADV-1.2: Multi-point Canary percentage rollout binomial confidence bounds across 10,000 devices', () => {
      const appId = 'com.goat.adversarial.shop';
      const N = 10000;
      const devices = Array.from({ length: N }, () => crypto.randomUUID());

      const testPercentages = [1, 5, 10, 25, 33, 50, 66, 75, 90, 95, 99];

      for (const p of testPercentages) {
        const qualifiedCount = devices.filter((d) => isDeviceInCanaryBucket(appId, d, p)).length;
        const observedRatio = qualifiedCount / N;
        const expectedRatio = p / 100;

        // 3-sigma tolerance for Binomial distribution: 3 * sqrt(p*(1-p)/N)
        const stdError = Math.sqrt((expectedRatio * (1 - expectedRatio)) / N);
        const marginOfError = 3.5 * stdError; // 99.95% confidence interval

        expect(observedRatio).toBeGreaterThanOrEqual(expectedRatio - marginOfError);
        expect(observedRatio).toBeLessThanOrEqual(expectedRatio + marginOfError);
      }
    });

    it('ADV-1.3: Multi-tenant Bucket Decorrelation (Pearson Correlation r ~ 0 between distinct apps)', () => {
      const appA = 'com.goat.enterprise.tenantA';
      const appB = 'com.goat.enterprise.tenantB';
      const N = 5000;

      const bucketsA: number[] = [];
      const bucketsB: number[] = [];

      for (let i = 0; i < N; i++) {
        const deviceId = `device-uuid-${i}-${crypto.randomBytes(4).toString('hex')}`;
        bucketsA.push(computeDeviceCanaryBucket(appA, deviceId));
        bucketsB.push(computeDeviceCanaryBucket(appB, deviceId));
      }

      // Compute Pearson correlation coefficient r
      const meanA = bucketsA.reduce((sum, v) => sum + v, 0) / N;
      const meanB = bucketsB.reduce((sum, v) => sum + v, 0) / N;

      let numerator = 0;
      let denomA = 0;
      let denomB = 0;

      for (let i = 0; i < N; i++) {
        const diffA = bucketsA[i] - meanA;
        const diffB = bucketsB[i] - meanB;
        numerator += diffA * diffB;
        denomA += diffA * diffA;
        denomB += diffB * diffB;
      }

      const r = numerator / (Math.sqrt(denomA) * Math.sqrt(denomB));

      // Correlation between independent SHA-256 hashed outputs should be essentially 0 (|r| < 0.05)
      expect(Math.abs(r)).toBeLessThan(0.05);
    });

    it('ADV-1.4: Uniformity against structured / non-random device ID patterns (sequential, clustered, hex)', () => {
      const appId = 'com.goat.structured';
      const N = 10000;

      // Sequential IDs: device-000001, device-000002, etc.
      const sequentialDevices = Array.from({ length: N }, (_, i) => `device-${String(i).padStart(6, '0')}`);
      const qualifiedSeq25 = sequentialDevices.filter((d) => isDeviceInCanaryBucket(appId, d, 25)).length;
      expect(qualifiedSeq25 / N).toBeGreaterThanOrEqual(0.23);
      expect(qualifiedSeq25 / N).toBeLessThanOrEqual(0.27);

      // Clustered MAC addresses: AA:BB:CC:00:00:XX
      const macDevices = Array.from({ length: N }, (_, i) => `AA:BB:CC:${(i >> 16) & 0xff}:${(i >> 8) & 0xff}:${i & 0xff}`);
      const qualifiedMac50 = macDevices.filter((d) => isDeviceInCanaryBucket(appId, d, 50)).length;
      expect(qualifiedMac50 / N).toBeGreaterThanOrEqual(0.48);
      expect(qualifiedMac50 / N).toBeLessThanOrEqual(0.52);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: STRICT MONOTONIC PROGRESSION & ZERO-FLAPPING INVARIANTS
  // =========================================================================
  describe('Vector 2: Strict Monotonic Progression & Invariant Verification', () => {
    it('ADV-2.1: Exhaustive 100-step monotonic progression across 10,000 devices (P: 0 -> 100 in 1% steps)', () => {
      const appId = 'com.goat.monotone';
      const N = 10000;
      const devices = Array.from({ length: N }, () => crypto.randomUUID());

      // Pre-compute device canary buckets (0..99)
      const deviceBuckets = new Map<string, number>();
      for (const dev of devices) {
        deviceBuckets.set(dev, computeDeviceCanaryBucket(appId, dev));
      }

      let previouslyEligibleSet = new Set<string>();
      let monotonicityViolations = 0;

      for (let p = 0; p <= 100; p++) {
        const currentEligibleSet = new Set<string>();
        for (const dev of devices) {
          const bucket = deviceBuckets.get(dev)!;
          if (bucket < p) {
            currentEligibleSet.add(dev);
          }
        }

        // Boundary checks
        if (p === 0) {
          expect(currentEligibleSet.size).toBe(0);
        }
        if (p === 100) {
          expect(currentEligibleSet.size).toBe(N);
        }

        // Strict Monotonicity Invariant: previouslyEligibleSet is strict subset of currentEligibleSet
        for (const dev of previouslyEligibleSet) {
          if (!currentEligibleSet.has(dev)) {
            monotonicityViolations++;
          }
        }

        previouslyEligibleSet = currentEligibleSet;
      }

      expect(monotonicityViolations).toBe(0);

      // Also verify isDeviceInCanaryBucket function directly across 1,000 devices for every 10% step
      let mismatchCount = 0;
      const sampleDevices = devices.slice(0, 1000);
      for (let p = 0; p <= 100; p += 10) {
        for (const dev of sampleDevices) {
          const bucket = deviceBuckets.get(dev)!;
          const expected = bucket < p;
          if (isDeviceInCanaryBucket(appId, dev, p) !== expected) {
            mismatchCount++;
          }
        }
      }
      expect(mismatchCount).toBe(0);
    });

    it('ADV-2.2: Fractional and non-integer rollout percentage handling', () => {
      const appId = 'com.goat.fractional';
      const dev = 'dev-fraction-test';
      const bucket = computeDeviceCanaryBucket(appId, dev);

      // If bucket is 24, at 24.9% (Math.floor -> 24), bucket < 24 is false
      // at 25.1% (Math.floor -> 25), bucket < 25 is true
      const atFloor = isDeviceInCanaryBucket(appId, dev, bucket + 0.999);
      const atNext = isDeviceInCanaryBucket(appId, dev, bucket + 1.001);

      expect(atFloor).toBe(false);
      expect(atNext).toBe(true);
    });

    it('ADV-2.3: Extreme Percentage Clamping (-Infinity, NaN, >100, <0)', () => {
      const appId = 'com.goat.clamping';
      const dev = 'dev-clamp-test';

      expect(isDeviceInCanaryBucket(appId, dev, -1000)).toBe(false);
      expect(isDeviceInCanaryBucket(appId, dev, -0.0001)).toBe(false);
      expect(isDeviceInCanaryBucket(appId, dev, 0)).toBe(false);
      expect(isDeviceInCanaryBucket(appId, dev, 100)).toBe(true);
      expect(isDeviceInCanaryBucket(appId, dev, 100.0001)).toBe(true);
      expect(isDeviceInCanaryBucket(appId, dev, 999999)).toBe(true);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: INSTANT ROLLBACK ROUTING & LOOP PREVENTION (REST E2E)
  // =========================================================================
  describe('Vector 3: Instant Rollback Routing, High Concurrency & Loop Prevention', () => {
    it('ADV-3.1: Instant Rollback overrides newer release for 100% of concurrent clients', async () => {
      const appId = 'com.goat.fintech.core';
      const v1Code = Buffer.from('v1.0.0 Safe Golden Master Code');
      const v2Code = Buffer.from('v2.0.0 Regressive Broken Production Code');

      // Publish v1.0.0
      await request(httpServer)
        .post(`/api/v1/ota/apps/${appId}/releases`).set(ADMIN_AUTH)
        .send({ version: '1.0.0', bundleBase64: v1Code.toString('base64') })
        .expect(201);

      // Publish v2.0.0 at 100% rollout
      await request(httpServer)
        .post(`/api/v1/ota/apps/${appId}/releases`).set(ADMIN_AUTH)
        .send({ version: '2.0.0', rolloutPercentage: 100, bundleBase64: v2Code.toString('base64') })
        .expect(201);

      // Verify normal clients receive v2.0.0
      const normalRes = await request(httpServer)
        .get('/api/v1/ota/check-update')
        .query({ appId, currentVersion: '1.0.0', deviceId: 'user-normal-1' })
        .expect(200);

      expect(normalRes.body.status).toBe('UPDATE_AVAILABLE');
      expect(normalRes.body.targetVersion).toBe('2.0.0');
      expect(normalRes.body.isRollback).toBe(false);

      // ADMIN TRIGGERS 1-CLICK INSTANT ROLLBACK TO v1.0.0
      const rollbackRes = await request(httpServer)
        .post(`/api/v1/ota/apps/${appId}/rollback`).set(ADMIN_AUTH)
        .send({ targetVersion: '1.0.0', reason: 'High-severity crash in payment module on v2.0.0' })
        .expect(200);

      expect(rollbackRes.body.success).toBe(true);
      expect(rollbackRes.body.rollback.targetVersion).toBe('1.0.0');
      expect(rollbackRes.body.rollback.isRollback).toBe(1);

      // 100 CONCURRENT CLIENT REQUESTS: clients on v2.0.0 query check-update
      const testClients = Array.from({ length: 100 }, (_, i) => `device-victim-${i}`);
      const checkPromises = testClients.map((devId) =>
        request(httpServer)
          .get('/api/v1/ota/check-update')
          .query({ appId, currentVersion: '2.0.0', deviceId: devId })
      );

      const responses = await Promise.all(checkPromises);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UPDATE_AVAILABLE');
        expect(res.body.isRollback).toBe(true);
        expect(res.body.targetVersion).toBe('1.0.0');
        expect(res.body.mandatory).toBe(true);
        expect(res.body.updateType).toBe('FULL');
        expect(res.body.downloadUrl).toBe(`/api/v1/ota/bundles/${appId}/1.0.0/bundle.zip`);
      }
    });

    it('ADV-3.2: Rollback Loop Prevention (Clients already on safe rollback target receive NO_UPDATE)', async () => {
      const appId = 'com.goat.loop.prevention';
      const v1 = Buffer.from('v1.0.0');
      const v2 = Buffer.from('v2.0.0');

      await request(httpServer).post(`/api/v1/ota/apps/${appId}/releases`).set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post(`/api/v1/ota/apps/${appId}/releases`).set(ADMIN_AUTH).send({ version: '2.0.0', bundleBase64: v2.toString('base64') }).expect(201);

      // Activate rollback to v1.0.0
      await request(httpServer).post(`/api/v1/ota/apps/${appId}/rollback`).set(ADMIN_AUTH).send({ targetVersion: '1.0.0' }).expect(200);

      // Client already on v1.0.0 queries check-update
      const res = await request(httpServer)
        .get('/api/v1/ota/check-update')
        .query({ appId, currentVersion: '1.0.0', deviceId: 'safe-device-1' })
        .expect(200);

      expect(res.body.status).toBe('NO_UPDATE');
      expect(res.body.currentVersion).toBe('1.0.0');
      expect(res.body.message).toContain('active rollback');
    });

    it('ADV-3.3: Multi-tenant and Channel Rollback Isolation', async () => {
      const v1 = Buffer.from('v1');
      const v2 = Buffer.from('v2');

      // Tenant A & Tenant B publish releases
      await request(httpServer).post('/api/v1/ota/apps/tenant-alpha/releases').set(ADMIN_AUTH).send({ version: '1.0.0', channel: 'production', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/tenant-alpha/releases').set(ADMIN_AUTH).send({ version: '2.0.0', channel: 'production', bundleBase64: v2.toString('base64') }).expect(201);

      await request(httpServer).post('/api/v1/ota/apps/tenant-beta/releases').set(ADMIN_AUTH).send({ version: '1.0.0', channel: 'production', bundleBase64: v1.toString('base64') }).expect(201);
      await request(httpServer).post('/api/v1/ota/apps/tenant-beta/releases').set(ADMIN_AUTH).send({ version: '2.0.0', channel: 'production', bundleBase64: v2.toString('base64') }).expect(201);

      // Rollback ONLY tenant-alpha
      await request(httpServer).post('/api/v1/ota/apps/tenant-alpha/rollback').set(ADMIN_AUTH).send({ targetVersion: '1.0.0' }).expect(200);

      // Check tenant-alpha -> gets rollback to 1.0.0
      const checkAlpha = await request(httpServer).get('/api/v1/ota/check-update').query({ appId: 'tenant-alpha', currentVersion: '2.0.0' }).expect(200);
      expect(checkAlpha.body.isRollback).toBe(true);
      expect(checkAlpha.body.targetVersion).toBe('1.0.0');

      // Check tenant-beta -> unaffected, remains at 2.0.0
      const checkBeta = await request(httpServer).get('/api/v1/ota/check-update').query({ appId: 'tenant-beta', currentVersion: '1.0.0' }).expect(200);
      expect(checkBeta.body.isRollback).toBe(false);
      expect(checkBeta.body.targetVersion).toBe('2.0.0');
    });

    it('ADV-3.4: Rollback Target Non-Existence Verification (Reject 404 when target version does not exist)', async () => {
      const appId = 'com.goat.nonexistent';
      const v1 = Buffer.from('v1.0.0');
      await request(httpServer).post(`/api/v1/ota/apps/${appId}/releases`).set(ADMIN_AUTH).set(ADMIN_AUTH).send({ version: '1.0.0', bundleBase64: v1.toString('base64') }).expect(201);

      const res = await request(httpServer)
        .post(`/api/v1/ota/apps/${appId}/rollback`).set(ADMIN_AUTH)
        .set(ADMIN_AUTH)
        .send({ targetVersion: '9.9.9' })
        .expect(404);

      expect(res.body.error).toContain('does not exist');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: ADVERSARIAL EDGE CASES & SEMVER PERMUTATIONS
  // =========================================================================
  describe('Vector 4: Adversarial Edge Cases & SemVer Permutations', () => {
    it('ADV-4.1: Pathological & Adversarial Device ID Strings', () => {
      const appId = 'com.goat.edge';
      const testCases = [
        '',
        ' ',
        '\0\0\0\0',
        '\\n\\r\\t',
        '\' OR \'1\'=\'1',
        '<script>alert(1)</script>',
        '📱🔥🚀✨💡',
        'a'.repeat(65536), // 64KB long device ID
        'undefined',
        'null',
        '0',
        '-1',
      ];

      for (const devId of testCases) {
        const bucket = computeDeviceCanaryBucket(appId, devId);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);

        const in0 = isDeviceInCanaryBucket(appId, devId, 0);
        const in100 = isDeviceInCanaryBucket(appId, devId, 100);
        expect(in0).toBe(false);
        expect(in100).toBe(true);
      }
    });

    it('ADV-4.2: Complex SemVer Comparisons with Pre-releases and Build Metadata', () => {
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemver('1.1.0', '1.0.9')).toBe(1);
      expect(compareSemver('2.0.0', '2.0.0')).toBe(0);

      // Pre-releases have lower precedence than release
      expect(compareSemver('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(compareSemver('1.0.0', '1.0.0-beta')).toBe(1);
      expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBe(-1);

      // Valid Semver validation
      expect(isValidSemver('1.0.0')).toBe(true);
      expect(isValidSemver('v1.2.3')).toBe(true);
      expect(isValidSemver('0.0.1-beta.1')).toBe(true);
      expect(isValidSemver('1.0.0+20260827')).toBe(true);
      expect(isValidSemver('invalid.version')).toBe(false);
      expect(isValidSemver('')).toBe(false);
      expect(isValidSemver(null as any)).toBe(false);
    });

    it('ADV-4.3: Platform Filtering Edge Cases (wildcard, case mismatch, empty list)', () => {
      const baseParams: UpdateEvaluationParams = {
        appId: 'com.goat.platform',
        currentVersion: '1.0.0',
        releaseVersion: '1.1.0',
        rolloutPercentage: 100,
        platform: 'Android',
      };

      // Case insensitive match
      const resCase = evaluateGovernance({ ...baseParams, targetPlatforms: ['android', 'ios'] });
      expect(resCase.isEligible).toBe(true);

      // Wildcard *
      const resWildcard = evaluateGovernance({ ...baseParams, platform: 'custom-os', targetPlatforms: ['*'] });
      expect(resWildcard.isEligible).toBe(true);

      // Wildcard 'all'
      const resAll = evaluateGovernance({ ...baseParams, platform: 'custom-os', targetPlatforms: ['all'] });
      expect(resAll.isEligible).toBe(true);

      // Mismatch
      const resMismatch = evaluateGovernance({ ...baseParams, platform: 'web', targetPlatforms: ['android', 'ios'] });
      expect(resMismatch.isEligible).toBe(false);
    });
  });
});
