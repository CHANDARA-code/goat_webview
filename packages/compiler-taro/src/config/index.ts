/**
 * @goat/compiler-taro - Config Transformer & Route Parser
 * Ingests Taro app.config.ts, page.config.ts, package.json, and compiler options
 * to produce schema-compliant manifest.json, goat.config.json, and route tables.
 */

import {
  TaroAppConfig,
  TaroPageConfig,
  GoatManifest,
  GoatConfig,
  GoatTaroPluginOptions,
  GoatPermission,
  VirtualRouteTable,
  VirtualRoute,
  GoatSubpackage,
} from '../types.js';
import { validateManifest, validateGoatConfig, VALID_PERMISSIONS } from './validator.js';

export { validateManifest, validateGoatConfig } from './validator.js';

/**
 * Normalizes 3-digit hex colors (#FFF) to 6-digit hex (#FFFFFF)
 */
export function normalizeHexColor(color?: string, fallback = '#FFFFFF'): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

/**
 * Derives a valid reverse-domain appId (e.g. com.example.app)
 */
export function deriveAppId(preferredId?: string, pkgName?: string): string {
  if (preferredId && /^[a-z0-9]+(\.[a-z0-9]+)+$/.test(preferredId)) {
    return preferredId.toLowerCase();
  }
  if (pkgName) {
    const cleaned = pkgName
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[\/_]/g, '.')
      .replace(/[^a-z0-9.]/g, '');
    const parts = cleaned.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return parts.join('.');
    }
    if (parts.length === 1) {
      return `com.goat.${parts[0]}`;
    }
  }
  return 'com.goat.miniapp';
}

/**
 * Calculates a numerical versionCode from semver string or integer
 */
export function deriveVersionCode(preferredCode?: number, versionStr?: string): number {
  if (preferredCode && typeof preferredCode === 'number' && preferredCode >= 1) {
    return Math.floor(preferredCode);
  }
  if (versionStr) {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (match && match[1] && match[2] && match[3]) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      const patch = parseInt(match[3], 10);
      return major * 10000 + minor * 100 + patch || 1;
    }
  }
  return 1;
}

/**
 * Normalizes a route path (removes leading/trailing slashes)
 */
export function normalizePath(pathStr: string): string {
  return pathStr.replace(/^\/+|\/+$/g, '');
}

/**
 * Parses and builds the Virtual Route Table from Taro configuration
 */
export function parseRouteTable(
  appConfig: TaroAppConfig,
  pageConfigs: Record<string, TaroPageConfig> = {}
): VirtualRouteTable {
  const routes: VirtualRoute[] = [];
  const subpackageMap = new Map<string, VirtualRoute[]>();
  const tabBarRoutes: string[] = [];

  // 1. Entry Page
  const entryPage = normalizePath(appConfig.entryPagePath || appConfig.pages?.[0] || 'pages/index/index');

  // 2. Main package pages
  if (Array.isArray(appConfig.pages)) {
    for (const page of appConfig.pages) {
      const normPath = normalizePath(page);
      const route: VirtualRoute = {
        path: normPath,
        fullPath: normPath,
        isSubpackage: false,
        pageConfig: pageConfigs[normPath],
      };
      routes.push(route);
    }
  }

  // 3. Subpackages
  const subpackages = appConfig.subPackages || appConfig.subpackages || [];
  if (Array.isArray(subpackages)) {
    for (const sub of subpackages) {
      const normRoot = normalizePath(sub.root);
      const subRoutes: VirtualRoute[] = [];

      for (const page of sub.pages || []) {
        const normPage = normalizePath(page);
        const fullPath = `${normRoot}/${normPage}`;
        const route: VirtualRoute = {
          path: normPage,
          fullPath,
          isSubpackage: true,
          subpackageRoot: normRoot,
          subpackageName: sub.name || normRoot,
          pageConfig: pageConfigs[fullPath] || pageConfigs[normPage],
        };
        routes.push(route);
        subRoutes.push(route);
      }

      subpackageMap.set(normRoot, subRoutes);
    }
  }

  // 4. TabBar items
  if (appConfig.tabBar && Array.isArray(appConfig.tabBar.list)) {
    for (const item of appConfig.tabBar.list) {
      if (item.pagePath) {
        tabBarRoutes.push(normalizePath(item.pagePath));
      }
    }
  }

  return {
    entryPage,
    routes,
    tabBarRoutes,
    subpackageMap,
  };
}

/**
 * Extracts and maps Taro permission capabilities to GoatPermission
 */
export function extractPermissions(
  appConfig: TaroAppConfig,
  pluginOptions?: GoatTaroPluginOptions
): GoatPermission[] {
  const permSet = new Set<GoatPermission>();

  // From plugin options
  if (pluginOptions?.permissions && Array.isArray(pluginOptions.permissions)) {
    for (const p of pluginOptions.permissions) {
      if (VALID_PERMISSIONS.has(p)) {
        permSet.add(p);
      }
    }
  }

  // From appConfig.permissions
  if (Array.isArray(appConfig.permissions)) {
    for (const p of appConfig.permissions) {
      const upper = p.toUpperCase() as GoatPermission;
      if (VALID_PERMISSIONS.has(upper)) {
        permSet.add(upper);
      }
    }
  }

  // From appConfig.permission scope mapping (WeChat mini-program style)
  if (appConfig.permission && typeof appConfig.permission === 'object') {
    const keys = Object.keys(appConfig.permission);
    for (const k of keys) {
      if (k.includes('userLocation') || k.includes('Location')) {
        permSet.add('LOCATION');
      }
      if (k.includes('camera') || k.includes('Camera')) {
        permSet.add('CAMERA');
      }
      if (k.includes('record') || k.includes('Microphone') || k.includes('Audio')) {
        permSet.add('RECORD_AUDIO');
      }
      if (k.includes('bluetooth') || k.includes('Bluetooth')) {
        permSet.add('BLUETOOTH');
      }
      if (k.includes('writePhotosAlbum') || k.includes('Storage')) {
        permSet.add('STORAGE');
      }
    }
  }

  return Array.from(permSet);
}

/**
 * Ingests Taro configuration and transforms it into GoatManifest and GoatConfig
 */
export function transformTaroConfig(
  appConfig: TaroAppConfig,
  pluginOptions: GoatTaroPluginOptions = {},
  packageJson: { name?: string; version?: string } = {}
): {
  manifest: GoatManifest;
  goatConfig: GoatConfig;
  routeTable: VirtualRouteTable;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 1. Build route table
  const routeTable = parseRouteTable(appConfig);

  // 2. Derive manifest core identifiers
  const appId = deriveAppId(pluginOptions.appId, packageJson.name);
  const version = pluginOptions.version || packageJson.version || '1.0.0';
  const versionCode = deriveVersionCode(pluginOptions.versionCode, version);
  const appName =
    pluginOptions.appName ||
    appConfig.window?.navigationBarTitleText ||
    packageJson.name ||
    'Goat Taro MiniApp';

  const entryPage = routeTable.entryPage;

  // 3. Window configuration
  const windowCfg = appConfig.window || {};
  const isCustomNav = windowCfg.navigationStyle === 'custom';
  const windowStyle = {
    title: windowCfg.navigationBarTitleText || '',
    backgroundColor: normalizeHexColor(windowCfg.backgroundColor, '#F8F8F8'),
    navigationBarBackgroundColor: normalizeHexColor(windowCfg.navigationBarBackgroundColor, '#FFFFFF'),
    navigationBarTextStyle: (windowCfg.navigationBarTextStyle === 'black' || windowCfg.navigationBarTextStyle === 'white')
      ? windowCfg.navigationBarTextStyle
      : 'black',
    orientation: (['portrait', 'landscape', 'auto'].includes(windowCfg.pageOrientation || ''))
      ? windowCfg.pageOrientation
      : 'portrait',
    enablePullDownRefresh: Boolean(windowCfg.enablePullDownRefresh),
    transparentBackground: isCustomNav,
  };

  // 4. Permissions
  const permissions = extractPermissions(appConfig, pluginOptions);

  // 5. Subpackages
  const rawSubs = appConfig.subPackages || appConfig.subpackages || [];
  const subpackages: GoatSubpackage[] = [];
  const seenRoots = new Set<string>();

  for (const sub of rawSubs) {
    const root = normalizePath(sub.root);
    if (!root) {
      warnings.push('Encountered subpackage with empty root path; skipping.');
      continue;
    }
    if (seenRoots.has(root)) {
      warnings.push(`Duplicate subpackage root detected: "${root}".`);
      continue;
    }
    seenRoots.add(root);

    const pages = (sub.pages || []).map(normalizePath).filter(Boolean);
    subpackages.push({
      root,
      pages,
      name: sub.name || root,
      independent: Boolean(sub.independent),
    });
  }

  // 6. Preload rules
  let preloadRule: Record<string, { network?: 'all' | 'wifi'; packages?: string[] }> | undefined;
  if (appConfig.preloadRule && typeof appConfig.preloadRule === 'object') {
    preloadRule = {};
    for (const [route, rule] of Object.entries(appConfig.preloadRule)) {
      const normRoute = normalizePath(route);
      preloadRule[normRoute] = {
        network: rule.network === 'wifi' ? 'wifi' : 'all',
        packages: (rule.packages || []).map(normalizePath),
      };
    }
  }

  // 7. Assemble GoatManifest
  const manifest: GoatManifest = {
    appId,
    appName,
    version,
    versionCode,
    entryPage,
    window: windowStyle,
    permissions: permissions.length > 0 ? permissions : undefined,
    subpackages: subpackages.length > 0 ? subpackages : undefined,
    preloadRule: preloadRule && Object.keys(preloadRule).length > 0 ? preloadRule : undefined,
    bridge: {
      timeout: pluginOptions.bridgeTimeout || 15000,
      mockMode: false,
    },
    security: {
      allowedDomains: pluginOptions.allowedDomains || [],
      enableBytecode: pluginOptions.enableBytecode ?? false,
    },
  };

  // Validate manifest
  const manifestValidation = validateManifest(manifest);
  if (!manifestValidation.isValid) {
    throw new Error(`Goat manifest validation error:\n${manifestValidation.errors.join('\n')}`);
  }
  warnings.push(...manifestValidation.warnings);

  // 8. Assemble GoatConfig
  const target = pluginOptions.target || 'dual-thread';
  const goatConfig: GoatConfig = {
    name: appName,
    version,
    appId,
    entryPage,
    target,
    compiler: 'taro',
    framework: 'react',
  };

  const configValidation = validateGoatConfig(goatConfig);
  if (!configValidation.isValid) {
    throw new Error(`goat.config.json validation error:\n${configValidation.errors.join('\n')}`);
  }
  warnings.push(...configValidation.warnings);

  return {
    manifest,
    goatConfig,
    routeTable,
    warnings,
  };
}
