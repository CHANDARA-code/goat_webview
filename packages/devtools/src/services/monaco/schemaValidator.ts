/**
 * @goat/devtools - Schema Validator
 * Live validator for manifest.json and goat.config.json against official schemas.
 */

import type { ValidationMarker } from '../../types/workspace.ts';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationMarker[];
  warnings: ValidationMarker[];
}

const VALID_PERMISSIONS = new Set([
  'CAMERA',
  'LOCATION',
  'RECORD_AUDIO',
  'STORAGE',
  'BIOMETRIC',
  'BLUETOOTH',
  'PAYMENT',
  'CONTACTS',
  'CLIPBOARD',
  'HAPTICS',
  'NFC',
]);

const APP_ID_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)+$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates manifest.json content string
 */
export function validateManifestJson(content: string, filePath = 'manifest.json'): ValidationResult {
  const errors: ValidationMarker[] = [];
  const warnings: ValidationMarker[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [
        {
          filePath,
          line: 1,
          column: 1,
          message: `JSON Syntax Error: ${err.message}`,
          severity: 'error',
          source: 'JSON Parser',
        },
      ],
      warnings: [],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      isValid: false,
      errors: [
        {
          filePath,
          line: 1,
          column: 1,
          message: 'Root manifest must be a JSON object',
          severity: 'error',
          source: 'Schema Validator',
        },
      ],
      warnings: [],
    };
  }

  // Required properties: ["appId", "appName", "version", "versionCode", "entryPage"]
  const required = ['appId', 'appName', 'version', 'versionCode', 'entryPage'];
  for (const req of required) {
    if (parsed[req] === undefined || parsed[req] === null || parsed[req] === '') {
      errors.push({
        filePath,
        line: findLineNumber(content, `"${req}"`),
        column: 1,
        message: `Missing required manifest field: "${req}"`,
        severity: 'error',
        source: 'manifest.schema.json',
      });
    }
  }

  // Validate appId
  if (parsed.appId && typeof parsed.appId === 'string' && !APP_ID_REGEX.test(parsed.appId)) {
    errors.push({
      filePath,
      line: findLineNumber(content, '"appId"'),
      column: 1,
      message: `Invalid appId format "${parsed.appId}". Must be a reverse-domain identifier (e.g. "com.example.app").`,
      severity: 'error',
      source: 'manifest.schema.json',
    });
  }

  // Validate version
  if (parsed.version && typeof parsed.version === 'string' && !SEMVER_REGEX.test(parsed.version)) {
    errors.push({
      filePath,
      line: findLineNumber(content, '"version"'),
      column: 1,
      message: `Invalid version "${parsed.version}". Must be semantic versioning (e.g. "1.0.0").`,
      severity: 'error',
      source: 'manifest.schema.json',
    });
  }

  // Validate versionCode
  if (parsed.versionCode !== undefined && (typeof parsed.versionCode !== 'number' || parsed.versionCode < 1 || !Number.isInteger(parsed.versionCode))) {
    errors.push({
      filePath,
      line: findLineNumber(content, '"versionCode"'),
      column: 1,
      message: 'versionCode must be a positive integer (minimum 1).',
      severity: 'error',
      source: 'manifest.schema.json',
    });
  }

  // Validate permissions
  if (parsed.permissions) {
    if (!Array.isArray(parsed.permissions)) {
      errors.push({
        filePath,
        line: findLineNumber(content, '"permissions"'),
        column: 1,
        message: 'Field "permissions" must be an array of capability strings.',
        severity: 'error',
        source: 'manifest.schema.json',
      });
    } else {
      const seen = new Set<string>();
      for (const perm of parsed.permissions) {
        if (!VALID_PERMISSIONS.has(perm)) {
          errors.push({
            filePath,
            line: findLineNumber(content, `"${perm}"`),
            column: 1,
            message: `Unknown permission capability "${perm}". Valid options: ${Array.from(VALID_PERMISSIONS).join(', ')}.`,
            severity: 'error',
            source: 'manifest.schema.json',
          });
        }
        if (seen.has(perm)) {
          warnings.push({
            filePath,
            line: findLineNumber(content, `"${perm}"`),
            column: 1,
            message: `Duplicate permission declaration "${perm}".`,
            severity: 'warning',
            source: 'manifest.schema.json',
          });
        }
        seen.add(perm);
      }
    }
  }

  // Validate window colors
  if (parsed.window && typeof parsed.window === 'object') {
    if (parsed.window.backgroundColor && !HEX_COLOR_REGEX.test(parsed.window.backgroundColor)) {
      errors.push({
        filePath,
        line: findLineNumber(content, '"backgroundColor"'),
        column: 1,
        message: `Invalid backgroundColor "${parsed.window.backgroundColor}". Must be a 6-digit hex color (e.g. #FFFFFF).`,
        severity: 'error',
        source: 'manifest.schema.json',
      });
    }
    if (parsed.window.navigationBarBackgroundColor && !HEX_COLOR_REGEX.test(parsed.window.navigationBarBackgroundColor)) {
      errors.push({
        filePath,
        line: findLineNumber(content, '"navigationBarBackgroundColor"'),
        column: 1,
        message: `Invalid navigationBarBackgroundColor "${parsed.window.navigationBarBackgroundColor}". Must be a 6-digit hex color.`,
        severity: 'error',
        source: 'manifest.schema.json',
      });
    }
  }

  // Validate subpackages
  if (parsed.subpackages) {
    if (!Array.isArray(parsed.subpackages)) {
      errors.push({
        filePath,
        line: findLineNumber(content, '"subpackages"'),
        column: 1,
        message: '"subpackages" must be an array of subpackage objects.',
        severity: 'error',
        source: 'manifest.schema.json',
      });
    } else {
      parsed.subpackages.forEach((sub: any, idx: number) => {
        if (!sub.root) {
          errors.push({
            filePath,
            line: findLineNumber(content, '"subpackages"'),
            column: 1,
            message: `Subpackage at index ${idx} is missing required "root" directory path.`,
            severity: 'error',
            source: 'manifest.schema.json',
          });
        }
        if (!sub.pages || !Array.isArray(sub.pages)) {
          errors.push({
            filePath,
            line: findLineNumber(content, '"subpackages"'),
            column: 1,
            message: `Subpackage "${sub.root || idx}" must declare a "pages" array.`,
            severity: 'error',
            source: 'manifest.schema.json',
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates goat.config.json content string
 */
export function validateGoatConfigJson(content: string, filePath = 'goat.config.json'): ValidationResult {
  const errors: ValidationMarker[] = [];
  const warnings: ValidationMarker[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [
        {
          filePath,
          line: 1,
          column: 1,
          message: `JSON Syntax Error: ${err.message}`,
          severity: 'error',
          source: 'JSON Parser',
        },
      ],
      warnings: [],
    };
  }

  const required = ['name', 'version', 'appId', 'entryPage'];
  for (const req of required) {
    if (!parsed[req]) {
      errors.push({
        filePath,
        line: findLineNumber(content, `"${req}"`),
        column: 1,
        message: `Missing required config field: "${req}"`,
        severity: 'error',
        source: 'goat.config.schema.json',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Finds approximate 1-based line number for a needle substring in JSON
 */
function findLineNumber(content: string, needle: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) {
      return i + 1;
    }
  }
  return 1;
}
