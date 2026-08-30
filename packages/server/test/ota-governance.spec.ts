import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  computeDeviceCanaryBucket,
  isDeviceInCanaryBucket,
  evaluateGovernance,
  RollbackRule,
  UpdateEvaluationParams,
} from '../src/index';

describe('Deterministic Canary Rollout & Instant Rollback Governance Suite', () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Category-Partition)
  // =========================================================================
  describe('Tier 1: Feature Coverage (Category-Partition)', () => {
    it('F5-T1-1: should deterministically assign identical canary bucket for same appId and deviceId', () => {
      const appId = 'com.goat.finance';
      const deviceId = 'device-pixel8-abc123xyz';

      const bucket1 = computeDeviceCanaryBucket(appId, deviceId);
      const bucket2 = computeDeviceCanaryBucket(appId, deviceId);
      const bucket3 = computeDeviceCanaryBucket(appId, deviceId);

      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
      expect(bucket1).toBe(bucket2);
      expect(bucket2).toBe(bucket3);
    });

    it('F5-T1-2: should isolate canary buckets across different app IDs for the same deviceId', () => {
      const deviceId = 'device-universal-uuid-999';
      const bucketAppA = computeDeviceCanaryBucket('com.goat.appA', deviceId);
      const bucketAppB = computeDeviceCanaryBucket('com.goat.appB', deviceId);
      const bucketAppC = computeDeviceCanaryBucket('com.goat.appC', deviceId);

      const distinct = new Set([bucketAppA, bucketAppB, bucketAppC]);
      expect(distinct.size).toBeGreaterThanOrEqual(2);
    });

    it('F5-T1-3: should strictly preserve monotonic progression as rollout percentage increases', () => {
      const appId = 'com.goat.shopping';
      const sampleDevices = Array.from({ length: 500 }, (_, i) => `device-test-${i}`);

      sampleDevices.forEach((dev) => {
        const in10 = isDeviceInCanaryBucket(appId, dev, 10);
        const in25 = isDeviceInCanaryBucket(appId, dev, 25);
        const in50 = isDeviceInCanaryBucket(appId, dev, 50);
        const in75 = isDeviceInCanaryBucket(appId, dev, 75);
        const in100 = isDeviceInCanaryBucket(appId, dev, 100);

        if (in10) expect(in25).toBe(true);
        if (in25) expect(in50).toBe(true);
        if (in50) expect(in75).toBe(true);
        if (in75) expect(in100).toBe(true);
        expect(in100).toBe(true);
      });
    });

    it('F5-T1-4: should accurately filter update eligibility by client platform', () => {
      const paramsAndroid: UpdateEvaluationParams = {
        appId: 'com.goat.app',
        currentVersion: '1.0.0',
        releaseVersion: '1.1.0',
        rolloutPercentage: 100,
        platform: 'android',
        targetPlatforms: ['android', 'ios'],
      };

      const paramsWeb: UpdateEvaluationParams = {
        ...paramsAndroid,
        platform: 'web',
      };

      const resultAndroid = evaluateGovernance(paramsAndroid);
      const resultWeb = evaluateGovernance(paramsWeb);

      expect(resultAndroid.isEligible).toBe(true);
      expect(resultWeb.isEligible).toBe(false);
      expect(resultWeb.reason).toContain('Platform web not supported');
    });

    it('F5-T1-5: should enforce minimum engine version requirement', () => {
      const baseParams: UpdateEvaluationParams = {
        appId: 'com.goat.app',
        currentVersion: '1.0.0',
        releaseVersion: '2.0.0',
        rolloutPercentage: 100,
        minEngineVersion: '1.4.0',
      };

      const eligibleClient = evaluateGovernance({ ...baseParams, engineVersion: '1.4.0' });
      const advancedClient = evaluateGovernance({ ...baseParams, engineVersion: '1.5.2' });
      const legacyClient = evaluateGovernance({ ...baseParams, engineVersion: '1.3.9' });

      expect(eligibleClient.isEligible).toBe(true);
      expect(advancedClient.isEligible).toBe(true);
      expect(legacyClient.isEligible).toBe(false);
      expect(legacyClient.reason).toContain('below required minEngineVersion');
    });

    it('F6-T1-6: should instantly trigger rollback routing with isRollback flag and target safe version', () => {
      const rollbackRule: RollbackRule = {
        appId: 'com.goat.app',
        targetVersion: '1.2.0',
        active: true,
        reason: 'Severe crash on v1.3.0 in production',
        createdAt: Date.now(),
      };

      const resultFaulty = evaluateGovernance({
        appId: 'com.goat.app',
        currentVersion: '1.3.0',
        releaseVersion: '1.3.0',
        rolloutPercentage: 100,
        activeRollback: rollbackRule,
      });

      expect(resultFaulty.isEligible).toBe(true);
      expect(resultFaulty.isRollback).toBe(true);
      expect(resultFaulty.targetVersion).toBe('1.2.0');
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY AND CORNER CASES (BVA)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (BVA)', () => {
    it('F5-T2-1: should qualify exactly 0% devices when rollout is 0%', () => {
      const appId = 'com.goat.app';
      const devices = Array.from({ length: 1000 }, (_, i) => `device-${i}`);
      const qualified = devices.filter((d) => isDeviceInCanaryBucket(appId, d, 0));
      expect(qualified.length).toBe(0);
    });

    it('F5-T2-2: should qualify exactly 100% devices when rollout is 100%', () => {
      const appId = 'com.goat.app';
      const devices = Array.from({ length: 1000 }, (_, i) => `device-${i}`);
      const qualified = devices.filter((d) => isDeviceInCanaryBucket(appId, d, 100));
      expect(qualified.length).toBe(1000);
    });

    it('F5-T2-3: should clamp negative rollout percentages to 0%', () => {
      expect(isDeviceInCanaryBucket('com.goat.app', 'dev-1', -10)).toBe(false);
      expect(isDeviceInCanaryBucket('com.goat.app', 'dev-1', -0.01)).toBe(false);
    });

    it('F5-T2-4: should clamp rollout percentages > 100% to 100%', () => {
      expect(isDeviceInCanaryBucket('com.goat.app', 'dev-1', 150)).toBe(true);
      expect(isDeviceInCanaryBucket('com.goat.app', 'dev-1', 9999)).toBe(true);
    });

    it('F5-T2-5: should handle empty or missing deviceId gracefully', () => {
      const bucket = computeDeviceCanaryBucket('com.goat.app', '');
      expect(bucket).toBe(0);
      expect(isDeviceInCanaryBucket('com.goat.app', '', 50)).toBe(true);
      expect(isDeviceInCanaryBucket('com.goat.app', '', 0)).toBe(false);
    });

    it('F5-T2-6: should handle extreme deviceId strings (UUIDs, 256 chars, Unicode)', () => {
      const longId = 'a'.repeat(256);
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const unicodeId = '📱-device-øæå-中文';

      expect(computeDeviceCanaryBucket('app', longId)).toBeGreaterThanOrEqual(0);
      expect(computeDeviceCanaryBucket('app', uuid)).toBeGreaterThanOrEqual(0);
      expect(computeDeviceCanaryBucket('app', unicodeId)).toBeGreaterThanOrEqual(0);
    });

    it('F6-T2-7: should handle client already on safe rollback target version without looping', () => {
      const rollbackRule: RollbackRule = {
        appId: 'com.goat.app',
        targetVersion: '1.2.0',
        active: true,
        createdAt: Date.now(),
      };

      const result = evaluateGovernance({
        appId: 'com.goat.app',
        currentVersion: '1.2.0',
        releaseVersion: '1.3.0',
        rolloutPercentage: 100,
        activeRollback: rollbackRule,
      });

      expect(result.isEligible).toBe(false);
      expect(result.isRollback).toBe(true);
      expect(result.reason).toContain('matches active rollback target');
    });

    it('F6-T2-8: should ignore inactive rollback rules', () => {
      const inactiveRollback: RollbackRule = {
        appId: 'com.goat.app',
        targetVersion: '1.2.0',
        active: false,
        createdAt: Date.now(),
      };

      const result = evaluateGovernance({
        appId: 'com.goat.app',
        currentVersion: '1.2.0',
        releaseVersion: '1.3.0',
        rolloutPercentage: 100,
        activeRollback: inactiveRollback,
      });

      expect(result.isEligible).toBe(true);
      expect(result.isRollback).toBe(false);
      expect(result.targetVersion).toBe('1.3.0');
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS
  // =========================================================================
  describe('Tier 3: Pairwise Combinatorial Interactions', () => {
    const percentages = [0, 25, 50, 75, 100];
    const platforms = ['android', 'ios', 'web'];
    const channels = ['production', 'beta', 'canary'];

    percentages.forEach((pct) => {
      platforms.forEach((plt) => {
        channels.forEach((chn) => {
          it(`F5-T3: Governance eval [Rollout: ${pct}%, Platform: ${plt}, Channel: ${chn}]`, () => {
            const res = evaluateGovernance({
              appId: 'com.goat.suite',
              currentVersion: '1.0.0',
              releaseVersion: '1.1.0',
              rolloutPercentage: pct,
              platform: plt,
              targetPlatforms: ['android', 'ios', 'web'],
              channel: chn,
              deviceId: 'simulated-device-id-abc',
            });

            if (pct === 0) {
              expect(res.isEligible).toBe(false);
            } else if (pct === 100) {
              expect(res.isEligible).toBe(true);
            }
          });
        });
      });
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('F5-T4-1: Staged 25% Canary Rollout with Live Increase across 10,000 simulated devices', () => {
      const appId = 'com.goat.enterprise';
      const N = 10000;
      const devices = Array.from({ length: N }, (_, i) => `device-uuid-${i}-${crypto.randomBytes(4).toString('hex')}`);

      const stage1_25 = devices.filter((d) => isDeviceInCanaryBucket(appId, d, 25));
      const ratio1 = stage1_25.length / N;
      expect(ratio1).toBeGreaterThanOrEqual(0.225);
      expect(ratio1).toBeLessThanOrEqual(0.275);

      const stage2_50 = devices.filter((d) => isDeviceInCanaryBucket(appId, d, 50));
      const ratio2 = stage2_50.length / N;
      expect(ratio2).toBeGreaterThanOrEqual(0.475);
      expect(ratio2).toBeLessThanOrEqual(0.525);

      const set50 = new Set(stage2_50);
      const allPreserved = stage1_25.every((d) => set50.has(d));
      expect(allPreserved).toBe(true);

      const stage3_100 = devices.filter((d) => isDeviceInCanaryBucket(appId, d, 100));
      expect(stage3_100.length).toBe(N);
    });

    it('F6-T4-2: Production Incident Instant 1-Click Rollback Scenario', () => {
      const appId = 'com.goat.fintech';
      const badRelease = '2.4.0';
      const safeRelease = '2.3.1';

      const normalResult = evaluateGovernance({
        appId,
        currentVersion: '2.3.1',
        releaseVersion: badRelease,
        rolloutPercentage: 100,
        deviceId: 'device-victim-1',
      });
      expect(normalResult.isEligible).toBe(true);
      expect(normalResult.targetVersion).toBe(badRelease);
      expect(normalResult.isRollback).toBe(false);

      const rollbackRule: RollbackRule = {
        appId,
        targetVersion: safeRelease,
        reason: 'Critical payment checkout crash on v2.4.0',
        active: true,
        createdAt: Date.now(),
      };

      const victimDevices = Array.from({ length: 50 }, (_, i) => `device-user-${i}`);
      for (const dev of victimDevices) {
        const rollbackCheck = evaluateGovernance({
          appId,
          currentVersion: badRelease,
          releaseVersion: badRelease,
          rolloutPercentage: 100,
          deviceId: dev,
          activeRollback: rollbackRule,
        });

        expect(rollbackCheck.isEligible).toBe(true);
        expect(rollbackCheck.isRollback).toBe(true);
        expect(rollbackCheck.targetVersion).toBe(safeRelease);
      }
    });
  });
});
