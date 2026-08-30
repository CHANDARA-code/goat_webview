/**
 * @goat/compiler-taro - Single-Thread Web SPA Bundler
 * Compiles Taro source projects into single-thread SPA Web Bundles:
 * index.html + assets/main.[hash].js + assets/main.[hash].css + subpackage dynamic chunks.
 */

import { createHash } from 'node:crypto';
import { transformTaroConfig } from '../config/index.js';
import { generateIntegrityManifest } from './integrity.js';
import { SingleThreadBundleOptions, BundleResult } from '../types.js';

function computeContentHash(content: string | Buffer): string {
  const hash = createHash('md5');
  hash.update(typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
  return hash.digest('hex').substring(0, 8);
}

function generateIndexHtml(title: string, mainJsPath: string, mainCssPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${title}</title>
  <link rel="stylesheet" href="${mainCssPath}">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      background-color: var(--goat-bg, #F8F8F8);
      -webkit-tap-highlight-color: transparent;
    }
    #root, #app {
      width: 100%;
      min-height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${mainJsPath}"></script>
</body>
</html>`;
}

/**
 * Compiles a single-thread SPA Goat web bundle
 */
export async function compileSingleThreadBundle(options: SingleThreadBundleOptions): Promise<BundleResult> {
  const pluginOptions = {
    ...options.pluginOptions,
    target: 'single-thread' as const,
  };

  // 1. Transform configuration
  const { manifest, goatConfig, routeTable, warnings } = transformTaroConfig(
    options.appConfig,
    pluginOptions,
    options.packageJson
  );

  const files: Record<string, string | Buffer> = {};

  // 2. Prepare CSS & JS code with content hashing
  const cssContent = options.bundleCssCode || '/* Goat Single-Thread App CSS */\n#root { display: flex; flex-direction: column; }\n';
  const cssHash = computeContentHash(cssContent);
  const cssPath = `assets/main.${cssHash}.css`;
  files[cssPath] = cssContent;

  const jsContent =
    options.bundleJsCode ||
    `// Goat Single-Thread Application Entrypoint\nconsole.log('[GoatSPA] Booting app ${manifest.appId}');\n`;
  const jsHash = computeContentHash(jsContent);
  const jsPath = `assets/main.${jsHash}.js`;
  files[jsPath] = jsContent;

  // 3. Generate index.html
  files['index.html'] = generateIndexHtml(manifest.appName, jsPath, cssPath);

  // 4. Generate Subpackage Dynamic Chunks
  if (manifest.subpackages && manifest.subpackages.length > 0) {
    for (const sub of manifest.subpackages) {
      const subRoot = sub.root;
      const chunkData = options.subpackageChunks?.[subRoot] || {};

      const subJs = chunkData.js || `// Subpackage Chunk: ${subRoot}\nexport const chunkName = '${subRoot}';\n`;
      const subHash = computeContentHash(subJs);
      const subChunkPath = `subpackages/${subRoot}/chunk.${subHash}.js`;
      files[subChunkPath] = subJs;

      if (chunkData.css) {
        const subCssHash = computeContentHash(chunkData.css);
        files[`subpackages/${subRoot}/chunk.${subCssHash}.css`] = chunkData.css;
      }
    }
  }

  // 5. Extra Assets
  if (options.extraAssets) {
    for (const [assetPath, assetContent] of Object.entries(options.extraAssets)) {
      files[assetPath] = assetContent;
    }
  }

  // 6. Serialize manifest.json & goat.config.json
  files['manifest.json'] = JSON.stringify(manifest, null, 2);
  files['goat.config.json'] = JSON.stringify(goatConfig, null, 2);

  // 7. Generate SHA-256 integrity manifest
  const integrity = generateIntegrityManifest(files, {
    appId: manifest.appId,
    version: manifest.version,
    target: 'single-thread',
  });

  files['integrity.json'] = JSON.stringify(integrity, null, 2);

  return {
    manifest,
    goatConfig,
    integrity,
    files,
    routeTable,
    warnings,
  };
}
