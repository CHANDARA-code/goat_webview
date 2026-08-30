/**
 * Generative, Boundary, Schema Mutation, and Type-Confusion Fuzz Testing Engine
 * Covers all 197 IPC actions across 18 functional domains.
 */

import {
  ActionDefinition,
  ALL_197_ACTIONS,
} from './action-catalog.js';
import {
  MutationEntry,
  MutationCategory,
  PRIMITIVE_TYPE_MUTATIONS,
  BOUNDARY_NUMBERS,
  STRING_EXTREMES,
  PATH_TRAVERSAL_VECTORS,
  ALL_NETWORK_FUZZ_URLS,
  createPrototypePollutionPayloads,
  createDeepNestingPayloads,
  MALFORMED_DATA_PAYLOADS,
} from './mutation-strategies.js';
import { GoatBridgeError, BridgeErrorCodes } from '../../src/errors.js';
import { GoatBridgeMock } from '../../src/runtime.js';

export interface ActionFuzzStats {
  action: string;
  domain: string;
  domainId: number;
  totalMutations: number;
  acceptedCount: number;
  rejectedCount: number;
  uncaughtErrors: number;
  durationMs: number;
  errorCodesSeen: Record<string, number>;
}

export interface FuzzSuiteReport {
  totalActions: number;
  totalMutationsExecuted: number;
  totalAccepted: number;
  totalRejectedFailClosed: number;
  totalUncaughtCrashes: number;
  prototypePollutionDetected: boolean;
  totalDurationMs: number;
  domainStats: Record<string, { totalActions: number; totalMutations: number; errorCodes: Record<string, number> }>;
  actionStats: ActionFuzzStats[];
}

export class FuzzGenerator {
  /**
   * Generates >50 distinct adversarial mutations tailored for the given action
   */
  public static generateMutationsForAction(actionDef: ActionDefinition): MutationEntry[] {
    const mutations: MutationEntry[] = [];
    const base = actionDef.samplePayload || {};

    // 1. Primitive Type Confusions (18 mutations)
    for (let i = 0; i < PRIMITIVE_TYPE_MUTATIONS.length; i++) {
      const prim = PRIMITIVE_TYPE_MUTATIONS[i];
      mutations.push({
        name: `primitive_type_confusion_${i}_${typeof prim}_${String(prim).slice(0, 15)}`,
        category: 'primitive_type_confusion',
        payload: prim,
      });
    }

    // 2. Numeric Boundaries (Applied both naked and inside payload fields) (14 mutations)
    const numericFields = Object.keys(base).filter((k) => typeof base[k] === 'number');
    const targetNumFields = numericFields.length > 0 ? numericFields : ['value', 'count', 'duration', 'progress', 'position', 'latitude', 'longitude', 'x', 'y', 'z', 'heightPx', 'limit'];

    for (let i = 0; i < BOUNDARY_NUMBERS.length; i += 2) {
      const numVal = BOUNDARY_NUMBERS[i];
      // Naked numeric payload
      mutations.push({
        name: `numeric_boundary_naked_${i}_${String(numVal)}`,
        category: 'numeric_boundary',
        payload: numVal,
      });

      // Field mutated payload
      const mutatedPayload = { ...base };
      for (const field of targetNumFields) {
        mutatedPayload[field] = numVal;
      }
      mutations.push({
        name: `numeric_boundary_field_${i}_${String(numVal)}`,
        category: 'numeric_boundary',
        payload: mutatedPayload,
      });
    }

    // 3. String Extremes & Injections (15 mutations)
    const stringFields = Object.keys(base).filter((k) => typeof base[k] === 'string');
    const targetStrFields = stringFields.length > 0 ? stringFields : ['key', 'value', 'text', 'title', 'content', 'url', 'filePath', 'dirPath', 'route', 'topic', 'name', 'action'];

    for (let i = 0; i < STRING_EXTREMES.length; i += 2) {
      const strVal = STRING_EXTREMES[i];
      // Field mutated payload
      const mutatedPayload = { ...base };
      for (const field of targetStrFields) {
        mutatedPayload[field] = strVal;
      }
      mutations.push({
        name: `string_extreme_field_${i}_len_${strVal.length}`,
        category: 'string_extremes',
        payload: mutatedPayload,
      });
    }

    // 4. Path Traversal & Sandbox Escape (10 mutations)
    for (let i = 0; i < Math.min(10, PATH_TRAVERSAL_VECTORS.length); i++) {
      const pathVector = PATH_TRAVERSAL_VECTORS[i];
      const mutatedPayload = {
        ...base,
        filePath: pathVector,
        dirPath: pathVector,
        srcPath: pathVector,
        destPath: pathVector,
        key: pathVector,
        mediaPath: pathVector,
        bundlePath: pathVector,
      };
      mutations.push({
        name: `path_traversal_${i}_${pathVector.slice(0, 20)}`,
        category: 'path_traversal',
        payload: mutatedPayload,
      });
    }

    // 5. SSRF & Network Vector Payloads (10 mutations)
    for (let i = 0; i < Math.min(10, ALL_NETWORK_FUZZ_URLS.length); i++) {
      const ssrfUrl = ALL_NETWORK_FUZZ_URLS[i];
      const mutatedPayload = {
        ...base,
        url: ssrfUrl,
        authUrl: ssrfUrl,
        host: ssrfUrl,
        hostname: ssrfUrl,
        src: ssrfUrl,
        attributionUrl: ssrfUrl,
      };
      mutations.push({
        name: `ssrf_network_${i}_${ssrfUrl.slice(0, 25)}`,
        category: 'ssrf_network',
        payload: mutatedPayload,
      });
    }

    // 6. Prototype Pollution Payloads (6 mutations)
    const protoPayloads = createPrototypePollutionPayloads();
    for (let i = 0; i < protoPayloads.length; i++) {
      mutations.push({
        name: `prototype_pollution_${i}`,
        category: 'prototype_pollution',
        payload: protoPayloads[i],
      });
    }

    // 7. Deep Nesting & Object Graphs (6 mutations)
    const deepPayloads = createDeepNestingPayloads();
    for (let i = 0; i < deepPayloads.length; i++) {
      mutations.push({
        name: `deep_nesting_${i}`,
        category: 'deep_nesting',
        payload: deepPayloads[i],
      });
    }

    // 8. Malformed Data Format Payloads (8 mutations)
    for (let i = 0; i < Math.min(8, MALFORMED_DATA_PAYLOADS.length); i++) {
      mutations.push({
        name: `malformed_data_${i}`,
        category: 'malformed_data',
        payload: MALFORMED_DATA_PAYLOADS[i],
      });
    }

    // 9. Schema Permutations (Missing required fields & type flipping) (10+ mutations)
    const keys = Object.keys(base);
    if (keys.length > 0) {
      // Missing field permutations
      for (const k of keys) {
        const copy = { ...base };
        delete copy[k];
        mutations.push({
          name: `schema_missing_field_${k}`,
          category: 'schema_permutation',
          payload: copy,
        });

        // Nullified field
        mutations.push({
          name: `schema_null_field_${k}`,
          category: 'schema_permutation',
          payload: { ...base, [k]: null },
        });

        // Type-flipped field (opposite type)
        const currVal = base[k];
        let flippedVal: any;
        if (typeof currVal === 'string') flippedVal = 12345678;
        else if (typeof currVal === 'number') flippedVal = 'not_a_number_string';
        else if (typeof currVal === 'boolean') flippedVal = { booleanObject: true };
        else if (Array.isArray(currVal)) flippedVal = 'string_not_array';
        else flippedVal = 'primitive_not_object';

        mutations.push({
          name: `schema_type_flipped_${k}`,
          category: 'schema_permutation',
          payload: { ...base, [k]: flippedVal },
        });
      }
    } else {
      // For parameterless actions, inject unexpected noisy fields
      mutations.push({
        name: 'schema_unexpected_extra_fields',
        category: 'schema_permutation',
        payload: {
          __unexpected_fuzz_key_1: 'noise_val',
          __unexpected_fuzz_key_2: 99999,
          __unexpected_fuzz_key_3: [1, 2, 3],
          nestedNoise: { deep: true },
        },
      });
    }

    return mutations;
  }
}

/**
 * Validates that Object.prototype has not been polluted with dangerous properties
 */
export function assertPrototypeClean(): void {
  const rootProto = Object.prototype as any;
  const dangerousKeys = [
    'polluted',
    'isAdmin',
    'role',
    'isDark',
    'status',
    'authenticated',
    'verified',
    'bypass',
    'eval',
  ];

  for (const key of dangerousKeys) {
    if (rootProto[key] !== undefined) {
      delete rootProto[key];
      throw new Error(`CRITICAL SECURITY FAILURE: Prototype pollution detected on Object.prototype.${key}!`);
    }
  }
}

/**
 * Standard known bridge error codes
 */
export const KNOWN_FAIL_CLOSED_CODES = new Set<string>([
  BridgeErrorCodes.INVALID_ARGUMENT,
  BridgeErrorCodes.UNSUPPORTED_ACTION,
  BridgeErrorCodes.SECURITY_VIOLATION,
  BridgeErrorCodes.SSRF_BLOCKED,
  BridgeErrorCodes.STORAGE_QUOTA_EXCEEDED,
  BridgeErrorCodes.PERMISSION_DENIED,
  BridgeErrorCodes.GESTURE_REQUIRED,
  BridgeErrorCodes.DIALOG_COOLDOWN_ACTIVE,
  BridgeErrorCodes.TIMEOUT,
  BridgeErrorCodes.BIOMETRIC_UNAVAILABLE,
  BridgeErrorCodes.BIOMETRIC_LOCKOUT,
  BridgeErrorCodes.NETWORK_OFFLINE,
  BridgeErrorCodes.PORT_NOT_FOUND,
  BridgeErrorCodes.NATIVE_EXECUTION_ERROR,
  // Standard compatibility error codes
  'ERR_INVALID_PARAM',
  'ERR_UNAUTHORIZED',
  'ERR_UNKNOWN_ACTION',
  'ERR_QUOTA_EXCEEDED',
  'NOT_FOUND',
  'USER_CANCEL',
  'USER_CANCELLED',
  'USER_REJECTED',
  'KEYSTORE_ERROR',
  'GATT_ERROR',
  'DEVICE_NOT_FOUND',
  'SSL_PINNING_FAILED',
  'STACK_UNDERFLOW',
  'COMPILATION_ERROR',
  'PACKAGE_NOT_FOUND',
  'CHECKSUM_MISMATCH',
  'VIEW_CREATION_FAILED',
  'STORE_UNAVAILABLE',
  'PAYMENT_CANCELLED',
  'PAYMENT_FAILED',
  'WALLET_NOT_FOUND',
  'WALLET_NOT_CONNECTED',
  'PORT_CLOSED',
  'BLUETOOTH_DISABLED',
  'NFC_ERROR',
  'MEDIA_ERROR',
  'NOT_SUPPORTED',
  'LOCATION_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
]);

/**
 * Fuzz Engine Executor
 */
export class FuzzEngine {
  private bridge: GoatBridgeMock;

  constructor(bridge?: GoatBridgeMock) {
    this.bridge = bridge || new GoatBridgeMock({ appId: 'fuzz_tester_app' });
  }

  /**
   * Executes fuzz testing across a single action definition
   */
  public async fuzzAction(actionDef: ActionDefinition): Promise<ActionFuzzStats> {
    const startTime = Date.now();
    const mutations = FuzzGenerator.generateMutationsForAction(actionDef);

    const stats: ActionFuzzStats = {
      action: actionDef.action,
      domain: actionDef.domain,
      domainId: actionDef.domainId,
      totalMutations: mutations.length,
      acceptedCount: 0,
      rejectedCount: 0,
      uncaughtErrors: 0,
      durationMs: 0,
      errorCodesSeen: {},
    };

    assertPrototypeClean();

    for (const mutation of mutations) {
      try {
        const result = await this.bridge.callNative(actionDef.action, mutation.payload);
        // Valid response returned safely
        stats.acceptedCount++;
      } catch (err: any) {
        if (err instanceof GoatBridgeError) {
          stats.rejectedCount++;
          const code = err.code || 'UNKNOWN_ERROR';
          stats.errorCodesSeen[code] = (stats.errorCodesSeen[code] || 0) + 1;
        } else {
          // Uncaught non-GoatBridgeError is a failure
          stats.uncaughtErrors++;
          console.error(`[FUZZ CRASH] Uncaught exception on ${actionDef.action} (${mutation.name}):`, err);
        }
      }

      // Check prototype integrity after every single mutation
      assertPrototypeClean();
    }

    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Executes fuzz testing across all 197 actions
   */
  public async fuzzAllActions(actions: ActionDefinition[] = ALL_197_ACTIONS): Promise<FuzzSuiteReport> {
    const suiteStartTime = Date.now();
    const actionStats: ActionFuzzStats[] = [];
    const domainStats: Record<string, { totalActions: number; totalMutations: number; errorCodes: Record<string, number> }> = {};

    let totalMutationsExecuted = 0;
    let totalAccepted = 0;
    let totalRejectedFailClosed = 0;
    let totalUncaughtCrashes = 0;
    let prototypePollutionDetected = false;

    for (const actionDef of actions) {
      const stats = await this.fuzzAction(actionDef);
      actionStats.push(stats);

      totalMutationsExecuted += stats.totalMutations;
      totalAccepted += stats.acceptedCount;
      totalRejectedFailClosed += stats.rejectedCount;
      totalUncaughtCrashes += stats.uncaughtErrors;

      // Group domain stats
      const domainKey = `Domain ${actionDef.domainId}: ${actionDef.domain}`;
      if (!domainStats[domainKey]) {
        domainStats[domainKey] = {
          totalActions: 0,
          totalMutations: 0,
          errorCodes: {},
        };
      }
      domainStats[domainKey].totalActions++;
      domainStats[domainKey].totalMutations += stats.totalMutations;
      for (const [code, count] of Object.entries(stats.errorCodesSeen)) {
        domainStats[domainKey].errorCodes[code] = (domainStats[domainKey].errorCodes[code] || 0) + count;
      }
    }

    try {
      assertPrototypeClean();
    } catch {
      prototypePollutionDetected = true;
    }

    const totalDurationMs = Date.now() - suiteStartTime;

    return {
      totalActions: actions.length,
      totalMutationsExecuted,
      totalAccepted,
      totalRejectedFailClosed,
      totalUncaughtCrashes,
      prototypePollutionDetected,
      totalDurationMs,
      domainStats,
      actionStats,
    };
  }
}
