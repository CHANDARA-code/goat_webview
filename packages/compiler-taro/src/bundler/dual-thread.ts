/**
 * @goat/compiler-taro - Dual-Thread Mini-App Bundler
 * Compiles Taro source projects into standard dual-thread Goat Mini-App packages:
 * appservice.worker.js (logic layer) + webview.html (DOM renderer) + subpackages.
 */

import { transformTaroConfig } from '../config/index.js';
import { generateIntegrityManifest } from './integrity.js';
import { DualThreadBundleOptions, BundleResult } from '../types.js';

/**
 * Generates webview.html renderer template
 */
function generateWebviewHtml(title: string, appCssPath = 'app.css'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${title}</title>
  <link rel="stylesheet" href="${appCssPath}">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      background-color: var(--goat-page-bg, #F8F8F8);
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
    }
    #app, #goat-root {
      width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div id="goat-root"></div>
  <script type="module">
    // Goat WebView Dual-Thread DOM Renderer Hook
    window.__GOAT_VIEW_READY__ = true;
    if (window.__GOAT_DOM_RENDERER__) {
      window.__GOAT_DOM_RENDERER__.mount(document.getElementById('goat-root'));
    }
  </script>
</body>
</html>`;
}

/**
 * Generates appservice.worker.js logic worker script
 */
function generateWorkerScript(
  appId: string,
  entryPage: string,
  routesJson: string,
  customLogic = ''
): string {
  return `/**
 * Goat Mini-App Dual-Thread AppService Logic Sandbox
 * AppId: ${appId}
 * EntryPage: ${entryPage}
 */

(function(global) {
  'use strict';

  global.__GOAT_APP_ID__ = '${appId}';
  global.__GOAT_ENTRY_PAGE__ = '${entryPage}';
  global.__GOAT_ROUTES__ = ${routesJson};

  // 1. Initialize Worker Lifecycle & IPC Listener
  global.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'INIT_APPSERVICE') {
      if (typeof global.__onAppLaunch === 'function') {
        global.__onAppLaunch(msg.options || {});
      }
    } else if (msg.type === 'UI_EVENT') {
      if (typeof global.__handleUiEvent === 'function') {
        global.__handleUiEvent(msg.payload);
      }
    }
  });

  // 2. Load Mini-App Logic
  ${customLogic || `
  console.log('[GoatAppService] Logic worker initialized for ${appId}');
  `}

})(typeof self !== 'undefined' ? self : globalThis);
`;
}

/**
 * Compiles a full dual-thread Goat mini-app distribution bundle
 */
export async function compileDualThreadBundle(options: DualThreadBundleOptions): Promise<BundleResult> {
  const pluginOptions = {
    ...options.pluginOptions,
    target: 'dual-thread' as const,
  };

  // 1. Transform configuration
  const { manifest, goatConfig, routeTable, warnings } = transformTaroConfig(
    options.appConfig,
    pluginOptions,
    options.packageJson
  );

  const files: Record<string, string | Buffer> = {};

  // 2. Generate webview.html & app.css
  files['webview.html'] = generateWebviewHtml(manifest.appName, 'app.css');
  files['app.css'] = options.appStyleCode || '/* Goat Taro Global Styles */\n';

  // 3. Generate appservice.worker.js
  const routesJson = JSON.stringify(routeTable.routes);
  files['appservice.worker.js'] = generateWorkerScript(
    manifest.appId,
    manifest.entryPage,
    routesJson,
    options.appLogicCode
  );

  // 4. Generate Main Package Pages
  for (const route of routeTable.routes) {
    if (!route.isSubpackage) {
      const pageJsPath = `pages/${route.path}.js`;
      const pageCssPath = `pages/${route.path}.css`;
      const code = options.pageCodes?.[route.path] || {};

      files[pageJsPath] = code.js || `// Page: ${route.path}\nconsole.log('Mount page: ${route.path}');\n`;
      files[pageCssPath] = code.css || `/* Styles for ${route.path} */\n`;
    }
  }

  // 5. Generate Subpackages
  if (manifest.subpackages && manifest.subpackages.length > 0) {
    for (const sub of manifest.subpackages) {
      const subRoot = sub.root;
      const subCode = options.subpackageCodes?.[subRoot] || {};

      // Subpackage manifest
      files[`subpackages/${subRoot}/manifest.json`] = JSON.stringify(
        {
          name: sub.name || subRoot,
          root: subRoot,
          pages: sub.pages,
          independent: sub.independent ?? false,
        },
        null,
        2
      );

      // Subpackage worker
      files[`subpackages/${subRoot}/worker.js`] =
        subCode.workerJs ||
        `// Subpackage Worker Chunk: ${subRoot}\nconsole.log('[GoatSubpackage] Loaded chunk: ${subRoot}');\n`;

      // Subpackage view
      files[`subpackages/${subRoot}/view.html`] =
        subCode.viewHtml || generateWebviewHtml(`${manifest.appName} - ${subRoot}`, `view.css`);

      if (subCode.css) {
        files[`subpackages/${subRoot}/view.css`] = subCode.css;
      }
    }
  }

  // 6. Include extra custom assets if provided
  if (options.extraAssets) {
    for (const [assetPath, assetContent] of Object.entries(options.extraAssets)) {
      files[assetPath] = assetContent;
    }
  }

  // 7. Serialize manifest.json & goat.config.json
  files['manifest.json'] = JSON.stringify(manifest, null, 2);
  files['goat.config.json'] = JSON.stringify(goatConfig, null, 2);

  // 8. Generate SHA-256 integrity manifest
  const integrity = generateIntegrityManifest(files, {
    appId: manifest.appId,
    version: manifest.version,
    target: 'dual-thread',
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
