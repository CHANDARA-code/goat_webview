/**
 * @goat/compiler-uniapp
 * Universal Uni-app (Vue 3 / SFC) Compiler Adapter & JSAPI Bridge for Goat WebView.
 */

export * from './types.js';
export * from './plugin.js';
export * from './config/index.js';
export * from './preprocessor/index.js';
export * from './runtime/index.js';
export * from './bundler/index.js';
export * from './utils/hash.js';
export * from './utils/jsonc.js';

import { goatUniAppPlugin } from './plugin.js';
export default goatUniAppPlugin;
