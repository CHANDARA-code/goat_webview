/**
 * @goat/compiler-uniapp Configuration Schema Validators
 * Strict validation matching Goat manifest.schema.json and Uni-app pages.json specification.
 */
import type { GoatManifest, PagesJson, SubPackageConfig, TabBarConfig } from '../types.js';

const APP_ID_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)+$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class ConfigValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(`[GoatConfigError] ${message}${field ? ` (at '${field}')` : ''}`);
    this.name = 'ConfigValidationError';
  }
}

export function validatePagesJson(pagesJson: unknown): asserts pagesJson is PagesJson {
  if (!pagesJson || typeof pagesJson !== 'object') {
    throw new ConfigValidationError('pages.json must be a JSON object');
  }

  const p = pagesJson as Record<string, unknown>;

  // Validate pages array
  if (!Array.isArray(p.pages) || p.pages.length === 0) {
    throw new ConfigValidationError('pages.json must declare a non-empty "pages" array', 'pages');
  }

  const mainPagePaths = new Set<string>();

  for (let i = 0; i < p.pages.length; i++) {
    const page = p.pages[i];
    if (!page || typeof page !== 'object' || typeof page.path !== 'string' || !page.path.trim()) {
      throw new ConfigValidationError(`Page at index ${i} must have a valid non-empty 'path' string`, `pages[${i}].path`);
    }

    const normalizedPath = page.path.replace(/^\//, '');
    if (mainPagePaths.has(normalizedPath)) {
      throw new ConfigValidationError(`Duplicate page path '${normalizedPath}' in pages array`, `pages[${i}].path`);
    }
    mainPagePaths.add(normalizedPath);

    // Validate page style if present
    if (page.style && typeof page.style === 'object') {
      validatePageStyle(page.style as Record<string, unknown>, `pages[${i}].style`);
    }
  }

  // Validate globalStyle
  if (p.globalStyle && typeof p.globalStyle === 'object') {
    validatePageStyle(p.globalStyle as Record<string, unknown>, 'globalStyle');
  }

  // Validate tabBar
  if (p.tabBar && typeof p.tabBar === 'object') {
    validateTabBar(p.tabBar as TabBarConfig, mainPagePaths);
  }

  // Validate subPackages / subpackages
  const subPackages = (p.subPackages || p.subpackages) as SubPackageConfig[] | undefined;
  if (subPackages) {
    if (!Array.isArray(subPackages)) {
      throw new ConfigValidationError('"subPackages" must be an array of objects', 'subPackages');
    }

    const roots = new Set<string>();
    for (let i = 0; i < subPackages.length; i++) {
      const sub = subPackages[i];
      if (!sub || typeof sub !== 'object' || typeof sub.root !== 'string' || !sub.root.trim()) {
        throw new ConfigValidationError(`SubPackage at index ${i} must have a valid non-empty 'root' string`, `subPackages[${i}].root`);
      }

      const normalizedRoot = sub.root.replace(/^\//, '').replace(/\/$/, '');
      if (roots.has(normalizedRoot)) {
        throw new ConfigValidationError(`Duplicate subpackage root '${normalizedRoot}'`, `subPackages[${i}].root`);
      }
      roots.add(normalizedRoot);

      if (!Array.isArray(sub.pages) || sub.pages.length === 0) {
        throw new ConfigValidationError(`SubPackage '${normalizedRoot}' must declare a non-empty 'pages' array`, `subPackages[${i}].pages`);
      }

      for (let j = 0; j < sub.pages.length; j++) {
        const subPage = sub.pages[j];
        const subPagePath = typeof subPage === 'string' ? subPage : subPage?.path;
        if (!subPagePath || typeof subPagePath !== 'string' || !subPagePath.trim()) {
          throw new ConfigValidationError(`SubPackage '${normalizedRoot}' page at index ${j} must have a valid 'path'`, `subPackages[${i}].pages[${j}]`);
        }
        const fullSubPath = `${normalizedRoot}/${subPagePath.replace(/^\//, '')}`;
        if (mainPagePaths.has(fullSubPath)) {
          throw new ConfigValidationError(`Subpackage route '${fullSubPath}' conflicts with main package page`, `subPackages[${i}].pages[${j}]`);
        }
      }
    }
  }
}

function validatePageStyle(style: Record<string, unknown>, context: string): void {
  if (style.navigationBarBackgroundColor && typeof style.navigationBarBackgroundColor === 'string') {
    if (!HEX_COLOR_REGEX.test(style.navigationBarBackgroundColor)) {
      throw new ConfigValidationError(`navigationBarBackgroundColor must be a valid hex color (e.g. #FFFFFF), got '${style.navigationBarBackgroundColor}'`, `${context}.navigationBarBackgroundColor`);
    }
  }

  if (style.backgroundColor && typeof style.backgroundColor === 'string') {
    if (!HEX_COLOR_REGEX.test(style.backgroundColor)) {
      throw new ConfigValidationError(`backgroundColor must be a valid hex color (e.g. #F8F8F8), got '${style.backgroundColor}'`, `${context}.backgroundColor`);
    }
  }

  if (style.navigationBarTextStyle && typeof style.navigationBarTextStyle === 'string') {
    if (style.navigationBarTextStyle !== 'black' && style.navigationBarTextStyle !== 'white') {
      throw new ConfigValidationError(`navigationBarTextStyle must be 'black' or 'white', got '${style.navigationBarTextStyle}'`, `${context}.navigationBarTextStyle`);
    }
  }

  if (style.navigationStyle && typeof style.navigationStyle === 'string') {
    if (style.navigationStyle !== 'default' && style.navigationStyle !== 'custom') {
      throw new ConfigValidationError(`navigationStyle must be 'default' or 'custom', got '${style.navigationStyle}'`, `${context}.navigationStyle`);
    }
  }
}

function validateTabBar(tabBar: TabBarConfig, mainPages: Set<string>): void {
  if (!Array.isArray(tabBar.list)) {
    throw new ConfigValidationError('tabBar must contain a "list" array', 'tabBar.list');
  }

  if (tabBar.list.length < 2 || tabBar.list.length > 5) {
    throw new ConfigValidationError(`tabBar.list must contain between 2 and 5 items, found ${tabBar.list.length}`, 'tabBar.list');
  }

  if (tabBar.color && !HEX_COLOR_REGEX.test(tabBar.color)) {
    throw new ConfigValidationError(`tabBar.color must be a valid hex color, got '${tabBar.color}'`, 'tabBar.color');
  }

  if (tabBar.selectedColor && !HEX_COLOR_REGEX.test(tabBar.selectedColor)) {
    throw new ConfigValidationError(`tabBar.selectedColor must be a valid hex color, got '${tabBar.selectedColor}'`, 'tabBar.selectedColor');
  }

  for (let i = 0; i < tabBar.list.length; i++) {
    const item = tabBar.list[i];
    if (!item.pagePath || typeof item.pagePath !== 'string') {
      throw new ConfigValidationError(`tabBar.list[${i}] must have a valid 'pagePath'`, `tabBar.list[${i}].pagePath`);
    }
    const normalized = item.pagePath.replace(/^\//, '');
    if (!mainPages.has(normalized)) {
      throw new ConfigValidationError(`tabBar pagePath '${item.pagePath}' does not exist in main pages`, `tabBar.list[${i}].pagePath`);
    }
    if (!item.text || typeof item.text !== 'string') {
      throw new ConfigValidationError(`tabBar.list[${i}] must have a valid 'text' string`, `tabBar.list[${i}].text`);
    }
  }
}

export function validateGoatManifest(manifest: unknown): asserts manifest is GoatManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new ConfigValidationError('manifest must be a valid JSON object');
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.appId !== 'string' || !APP_ID_REGEX.test(m.appId)) {
    throw new ConfigValidationError(`appId '${m.appId}' must match reverse-domain format (e.g. com.example.app)`, 'appId');
  }

  if (typeof m.appName !== 'string' || m.appName.length < 1 || m.appName.length > 50) {
    throw new ConfigValidationError('appName must be a string between 1 and 50 characters', 'appName');
  }

  if (typeof m.version !== 'string' || !SEMVER_REGEX.test(m.version)) {
    throw new ConfigValidationError(`version '${m.version}' must be valid semver (e.g. 1.0.0)`, 'version');
  }

  if (typeof m.versionCode !== 'number' || !Number.isInteger(m.versionCode) || m.versionCode < 1) {
    throw new ConfigValidationError('versionCode must be an integer >= 1', 'versionCode');
  }

  if (typeof m.entryPage !== 'string' || !m.entryPage.trim()) {
    throw new ConfigValidationError('entryPage must be a non-empty string', 'entryPage');
  }

  if (m.window && typeof m.window === 'object') {
    const win = m.window as Record<string, unknown>;
    if (win.backgroundColor && typeof win.backgroundColor === 'string' && !HEX_COLOR_REGEX.test(win.backgroundColor)) {
      throw new ConfigValidationError(`window.backgroundColor must be valid hex, got '${win.backgroundColor}'`, 'window.backgroundColor');
    }
    if (win.navigationBarBackgroundColor && typeof win.navigationBarBackgroundColor === 'string' && !HEX_COLOR_REGEX.test(win.navigationBarBackgroundColor)) {
      throw new ConfigValidationError(`window.navigationBarBackgroundColor must be valid hex, got '${win.navigationBarBackgroundColor}'`, 'window.navigationBarBackgroundColor');
    }
  }

  if (m.permissions) {
    if (!Array.isArray(m.permissions)) {
      throw new ConfigValidationError('permissions must be an array of strings', 'permissions');
    }
    const validPerms = new Set([
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
    for (const p of m.permissions) {
      if (!validPerms.has(p)) {
        throw new ConfigValidationError(`Unknown permission '${p}' in manifest`, 'permissions');
      }
    }
  }
}
