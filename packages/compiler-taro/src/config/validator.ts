/**
 * @goat/compiler-taro - Configuration Schema Validator
 * Enforces strict compliance against manifest.schema.json and goat.config.json.
 */

import { GoatManifest, GoatConfig, GoatPermission } from '../types.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const VALID_PERMISSIONS = new Set<GoatPermission>([
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

export const APP_ID_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)+$/;
export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates a GoatManifest object against manifest.schema.json rules
 */
export function validateManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      isValid: false,
      errors: ['Manifest must be a non-null object.'],
      warnings: [],
    };
  }

  const m = manifest as Record<string, any>;

  // Required fields: appId, appName, version, versionCode, entryPage
  if (!m.appId || typeof m.appId !== 'string') {
    errors.push('Missing required field: "appId" must be a non-empty string.');
  } else if (!APP_ID_REGEX.test(m.appId)) {
    errors.push(`Invalid appId format "${m.appId}". Must match reverse-domain pattern (e.g. "com.example.app").`);
  }

  if (!m.appName || typeof m.appName !== 'string') {
    errors.push('Missing required field: "appName" must be a non-empty string.');
  } else if (m.appName.length < 1 || m.appName.length > 50) {
    errors.push(`Invalid appName length (${m.appName.length}). Must be between 1 and 50 characters.`);
  }

  if (!m.version || typeof m.version !== 'string') {
    errors.push('Missing required field: "version" must be a non-empty string.');
  } else if (!SEMVER_REGEX.test(m.version)) {
    errors.push(`Invalid version format "${m.version}". Must be semantic versioning (e.g. "1.0.0").`);
  }

  if (m.versionCode === undefined || m.versionCode === null) {
    errors.push('Missing required field: "versionCode".');
  } else if (typeof m.versionCode !== 'number' || !Number.isInteger(m.versionCode) || m.versionCode < 1) {
    errors.push(`Invalid versionCode "${m.versionCode}". Must be a positive integer (>= 1).`);
  }

  if (!m.entryPage || typeof m.entryPage !== 'string') {
    errors.push('Missing required field: "entryPage" must be a non-empty string.');
  }

  // Window styling validation
  if (m.window !== undefined) {
    if (typeof m.window !== 'object' || m.window === null || Array.isArray(m.window)) {
      errors.push('Field "window" must be an object.');
    } else {
      const w = m.window;
      if (w.backgroundColor !== undefined && !HEX_COLOR_REGEX.test(w.backgroundColor)) {
        errors.push(`Invalid window.backgroundColor "${w.backgroundColor}". Must be a 6-digit hex color (e.g. #F8F8F8).`);
      }
      if (w.navigationBarBackgroundColor !== undefined && !HEX_COLOR_REGEX.test(w.navigationBarBackgroundColor)) {
        errors.push(`Invalid window.navigationBarBackgroundColor "${w.navigationBarBackgroundColor}". Must be a 6-digit hex color (e.g. #FFFFFF).`);
      }
      if (w.navigationBarTextStyle && !['black', 'white'].includes(w.navigationBarTextStyle)) {
        errors.push(`Invalid window.navigationBarTextStyle "${w.navigationBarTextStyle}". Must be "black" or "white".`);
      }
      if (w.orientation && !['portrait', 'landscape', 'auto'].includes(w.orientation)) {
        errors.push(`Invalid window.orientation "${w.orientation}". Must be "portrait", "landscape", or "auto".`);
      }
    }
  }

  // Permissions validation
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      errors.push('Field "permissions" must be an array of capability strings.');
    } else {
      const seen = new Set<string>();
      for (const perm of m.permissions) {
        if (typeof perm !== 'string' || !VALID_PERMISSIONS.has(perm as GoatPermission)) {
          errors.push(`Unknown permission capability "${perm}". Valid options: ${Array.from(VALID_PERMISSIONS).join(', ')}.`);
        }
        if (seen.has(perm)) {
          warnings.push(`Duplicate permission declaration "${perm}".`);
        }
        seen.add(perm);
      }
    }
  }

  // Subpackages validation
  if (m.subpackages !== undefined) {
    if (!Array.isArray(m.subpackages)) {
      errors.push('Field "subpackages" must be an array.');
    } else {
      const roots = new Set<string>();
      m.subpackages.forEach((sub: any, idx: number) => {
        if (!sub || typeof sub !== 'object') {
          errors.push(`Subpackage at index ${idx} must be an object.`);
          return;
        }
        if (!sub.root || typeof sub.root !== 'string') {
          errors.push(`Subpackage at index ${idx} is missing required "root" directory path.`);
        } else {
          const normalizedRoot = sub.root.replace(/^\/+|\/+$/g, '');
          if (roots.has(normalizedRoot)) {
            errors.push(`Duplicate subpackage root path "${sub.root}".`);
          }
          roots.add(normalizedRoot);
        }

        if (!sub.pages || !Array.isArray(sub.pages)) {
          errors.push(`Subpackage "${sub.root || idx}" must declare a "pages" array.`);
        } else if (sub.pages.length === 0) {
          errors.push(`Subpackage "${sub.root || idx}" "pages" array cannot be empty.`);
        }
      });
    }
  }

  // Bridge settings validation
  if (m.bridge !== undefined) {
    if (typeof m.bridge !== 'object' || m.bridge === null) {
      errors.push('Field "bridge" must be an object.');
    } else {
      if (m.bridge.timeout !== undefined) {
        if (typeof m.bridge.timeout !== 'number' || m.bridge.timeout < 500 || m.bridge.timeout > 60000) {
          errors.push(`Invalid bridge.timeout "${m.bridge.timeout}". Must be a number between 500 and 60000 ms.`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a GoatConfig object
 */
export function validateGoatConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      isValid: false,
      errors: ['GoatConfig must be a non-null object.'],
      warnings: [],
    };
  }

  const c = config as Record<string, any>;
  const required = ['name', 'version', 'appId', 'entryPage', 'target', 'compiler'];

  for (const req of required) {
    if (!c[req] || typeof c[req] !== 'string') {
      errors.push(`Missing required goat.config.json field: "${req}".`);
    }
  }

  if (c.target && !['dual-thread', 'single-thread'].includes(c.target)) {
    errors.push(`Invalid target "${c.target}". Must be "dual-thread" or "single-thread".`);
  }

  if (c.compiler && c.compiler !== 'taro') {
    errors.push(`Invalid compiler "${c.compiler}". Must be "taro".`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
