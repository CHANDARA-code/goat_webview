/**
 * @goat/compiler-uniapp Config Transformer
 * Transforms Uni-app pages.json & manifest.json into standard Goat WebView manifests and route tables.
 */
import type {
  GoatConfigJson,
  GoatManifest,
  GoatPermission,
  GoatSubpackageManifest,
  GoatWindowConfig,
  PageStyleConfig,
  PagesJson,
  SubPackageConfig,
  ThreadModel,
  UniAppManifestJson,
} from '../types.js';
import { validateGoatManifest, validatePagesJson } from './validator.js';

export interface RouteEntry {
  path: string;
  fullPath: string;
  isEntry: boolean;
  isTab: boolean;
  isSubpackage: boolean;
  subpackageRoot?: string;
  style?: PageStyleConfig;
}

export interface TransformOptions {
  appId?: string;
  appName?: string;
  version?: string;
  versionCode?: number;
  threadModel?: ThreadModel;
  bridgeTimeout?: number;
  mockMode?: boolean;
}

export interface TransformedConfigResult {
  manifest: GoatManifest;
  goatConfig: GoatConfigJson;
  routes: RouteEntry[];
  entryPage: string;
}

export function transformPagesJsonToGoatManifest(
  pagesJson: PagesJson,
  uniManifest?: UniAppManifestJson,
  options: TransformOptions = {}
): TransformedConfigResult {
  // Validate input pages.json
  validatePagesJson(pagesJson);

  // Normalize App metadata
  const rawAppId =
    options.appId ||
    uniManifest?.appid ||
    uniManifest?.['mp-weixin']?.appid ||
    'com.goat.uniapp';

  // Ensure reverse-domain format
  const appId = /^[a-z0-9]+(\.[a-z0-9]+)+$/.test(rawAppId.toLowerCase())
    ? rawAppId.toLowerCase()
    : `com.goat.${rawAppId.toLowerCase().replace(/[^a-z0-9]/g, '') || 'miniapp'}`;

  const appName =
    options.appName ||
    uniManifest?.name ||
    'UniApp Application';

  const rawVersion = options.version || uniManifest?.versionName || '1.0.0';
  const version = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(rawVersion) ? rawVersion : '1.0.0';

  let versionCode = options.versionCode;
  if (!versionCode && uniManifest?.versionCode) {
    versionCode = typeof uniManifest.versionCode === 'number'
      ? uniManifest.versionCode
      : parseInt(String(uniManifest.versionCode), 10);
  }
  if (!versionCode || isNaN(versionCode) || versionCode < 1) {
    versionCode = 1;
  }

  // Entry page is the first page in pages
  const firstPage = pagesJson.pages[0];
  const entryPage = firstPage.path.replace(/^\//, '');

  // Map global window configuration
  const globalStyle = pagesJson.globalStyle || {};
  const windowConfig: GoatWindowConfig = {};

  if (globalStyle.navigationBarTitleText) {
    windowConfig.title = globalStyle.navigationBarTitleText;
  }
  if (globalStyle.backgroundColor) {
    windowConfig.backgroundColor = globalStyle.backgroundColor;
  }
  if (globalStyle.navigationBarTextStyle) {
    windowConfig.navigationBarTextStyle = globalStyle.navigationBarTextStyle;
  }
  if (globalStyle.navigationBarBackgroundColor) {
    windowConfig.navigationBarBackgroundColor = globalStyle.navigationBarBackgroundColor;
  }
  if (globalStyle.pageOrientation) {
    windowConfig.orientation = globalStyle.pageOrientation;
  }
  if (typeof globalStyle.enablePullDownRefresh === 'boolean') {
    windowConfig.enablePullDownRefresh = globalStyle.enablePullDownRefresh;
  }

  // Map subpackages
  const subPackagesList = (pagesJson.subPackages || pagesJson.subpackages || []) as SubPackageConfig[];
  const goatSubpackages: GoatSubpackageManifest[] = [];
  const routes: RouteEntry[] = [];
  const pageStyles: Record<string, PageStyleConfig> = {};
  const mainPages: string[] = [];

  const tabPaths = new Set(
    (pagesJson.tabBar?.list || []).map((t) => t.pagePath.replace(/^\//, ''))
  );

  // Process main package pages
  for (let i = 0; i < pagesJson.pages.length; i++) {
    const p = pagesJson.pages[i];
    const normalized = p.path.replace(/^\//, '');
    mainPages.push(normalized);
    if (p.style) {
      pageStyles[normalized] = p.style;
    }
    routes.push({
      path: normalized,
      fullPath: normalized,
      isEntry: i === 0,
      isTab: tabPaths.has(normalized),
      isSubpackage: false,
      style: p.style,
    });
  }

  // Process subpackages
  for (const sub of subPackagesList) {
    const root = sub.root.replace(/^\//, '').replace(/\/$/, '');
    const pagesInSub: string[] = [];

    for (const sp of sub.pages) {
      const pagePath = typeof sp === 'string' ? sp.replace(/^\//, '') : sp.path.replace(/^\//, '');
      const fullSubPath = `${root}/${pagePath}`;
      pagesInSub.push(pagePath);

      const style = typeof sp === 'object' ? sp.style : undefined;
      if (style) {
        pageStyles[fullSubPath] = style;
      }

      routes.push({
        path: pagePath,
        fullPath: fullSubPath,
        isEntry: false,
        isTab: false,
        isSubpackage: true,
        subpackageRoot: root,
        style,
      });
    }

    const subManifest: GoatSubpackageManifest = {
      name: sub.name || root.split('/').pop() || root,
      root,
      pages: pagesInSub,
    };

    // Check preload rules for this subpackage
    if (pagesJson.preloadRule) {
      for (const [_, rule] of Object.entries(pagesJson.preloadRule)) {
        if (rule.packages?.includes(root) || rule.packages?.includes(subManifest.name || '')) {
          if (rule.network) {
            subManifest.preloadRule = { network: rule.network };
          }
        }
      }
    }

    goatSubpackages.push(subManifest);
  }

  // Extract permissions
  const declaredPermissions = new Set<GoatPermission>();
  // Include standard defaults
  declaredPermissions.add('STORAGE');
  declaredPermissions.add('CLIPBOARD');
  declaredPermissions.add('HAPTICS');

  if (uniManifest?.['mp-weixin']?.permission) {
    const permMap = uniManifest['mp-weixin'].permission;
    if (permMap['scope.userLocation']) declaredPermissions.add('LOCATION');
    if (permMap['scope.camera']) declaredPermissions.add('CAMERA');
    if (permMap['scope.record']) declaredPermissions.add('RECORD_AUDIO');
  }

  const manifest: GoatManifest = {
    appId,
    appName,
    version,
    versionCode,
    entryPage,
    ...(Object.keys(windowConfig).length > 0 ? { window: windowConfig } : {}),
    permissions: Array.from(declaredPermissions),
    ...(goatSubpackages.length > 0 ? { subpackages: goatSubpackages } : {}),
    bridge: {
      timeout: options.bridgeTimeout || 10000,
      mockMode: options.mockMode ?? false,
    },
  };

  validateGoatManifest(manifest);

  const goatConfig: GoatConfigJson = {
    appId,
    appName,
    version,
    versionCode,
    entryPage,
    pages: mainPages,
    window: windowConfig,
    pageStyles,
    ...(pagesJson.tabBar ? { tabBar: pagesJson.tabBar } : {}),
    ...(goatSubpackages.length > 0 ? { subpackages: goatSubpackages } : {}),
    ...(pagesJson.preloadRule ? { preloadRule: pagesJson.preloadRule } : {}),
    ...(pagesJson.easycom ? { easycom: pagesJson.easycom } : {}),
    targetThreadModel: options.threadModel || 'dual-thread',
  };

  return {
    manifest,
    goatConfig,
    routes,
    entryPage,
  };
}

export * from './parser.js';
export * from './validator.js';
