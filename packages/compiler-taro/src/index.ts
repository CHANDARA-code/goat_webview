/**
 * @goat/compiler-taro - Main Package Entrypoint
 * Complete build adapter, CLI platform plugin, configuration transformers,
 * JSAPI runtime bridge shims, dual/single-thread bundlers, and integrity generation for Taro.
 */

// 1. Platform Plugin
export { default as GoatTaroPlugin, GoatTaroPlugin as plugin, PLATFORM_NAME } from './plugin.js';

// 2. Config Transformer & Validator
export {
  transformTaroConfig,
  validateManifest,
  validateGoatConfig,
  parseRouteTable,
  extractPermissions,
  normalizeHexColor,
  deriveAppId,
  deriveVersionCode,
  normalizePath,
} from './config/index.js';

// 3. Runtime JSAPI Bridge Shims
export { default as Taro, Taro as taro, bridge, syncStorage, getCachedSystemInfo, updateCachedSystemInfo } from './runtime/index.js';

// 4. Bundlers & Integrity Generator
export {
  compileDualThreadBundle,
  compileSingleThreadBundle,
  generateIntegrityManifest,
  verifyIntegrity,
  computeSha256,
} from './bundler/index.js';

// 5. Types
export * from './types.js';
