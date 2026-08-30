/**
 * @goat/bridge-mock - Domain 16: Subpackages, WASM & Bytecode Handlers (9 Actions)
 */

import { mockState } from '../state/store.js';
import {
  SubpackageLoadResult,
  BytecodePrecompileResult,
  BytecodeCacheStatsResult,
  WasmSupportResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class SubpackageHandlers {
  /**
   * Action 165: LOAD_SUBPACKAGE
   */
  public static loadSubpackage(payload: any = {}, callerAppId: string = mockState.defaultAppId): Promise<SubpackageLoadResult> {
    const subpackageName = payload.subpackageName || payload.name;
    if (!subpackageName || typeof subpackageName !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "subpackageName" parameter');
    }
    const appId = payload.appId || callerAppId;

    const existing = mockState.subpackages.get(subpackageName);
    const isCached = existing ? existing.isCached : false;
    const byteSize = existing ? existing.byteSize : 185000;
    const extractedPath = `/sandbox/subpackages/${appId}/${subpackageName}`;

    mockState.subpackages.set(subpackageName, { isCached: true, byteSize, extractedPath });

    return Promise.resolve({
      appId,
      subpackageName,
      isSuccess: true,
      isCached,
      extractedPath,
      byteSize,
    });
  }

  /**
   * Action 166: IS_SUBPACKAGE_CACHED
   */
  public static isSubpackageCached(payload: any = {}, callerAppId: string = mockState.defaultAppId): { isCached: boolean; subpackageName: string; appId: string } {
    const subpackageName = payload.subpackageName || payload.name;
    if (!subpackageName) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing "subpackageName"');
    }
    const appId = payload.appId || callerAppId;
    const item = mockState.subpackages.get(subpackageName);
    return {
      isCached: item ? item.isCached : false,
      subpackageName,
      appId,
    };
  }

  /**
   * Action 167: CLEAR_SUBPACKAGE_CACHE
   */
  public static clearSubpackageCache(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean; subpackageName: string; appId: string } {
    const subpackageName = payload.subpackageName || payload.name;
    const appId = payload.appId || callerAppId;
    if (subpackageName) {
      mockState.subpackages.delete(subpackageName);
      return { cleared: true, subpackageName, appId };
    }
    mockState.subpackages.clear();
    return { cleared: true, subpackageName: 'ALL', appId };
  }

  /**
   * Action 168: GET_SUBPACKAGES
   */
  public static getSubpackages(payload: any = {}, callerAppId: string = mockState.defaultAppId): { appId: string; subpackages: string[] } {
    const appId = payload.appId || callerAppId;
    return {
      appId,
      subpackages: Array.from(mockState.subpackages.keys()),
    };
  }

  /**
   * Action 169: PRECOMPILE_BYTECODE
   */
  public static precompileBytecode(payload: any = {}, callerAppId: string = mockState.defaultAppId): Promise<BytecodePrecompileResult> {
    const bundlePath = payload.bundlePath || '/bundle/main.js';
    const appId = payload.appId || callerAppId;
    const bytecodeSizeBytes = 450000;
    const cachePath = `/sandbox/bytecode/${appId}/cache_${Date.now()}.bin`;

    mockState.bytecodeCache.set(bundlePath, {
      bytecodeSizeBytes,
      cachePath,
      isWarm: true,
    });

    return Promise.resolve({
      appId,
      isSuccess: true,
      compileDurationMs: 14.5,
      bytecodeSizeBytes,
      cachePath,
    });
  }

  /**
   * Action 170: IS_BYTECODE_WARM
   */
  public static isBytecodeWarm(payload: any = {}, callerAppId: string = mockState.defaultAppId): { isWarm: boolean; appId: string } {
    const appId = payload.appId || callerAppId;
    const isWarm = mockState.bytecodeCache.size > 0;
    return { isWarm, appId };
  }

  /**
   * Action 171: CLEAR_BYTECODE_CACHE
   */
  public static clearBytecodeCache(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean; appId: string } {
    const appId = payload.appId || callerAppId;
    mockState.bytecodeCache.clear();
    return { cleared: true, appId };
  }

  /**
   * Action 172: GET_BYTECODE_STATS
   */
  public static getBytecodeStats(): BytecodeCacheStatsResult {
    let totalBytes = 0;
    for (const item of mockState.bytecodeCache.values()) {
      totalBytes += item.bytecodeSizeBytes;
    }
    return {
      totalCachedBundles: mockState.bytecodeCache.size,
      totalCacheSizeBytes: totalBytes,
      isWarm: mockState.bytecodeCache.size > 0,
    };
  }

  /**
   * Action 173: VALIDATE_WASM_SUPPORT
   */
  public static validateWasmSupport(): WasmSupportResult {
    const wasmSupported = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
    return {
      wasmSupported,
      simdSupported: true,
      sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
      threadsSupported: typeof Worker !== 'undefined',
      maxMemoryPages: 65536,
    };
  }
}
