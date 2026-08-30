/**
 * schemaValidator.ts — JSON Schema validation service for manifest.json and goat.config.json
 */

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export const MANIFEST_PERMISSIONS_ENUM = [
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
];

export const MANIFEST_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Goat Mini-App Manifest Configuration',
  description: 'Global application routing, window appearance, and permissions manifest',
  type: 'object',
  properties: {
    appId: { type: 'string' },
    appName: { type: 'string' },
    version: { type: 'string' },
    versionCode: { type: 'number' },
    entryPage: { type: 'string' },
    pages: { type: 'array', items: { type: 'string' } },
    permissions: {},
    window: { type: 'object' },
    tabBar: { type: 'object' },
    subpackages: { type: 'array' },
  },
};

export const GOAT_CONFIG_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Goat Project Tooling & Compiler Configuration',
  description: 'Project metadata, compilation options, and simulator settings',
  type: 'object',
  properties: {
    name: { type: 'string' },
    appId: { type: 'string' },
    appid: { type: 'string' },
    projectname: { type: 'string' },
    framework: { type: 'string' },
    dev: { type: 'object' },
    compilerOptions: { type: 'object' },
    setting: { type: 'object' },
  },
};

/**
 * Validates manifest.json content against the official specification.
 */
export function validateManifestJson(manifestContent: string | object): ValidationResult {
  const errors: ValidationError[] = [];
  let manifest: any;

  if (typeof manifestContent === 'string') {
    try {
      manifest = JSON.parse(manifestContent);
    } catch (e: any) {
      return {
        valid: false,
        errors: [{ path: '', message: `Invalid JSON syntax: ${e.message}`, keyword: 'syntax' }],
      };
    }
  } else {
    manifest = manifestContent;
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Manifest must be an object', keyword: 'type' }],
    };
  }

  // Check pages / entryPage
  const hasPages = Array.isArray(manifest.pages) && manifest.pages.length > 0;
  const hasEntryPage = typeof manifest.entryPage === 'string' && manifest.entryPage.length > 0;

  if (!hasPages && !hasEntryPage) {
    errors.push({ path: 'pages', message: 'Missing required property "pages" or "entryPage"', keyword: 'required' });
  }

  // If appId is provided, validate format
  if (manifest.appId && typeof manifest.appId === 'string') {
    const appIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    if (!appIdRegex.test(manifest.appId)) {
      errors.push({
        path: 'appId',
        message: 'appId must follow valid reverse-domain format (e.g. com.example.wallet)',
        keyword: 'pattern',
      });
    }
  }

  // If version is provided, validate format
  if (manifest.version && typeof manifest.version === 'string') {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(manifest.version)) {
      errors.push({
        path: 'version',
        message: 'version must follow semantic versioning format (e.g. 1.2.0)',
        keyword: 'pattern',
      });
    }
  }

  // If versionCode is provided, validate integer >= 1
  if (manifest.versionCode !== undefined) {
    if (!Number.isInteger(manifest.versionCode) || manifest.versionCode < 1) {
      errors.push({
        path: 'versionCode',
        message: 'versionCode must be an integer >= 1',
        keyword: 'minimum',
      });
    }
  }

  // Validate permissions if present
  if (manifest.permissions) {
    if (Array.isArray(manifest.permissions)) {
      const seen = new Set<string>();
      for (let i = 0; i < manifest.permissions.length; i++) {
        const perm = manifest.permissions[i];
        if (typeof perm !== 'string' || !MANIFEST_PERMISSIONS_ENUM.includes(perm)) {
          errors.push({
            path: `permissions[${i}]`,
            message: `Invalid permission '${perm}'. Must be one of: ${MANIFEST_PERMISSIONS_ENUM.join(', ')}`,
            keyword: 'enum',
          });
        }
        if (seen.has(perm)) {
          errors.push({
            path: `permissions[${i}]`,
            message: `Duplicate permission '${perm}'`,
            keyword: 'uniqueItems',
          });
        }
        seen.add(perm);
      }
    } else if (typeof manifest.permissions !== 'object') {
      errors.push({ path: 'permissions', message: 'permissions must be an array or object dictionary', keyword: 'type' });
    }
  }

  // Validate tabBar if present
  if (manifest.tabBar) {
    if (typeof manifest.tabBar !== 'object') {
      errors.push({ path: 'tabBar', message: 'tabBar must be an object', keyword: 'type' });
    } else if (!Array.isArray(manifest.tabBar.list)) {
      errors.push({ path: 'tabBar.list', message: 'tabBar.list must be an array', keyword: 'type' });
    } else if (manifest.tabBar.list.length < 2 || manifest.tabBar.list.length > 5) {
      errors.push({
        path: 'tabBar.list',
        message: 'tabBar.list must contain between 2 and 5 tab items',
        keyword: 'items',
      });
    }
  }

  // Validate subpackages if present
  const subpackages = manifest.subpackages || manifest.subPackages;
  if (subpackages) {
    if (!Array.isArray(subpackages)) {
      errors.push({ path: 'subpackages', message: 'subpackages must be an array', keyword: 'type' });
    } else {
      subpackages.forEach((sub: any, idx: number) => {
        if (!sub.root || typeof sub.root !== 'string') {
          errors.push({ path: `subpackages[${idx}].root`, message: 'subpackage root must be a non-empty string', keyword: 'required' });
        }
        if (!sub.pages || !Array.isArray(sub.pages)) {
          errors.push({ path: `subpackages[${idx}].pages`, message: 'subpackage pages must be an array', keyword: 'required' });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates goat.config.json content against specification.
 */
export function validateGoatConfigJson(configContent: string | object): ValidationResult {
  const errors: ValidationError[] = [];
  let config: any;

  if (typeof configContent === 'string') {
    try {
      config = JSON.parse(configContent);
    } catch (e: any) {
      return {
        valid: false,
        errors: [{ path: '', message: `Invalid JSON syntax: ${e.message}`, keyword: 'syntax' }],
      };
    }
  } else {
    config = configContent;
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'goat.config.json must be an object', keyword: 'type' }],
    };
  }

  const hasName = (typeof config.name === 'string' && config.name.length > 0) ||
                  (typeof config.projectname === 'string' && config.projectname.length > 0);
  if (!hasName) {
    errors.push({ path: 'name', message: 'Missing required property "name" or "projectname"', keyword: 'required' });
  }

  const hasAppId = (typeof config.appid === 'string' && config.appid.length > 0) ||
                   (typeof config.appId === 'string' && config.appId.length > 0);
  if (!hasAppId && !config.dev) {
    errors.push({ path: 'appid', message: 'Missing required property "appid" or "appId"', keyword: 'required' });
  }

  if (config.framework && !['vanilla', 'react', 'vue'].includes(config.framework)) {
    errors.push({ path: 'framework', message: 'Property "framework" must be one of: "vanilla", "react", "vue"', keyword: 'enum' });
  }

  if (config.dev) {
    if (config.dev.port !== undefined && (typeof config.dev.port !== 'number' || config.dev.port < 1 || config.dev.port > 65535)) {
      errors.push({ path: 'dev.port', message: 'dev.port must be an integer between 1 and 65535', keyword: 'range' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Register Monaco JSON diagnostics with manifest.json and goat.config.json schemas
 */
export function setupMonacoJsonSchemas(monaco: any) {
  if (!monaco || !monaco.languages || !monaco.languages.json) return;

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [
      {
        uri: 'https://goat.dev/schemas/manifest.json',
        fileMatch: ['*manifest.json'],
        schema: MANIFEST_JSON_SCHEMA,
      },
      {
        uri: 'https://goat.dev/schemas/goat.config.json',
        fileMatch: ['*goat.config.json'],
        schema: GOAT_CONFIG_JSON_SCHEMA,
      },
    ],
  });
}
