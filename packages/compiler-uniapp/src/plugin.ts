/**
 * @goat/compiler-uniapp Vite & Rollup Plugin
 * Standard build hooks for Vue 3 SFC mini-program compilation into Goat WebView.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePagesJson, parseUniAppManifest, transformPagesJsonToGoatManifest } from './config/index.js';
import { preprocessCode } from './preprocessor/index.js';
import { generateIntegrityManifest } from './bundler/integrity.js';
import { transformRpxInCss } from './runtime/rpx.js';
import type {
  BundleFileArtifact,
  GoatConfigJson,
  GoatManifest,
  GoatUniAppPluginOptions,
  PagesJson,
  UniAppManifestJson,
} from './types.js';

const VIRTUAL_PREFIX = '\0';
const VIRTUAL_ROUTES_ID = 'virtual:goat-routes';
const VIRTUAL_MANIFEST_ID = 'virtual:goat-manifest';
const VIRTUAL_BRIDGE_ID = 'virtual:goat-bridge';

export function goatUniAppPlugin(options: GoatUniAppPluginOptions = {}) {
  let rootDir = process.cwd();
  let pagesJson: PagesJson | null = null;
  let uniManifest: UniAppManifestJson | null = null;
  let goatManifest: GoatManifest | null = null;
  let goatConfig: GoatConfigJson | null = null;
  let routesList: Array<{ path: string; fullPath: string; isEntry: boolean; isTab: boolean; isSubpackage: boolean }> = [];
  let entryPagePath = 'pages/index/index';

  return {
    name: 'goat-compiler-uniapp',
    enforce: 'pre' as const,

    config(config: any) {
      return {
        define: {
          'process.env.UNI_PLATFORM': JSON.stringify(options.targetPlatform || 'goat'),
          'process.env.GOAT_THREAD_MODEL': JSON.stringify(options.threadModel || 'dual-thread'),
          ...config?.define,
        },
        resolve: {
          alias: {
            '@': rootDir,
            ...config?.resolve?.alias,
          },
        },
      };
    },

    configResolved(resolvedConfig: any) {
      rootDir = resolvedConfig?.root || process.cwd();

      // Resolve pages.json
      const pagesPath = options.pagesJsonPath
        ? resolve(rootDir, options.pagesJsonPath)
        : resolve(rootDir, 'pages.json');

      if (existsSync(pagesPath)) {
        try {
          const raw = readFileSync(pagesPath, 'utf8');
          // Run preprocessor on pages.json first
          const preprocessed = preprocessCode(raw, {
            targetPlatform: options.targetPlatform || 'GOAT',
            compatMode: options.compatMode ?? true,
          });
          pagesJson = parsePagesJson(preprocessed.code);
        } catch (err: any) {
          console.warn(`[goat-compiler-uniapp] Failed to parse pages.json at ${pagesPath}:`, err.message);
        }
      }

      // Resolve manifest.json if present
      const manifestPath = options.manifestJsonPath
        ? resolve(rootDir, options.manifestJsonPath)
        : resolve(rootDir, 'manifest.json');

      if (existsSync(manifestPath)) {
        try {
          const raw = readFileSync(manifestPath, 'utf8');
          uniManifest = parseUniAppManifest(raw);
        } catch {
          // Optional
        }
      }

      if (!pagesJson) {
        pagesJson = { pages: [{ path: 'pages/index/index' }] };
      }

      const transformed = transformPagesJsonToGoatManifest(pagesJson, uniManifest || undefined, {
        threadModel: options.threadModel || 'dual-thread',
      });
      goatManifest = transformed.manifest;
      goatConfig = transformed.goatConfig;
      routesList = transformed.routes;
      entryPagePath = transformed.entryPage;
    },

    resolveId(id: string) {
      if (id === VIRTUAL_ROUTES_ID) {
        return VIRTUAL_PREFIX + VIRTUAL_ROUTES_ID;
      }
      if (id === VIRTUAL_MANIFEST_ID) {
        return VIRTUAL_PREFIX + VIRTUAL_MANIFEST_ID;
      }
      if (id === VIRTUAL_BRIDGE_ID) {
        return VIRTUAL_PREFIX + VIRTUAL_BRIDGE_ID;
      }

      // Easycom resolution
      if (options.enableEasycom !== false && pagesJson?.easycom?.custom) {
        for (const [pattern, target] of Object.entries(pagesJson.easycom.custom)) {
          const regex = new RegExp(pattern);
          if (regex.test(id)) {
            const replaced = id.replace(regex, target).replace(/^@\//, `${rootDir}/`);
            return replaced;
          }
        }
      }

      return null;
    },

    load(id: string) {
      if (id === VIRTUAL_PREFIX + VIRTUAL_ROUTES_ID) {
        return `
export const routes = ${JSON.stringify(routesList, null, 2)};
export const entryPage = ${JSON.stringify(entryPagePath)};
export const pages = ${JSON.stringify(goatConfig?.pages || [])};
export const pageStyles = ${JSON.stringify(goatConfig?.pageStyles || {})};
export const tabBar = ${JSON.stringify(goatConfig?.tabBar || null)};
export const subpackages = ${JSON.stringify(goatConfig?.subpackages || [])};
export default routes;
`;
      }

      if (id === VIRTUAL_PREFIX + VIRTUAL_MANIFEST_ID) {
        return `
export const manifest = ${JSON.stringify(goatManifest, null, 2)};
export const goatConfig = ${JSON.stringify(goatConfig, null, 2)};
export default manifest;
`;
      }

      if (id === VIRTUAL_PREFIX + VIRTUAL_BRIDGE_ID) {
        return `
import { uni } from '@goat/compiler-uniapp/runtime';
export { uni };
export default uni;
`;
      }

      return null;
    },

    transform(code: string, id: string) {
      // Ignore node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      let transformedCode = code;
      let isModified = false;

      // Conditional preprocessor for source files (.vue, .ts, .js, .css, .scss, .json)
      if (/\.(vue|ts|js|jsx|tsx|css|scss|less|json)($|\?)/.test(id)) {
        const prepResult = preprocessCode(transformedCode, {
          targetPlatform: options.targetPlatform || 'GOAT',
          compatMode: options.compatMode ?? true,
        });
        if (prepResult.modified) {
          transformedCode = prepResult.code;
          isModified = true;
        }
      }

      // Responsive rpx transform for CSS and Vue styles
      if (/\.(css|scss|less|vue)($|\?)/.test(id) && transformedCode.includes('rpx')) {
        transformedCode = transformRpxInCss(transformedCode);
        isModified = true;
      }

      if (isModified) {
        return {
          code: transformedCode,
          map: null,
        };
      }

      return null;
    },

    generateBundle(outputOptions: any, bundle: Record<string, any>) {
      if (!goatManifest || !goatConfig) return;

      const artifacts: BundleFileArtifact[] = [];

      // Add manifest.json to output bundle
      const manifestStr = JSON.stringify(goatManifest, null, 2);
      (this as any)?.emitFile?.({
        type: 'asset',
        fileName: 'manifest.json',
        source: manifestStr,
      });
      artifacts.push({ path: 'manifest.json', content: manifestStr });

      // Add goat.config.json to output bundle
      const goatConfigStr = JSON.stringify(goatConfig, null, 2);
      (this as any)?.emitFile?.({
        type: 'asset',
        fileName: 'goat.config.json',
        source: goatConfigStr,
      });
      artifacts.push({ path: 'goat.config.json', content: goatConfigStr });

      // Collect all assets from the rollup bundle
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'asset') {
          artifacts.push({ path: fileName, content: item.source });
        } else if (item.type === 'chunk') {
          artifacts.push({ path: fileName, content: item.code });
        }
      }

      // Generate integrity manifest
      const integrity = generateIntegrityManifest(artifacts);
      const integrityStr = JSON.stringify(integrity, null, 2);

      (this as any)?.emitFile?.({
        type: 'asset',
        fileName: 'integrity.json',
        source: integrityStr,
      });
    },
  };
}
