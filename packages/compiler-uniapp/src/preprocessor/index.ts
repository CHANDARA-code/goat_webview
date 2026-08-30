/**
 * @goat/compiler-uniapp Preprocessor Module
 */
import { preprocessSourceCode } from './mask.js';
import type { PreprocessorOptions, PreprocessorResult } from '../types.js';

export function preprocessCode(
  code: string,
  options?: PreprocessorOptions
): PreprocessorResult {
  return preprocessSourceCode(code, options);
}

export * from './parser.js';
export * from './mask.js';
