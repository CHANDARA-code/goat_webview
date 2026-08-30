/**
 * IPC Bridge Adversarial Fuzzing & Schema Mutation Test Suite
 * Master Zero-Trust Verification across all 197 actions in 18 functional domains.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IPC_DOMAIN_CATALOG,
  ALL_197_ACTIONS,
} from './action-catalog.js';
import {
  FuzzGenerator,
  FuzzEngine,
  assertPrototypeClean,
  KNOWN_FAIL_CLOSED_CODES,
} from './fuzz-generator.js';
import {
  GoatBridgeMock,
  mockState,
  BridgeErrorCodes,
  GoatBridgeError,
} from '../../src/index.js';
import {
  SSRF_BLOCKED_URLS,
  MALFORMED_AND_DANGEROUS_URLS,
  PATH_TRAVERSAL_VECTORS,
  STRING_EXTREMES,
  BOUNDARY_NUMBERS,
  PRIMITIVE_TYPE_MUTATIONS,
} from './mutation-strategies.js';

test('Enterprise Zero-Trust Security Verification: IPC Bridge Master Fuzz Suite', { timeout: 30000 }, async (masterSuite) => {
  // Reset bridge mock state before test execution
  mockState.reset();

  // =========================================================================
  // 1. Exhaustive 18-Domain Matrix Fuzzing (All 197 Actions)
  // =========================================================================
  await masterSuite.test('1. Exhaustive 18-Domain Matrix: >50 Mutations Per Action (197 Actions)', async (domainSuite) => {
    const engine = new FuzzEngine();

    for (const domain of IPC_DOMAIN_CATALOG) {
      await domainSuite.test(`Domain ${domain.id}: ${domain.name} (${domain.actionsCount} actions)`, async (t) => {
        let domainMutations = 0;
        let domainAccepted = 0;
        let domainRejected = 0;

        for (const actionDef of domain.actions) {
          const stats = await engine.fuzzAction(actionDef);

          // Verify requirement: >50 mutations generated and tested per action
          assert.ok(
            stats.totalMutations >= 50,
            `Action ${actionDef.action} must have >= 50 mutations, got ${stats.totalMutations}`
          );

          // Verify requirement: 0 uncaught errors or crashes
          assert.equal(
            stats.uncaughtErrors,
            0,
            `Action ${actionDef.action} produced ${stats.uncaughtErrors} uncaught errors`
          );

          // Verify requirement: all rejections returned structured error codes
          for (const errorCode of Object.keys(stats.errorCodesSeen)) {
            assert.ok(
              KNOWN_FAIL_CLOSED_CODES.has(errorCode) || errorCode.startsWith('ERR_'),
              `Action ${actionDef.action} returned non-standard error code: ${errorCode}`
            );
          }

          domainMutations += stats.totalMutations;
          domainAccepted += stats.acceptedCount;
          domainRejected += stats.rejectedCount;
        }

        assert.ok(domainMutations >= domain.actionsCount * 50);
        assertPrototypeClean();
      });
    }
  });

  // =========================================================================
  // 2. Prototype Pollution Defense: Zero Prototype Tampering
  // =========================================================================
  await masterSuite.test('2. Prototype Pollution Defense: Zero Prototype Tampering', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'proto_pollution_test' });

    const pollutionPayloads = [
      JSON.parse('{"__proto__": {"polluted": true, "isAdmin": true, "role": "admin"}}'),
      JSON.parse('{"constructor": {"prototype": {"polluted": true, "bypass": true}}}'),
      JSON.parse('{"__proto__": {"isDark": true, "status": "SUCCESS", "authenticated": true}}'),
      {
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
        key: '__proto__',
        value: 'evil',
      },
    ];

    for (const actionDef of ALL_197_ACTIONS) {
      for (const payload of pollutionPayloads) {
        try {
          await bridge.callNative(actionDef.action, payload);
        } catch (err: any) {
          assert.ok(err instanceof GoatBridgeError);
        }

        // Verify prototype remains clean after every call
        assertPrototypeClean();
        assert.equal((Object.prototype as any).polluted, undefined);
        assert.equal((Object.prototype as any).isAdmin, undefined);
        assert.equal((Object.prototype as any).bypass, undefined);
      }
    }
  });

  // =========================================================================
  // 3. SSRF & Network Boundary Defense Verification
  // =========================================================================
  await masterSuite.test('3. SSRF & Network Boundary Defense: 100% Blocking of Restricted Endpoints', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'ssrf_fuzz_app' });

    // API_REQUEST must block all canonical SSRF vectors with SSRF_BLOCKED
    for (const ssrfUrl of SSRF_BLOCKED_URLS) {
      await t.test(`API_REQUEST blocks SSRF target: ${ssrfUrl}`, async () => {
        await assert.rejects(
          () => bridge.callNative('API_REQUEST', { url: ssrfUrl }),
          (err: any) => {
            assert.ok(err instanceof GoatBridgeError);
            assert.equal(
              err.code,
              BridgeErrorCodes.SSRF_BLOCKED,
              `Expected SSRF_BLOCKED for ${ssrfUrl}, got ${err.code}`
            );
            return true;
          }
        );
      });
    }

    // Malformed and dangerous schemes must be rejected with INVALID_ARGUMENT
    for (const badUrl of MALFORMED_AND_DANGEROUS_URLS) {
      await t.test(`API_REQUEST rejects dangerous/malformed URL: ${badUrl}`, async () => {
        await assert.rejects(
          () => bridge.callNative('API_REQUEST', { url: badUrl }),
          (err: any) => {
            assert.ok(err instanceof GoatBridgeError);
            assert.ok(
              err.code === BridgeErrorCodes.INVALID_ARGUMENT ||
                err.code === BridgeErrorCodes.SSRF_BLOCKED
            );
            return true;
          }
        );
      });
    }

    // START_OAUTH_SESSION must block non-https URLs
    const nonHttpsUrls = ['http://insecure.oauth.com', 'ftp://auth.com', 'javascript:alert(1)', 'file:///etc/passwd'];
    for (const badUrl of nonHttpsUrls) {
      await t.test(`START_OAUTH_SESSION rejects non-HTTPS URL: ${badUrl}`, async () => {
        await assert.rejects(
          () => bridge.callNative('START_OAUTH_SESSION', { authUrl: badUrl }),
          (err: any) => {
            assert.ok(err instanceof GoatBridgeError);
            assert.ok(
              err.code === BridgeErrorCodes.SECURITY_VIOLATION ||
                err.code === BridgeErrorCodes.INVALID_ARGUMENT
            );
            return true;
          }
        );
      });
    }
  });

  // =========================================================================
  // 4. Sandboxed FileSystem & Path Traversal Defense
  // =========================================================================
  await masterSuite.test('4. Path Traversal & FileSystem Sandbox Defense', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'fs_traversal_fuzz' });
    const fsActions = [
      'FS_WRITE_FILE',
      'FS_READ_FILE',
      'FS_STAT',
      'FS_UNLINK',
      'FS_COPY_FILE',
      'FS_EXISTS',
      'FS_MKDIR',
      'FS_RMDIR',
      'FS_LIST_DIR',
    ];

    for (const action of fsActions) {
      for (const vector of PATH_TRAVERSAL_VECTORS) {
        await t.test(`Action [${action}] rejects traversal vector: "${vector}"`, async () => {
          await assert.rejects(
            () =>
              bridge.callNative(action, {
                filePath: vector,
                dirPath: vector,
                srcPath: vector,
                destPath: '/sandbox/safe.txt',
                data: 'traversal_attempt',
              }),
            (err: any) => {
              assert.ok(err instanceof GoatBridgeError);
              assert.ok(
                [
                  BridgeErrorCodes.SECURITY_VIOLATION,
                  BridgeErrorCodes.INVALID_ARGUMENT,
                  'NOT_FOUND',
                ].includes(err.code),
                `Unexpected error code for path traversal: ${err.code}`
              );
              return true;
            }
          );
        });
      }
    }
  });

  // =========================================================================
  // 5. Low-Level postMessage Wire Frame Fuzzing
  // =========================================================================
  await masterSuite.test('5. Low-Level postMessage Wire Frame Fuzzing: Zero Fatal Panics', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'postmessage_fuzz' });

    const malformedFrames: any[] = [
      'NOT_JSON_STRING',
      '{"unclosed": "json',
      '{ broken: json }',
      '{}',
      '[]',
      { id: 'req_1' }, // Missing action
      { action: 'GET_DEVICE_INFO' }, // Missing id
      { id: null, action: null },
      { id: 12345, action: 99999 },
      { id: 'req_fuzz', action: 'NON_EXISTENT_ACTION_STRING_XYZ' },
      { id: 'req_fuzz', action: 'STORAGE_SET', payload: 'INVALID_PAYLOAD_TYPE' },
      { id: 'req_fuzz', action: 'API_REQUEST', payload: { url: 'http://169.254.169.254' } },
      JSON.stringify({ id: 'req_proto', action: 'GET_DEVICE_INFO', payload: { __proto__: { polluted: true } } }),
    ];

    for (let i = 0; i < malformedFrames.length; i++) {
      const frame = malformedFrames[i];
      // postMessage must never throw unhandled exceptions
      assert.doesNotThrow(() => {
        bridge.postMessage(frame as any);
      });
    }

    assertPrototypeClean();
  });

  // =========================================================================
  // 6. High-Concurrency Rapid-Fire Multi-Tenant Fuzzing
  // =========================================================================
  await masterSuite.test('6. High-Concurrency Multi-Tenant Parallel Fuzzing: 500 Requests', async (t) => {
    const tenantIds = ['tenant_alpha', 'tenant_beta', 'tenant_gamma', 'tenant_delta', 'tenant_epsilon'];
    const bridges = tenantIds.map((id) => new GoatBridgeMock({ appId: id }));

    const operations: Promise<any>[] = [];

    for (let i = 0; i < 500; i++) {
      const bridge = bridges[i % bridges.length];
      const actionIndex = i % ALL_197_ACTIONS.length;
      const actionDef = ALL_197_ACTIONS[actionIndex];

      // Pick a random mutation type
      const mutIndex = i % 5;
      let payload: any;
      if (mutIndex === 0) payload = PRIMITIVE_TYPE_MUTATIONS[i % PRIMITIVE_TYPE_MUTATIONS.length];
      else if (mutIndex === 1) payload = { ...actionDef.samplePayload, value: BOUNDARY_NUMBERS[i % BOUNDARY_NUMBERS.length] };
      else if (mutIndex === 2) payload = { ...actionDef.samplePayload, key: STRING_EXTREMES[i % STRING_EXTREMES.length] };
      else if (mutIndex === 3) payload = { __proto__: { polluted: true }, noise: i };
      else payload = actionDef.samplePayload;

      operations.push(
        bridge
          .callNative(actionDef.action, payload)
          .then((res) => ({ success: true, res }))
          .catch((err) => {
            assert.ok(err instanceof GoatBridgeError);
            return { success: false, error: err };
          })
      );
    }

    const results = await Promise.all(operations);
    assert.equal(results.length, 500);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    assert.ok(successCount > 0, 'Expected some successful calls');
    assert.ok(failureCount > 0, 'Expected some fail-closed rejected calls');

    assertPrototypeClean();
  });
});
