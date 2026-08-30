/**
 * @goat/compiler-taro - Bundler Subsystem Test Suite
 * Tests Dual-Thread Mini-App and Single-Thread SPA bundle generation,
 * subpackage chunk splitting, and output file structure.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileDualThreadBundle, compileSingleThreadBundle } from '../src/bundler/index.js';
import { TaroAppConfig, GoatTaroPluginOptions } from '../src/types.js';

describe('Bundler Subsystem', () => {
  const sampleAppConfig: TaroAppConfig = {
    pages: ['pages/index/index', 'pages/detail/index'],
    window: {
      navigationBarTitleText: 'Sample Taro App',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8F8F8',
    },
    subPackages: [
      {
        root: 'shop',
        name: 'ShopSubpackage',
        pages: ['pages/cart/index', 'pages/checkout/index'],
      },
    ],
  };

  const samplePluginOptions: GoatTaroPluginOptions = {
    appId: 'com.example.sampletaro',
    appName: 'Sample Taro App',
    version: '1.0.0',
    versionCode: 10000,
    allowedDomains: ['api.sample.com'],
  };

  describe('compileDualThreadBundle', () => {
    it('generates standard dual-thread mini-app bundle structure', async () => {
      const result = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
        packageJson: { name: 'sample-taro', version: '1.0.0' },
        appLogicCode: 'console.log("Custom app logic");',
        appStyleCode: 'body { color: #333; }',
        pageCodes: {
          'pages/index/index': {
            js: 'console.log("Index page mounted");',
            css: '.index-view { padding: 16px; }',
          },
        },
        subpackageCodes: {
          shop: {
            workerJs: 'console.log("Shop worker chunk");',
            viewHtml: '<div>Shop View</div>',
            css: '.shop-header { color: red; }',
          },
        },
      });

      assert.ok(result);
      assert.strictEqual(result.manifest.appId, 'com.example.sampletaro');
      assert.strictEqual(result.goatConfig.target, 'dual-thread');

      // Verify required dual-thread files
      const fileKeys = Object.keys(result.files);
      assert.ok(fileKeys.includes('manifest.json'));
      assert.ok(fileKeys.includes('goat.config.json'));
      assert.ok(fileKeys.includes('integrity.json'));
      assert.ok(fileKeys.includes('webview.html'));
      assert.ok(fileKeys.includes('app.css'));
      assert.ok(fileKeys.includes('appservice.worker.js'));
      assert.ok(fileKeys.includes('pages/pages/index/index.js'));
      assert.ok(fileKeys.includes('pages/pages/index/index.css'));
      assert.ok(fileKeys.includes('subpackages/shop/manifest.json'));
      assert.ok(fileKeys.includes('subpackages/shop/worker.js'));
      assert.ok(fileKeys.includes('subpackages/shop/view.html'));
      assert.ok(fileKeys.includes('subpackages/shop/view.css'));

      // Check contents
      const workerJs = result.files['appservice.worker.js'] as string;
      assert.ok(workerJs.includes('com.example.sampletaro'));
      assert.ok(workerJs.includes('Custom app logic'));

      const webviewHtml = result.files['webview.html'] as string;
      assert.ok(webviewHtml.includes('Sample Taro App'));
      assert.ok(webviewHtml.includes('__GOAT_VIEW_READY__'));

      const subManifest = JSON.parse(result.files['subpackages/shop/manifest.json'] as string);
      assert.strictEqual(subManifest.root, 'shop');
      assert.strictEqual(subManifest.pages.length, 2);
    });
  });

  describe('compileSingleThreadBundle', () => {
    it('generates standard single-thread SPA web bundle structure', async () => {
      const result = await compileSingleThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
        packageJson: { name: 'sample-taro', version: '1.0.0' },
        bundleJsCode: 'console.log("SPA Bundle Loaded");',
        bundleCssCode: '#root { background: #fff; }',
        subpackageChunks: {
          shop: {
            js: 'console.log("Shop SPA Chunk");',
            css: '.shop-style { margin: 8px; }',
          },
        },
      });

      assert.ok(result);
      assert.strictEqual(result.manifest.appId, 'com.example.sampletaro');
      assert.strictEqual(result.goatConfig.target, 'single-thread');

      const fileKeys = Object.keys(result.files);
      assert.ok(fileKeys.includes('manifest.json'));
      assert.ok(fileKeys.includes('goat.config.json'));
      assert.ok(fileKeys.includes('integrity.json'));
      assert.ok(fileKeys.includes('index.html'));

      // Check hashed asset files
      const mainJs = fileKeys.find((k) => k.startsWith('assets/main.') && k.endsWith('.js'));
      const mainCss = fileKeys.find((k) => k.startsWith('assets/main.') && k.endsWith('.css'));
      assert.ok(mainJs, 'assets/main.[hash].js must exist');
      assert.ok(mainCss, 'assets/main.[hash].css must exist');

      const shopJsChunk = fileKeys.find((k) => k.startsWith('subpackages/shop/chunk.') && k.endsWith('.js'));
      assert.ok(shopJsChunk, 'subpackages/shop/chunk.[hash].js must exist');

      // Check index.html references the main script
      const indexHtml = result.files['index.html'] as string;
      assert.ok(indexHtml.includes(mainJs!));
      assert.ok(indexHtml.includes(mainCss!));
    });
  });
});
