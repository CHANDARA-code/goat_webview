/**
 * @goat/compiler-uniapp Unified Bundler Module
 */
import { compileDualThreadBundle } from './dual-thread.js';
import { compileSingleThreadBundle } from './single-thread.js';
import type { BundlerInput, BundlerOutput } from '../types.js';

export function bundleGoatUniApp(input: BundlerInput): BundlerOutput {
  const model = input.targetThreadModel || input.goatConfig.targetThreadModel || 'dual-thread';

  if (model === 'single-thread') {
    return compileSingleThreadBundle(input);
  }

  return compileDualThreadBundle(input);
}

export * from './dual-thread.js';
export * from './single-thread.js';
export * from './integrity.js';
