/**
 * @goat/compiler-uniapp Configuration Parsers
 */
import { parseJsonc } from '../utils/jsonc.js';
import type { PagesJson, UniAppManifestJson } from '../types.js';
import { validatePagesJson } from './validator.js';

export function parsePagesJson(content: string): PagesJson {
  const parsed = parseJsonc<PagesJson>(content);
  validatePagesJson(parsed);
  return parsed;
}

export function parseUniAppManifest(content: string): UniAppManifestJson {
  return parseJsonc<UniAppManifestJson>(content);
}
