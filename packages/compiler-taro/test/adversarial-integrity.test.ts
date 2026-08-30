/**
 * @goat/compiler-taro - Adversarial Empirical Challenge Suite
 * Tests Dual-Thread / Single-Thread Bundlers, SHA-256 Integrity Verification,
 * 1-Byte Tamper Resistance, Missing / Extra File Injections, and Subpackage Isolation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  compileDualThreadBundle,
  compileSingleThreadBundle,
  computeSha256,
  generateIntegrityManifest,
  verifyIntegrity,
  validateManifest,
  validateGoatConfig,
  parseRouteTable,
} from '../src/index.js';
import type { TaroAppConfig, GoatTaroPluginOptions } from '../src/types.js';

describe('Adversarial Bundler & Cryptographic Integrity Verification Suite (Taro)', () => {
  const sampleAppConfig: TaroAppConfig = {
    pages: ['pages/index/index', 'pages/detail/index', 'pages/settings/index'],
    window: {
      navigationBarTitleText: 'Adversarial Test App',
      navigationBarBackgroundColor: '#1A1A1A',
      navigationBarTextStyle: 'white',
      backgroundColor: '#FAFAFA',
    },
    subPackages: [
      {
        root: 'subpackages/shop',
        name: 'ShopPackage',
        pages: ['pages/cart/index', 'pages/checkout/index'],
        independent: true,
      },
      {
        root: 'subpackages/media',
        name: 'MediaPackage',
        pages: ['pages/video/index'],
        independent: false,
      },
    ],
  };

  const samplePluginOptions: GoatTaroPluginOptions = {
    appId: 'com.goat.adversarial.taro',
    appName: 'Adversarial Test App',
    version: '3.5.1',
    versionCode: 30501,
    allowedDomains: ['api.adversarial.com'],
  };

  // ==========================================================================
  // 1. Dual-Thread Bundler Verification
  // ==========================================================================
  describe('Dual-Thread Bundler Generation', () => {
    it('generates complete dual-thread artifact tree with thread isolation and subpackages', async () => {
      const result = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
        packageJson: { name: 'adversarial-taro', version: '3.5.1' },
        appLogicCode: 'console.log("[LOGIC_SANDBOX] Booted");',
        appStyleCode: 'body { margin: 0; background-color: #FAFAFA; }',
        pageCodes: {
          'pages/index/index': { js: 'console.log("INDEX_JS");', css: '.idx { color: red; }' },
          'pages/detail/index': { js: 'console.log("DETAIL_JS");', css: '.dtl { color: blue; }' },
          'pages/settings/index': { js: 'console.log("SETTINGS_JS");', css: '.set { color: green; }' },
        },
        subpackageCodes: {
          'subpackages/shop': {
            workerJs: 'console.log("[SHOP_WORKER] Loaded");',
            viewHtml: '<div class="shop-root">Shop View</div>',
            css: '.shop-root { padding: 12px; }',
          },
          'subpackages/media': {
            workerJs: 'console.log("[MEDIA_WORKER] Loaded");',
            viewHtml: '<div class="media-root">Media View</div>',
            css: '.media-root { padding: 8px; }',
          },
        },
        extraAssets: {
          'assets/icon.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          'locales/en.json': JSON.stringify({ title: 'Welcome' }),
        },
      });

      assert.ok(result);
      assert.strictEqual(result.manifest.appId, 'com.goat.adversarial.taro');
      assert.strictEqual(result.goatConfig.target, 'dual-thread');
      assert.strictEqual(result.manifest.entryPage, 'pages/index/index');

      const files = result.files;
      const fileKeys = Object.keys(files);

      // Verify core files exist
      const expectedCoreFiles = [
        'manifest.json',
        'goat.config.json',
        'integrity.json',
        'webview.html',
        'app.css',
        'appservice.worker.js',
        'pages/pages/index/index.js',
        'pages/pages/index/index.css',
        'pages/pages/detail/index.js',
        'pages/pages/detail/index.css',
        'pages/pages/settings/index.js',
        'pages/pages/settings/index.css',
        'subpackages/subpackages/shop/manifest.json',
        'subpackages/subpackages/shop/worker.js',
        'subpackages/subpackages/shop/view.html',
        'subpackages/subpackages/shop/view.css',
        'subpackages/subpackages/media/manifest.json',
        'subpackages/subpackages/media/worker.js',
        'subpackages/subpackages/media/view.html',
        'subpackages/subpackages/media/view.css',
        'assets/icon.png',
        'locales/en.json',
      ];

      for (const expectedFile of expectedCoreFiles) {
        assert.ok(fileKeys.includes(expectedFile), `Missing dual-thread bundle file: ${expectedFile}`);
      }

      // Thread isolation checks:
      // 1. Worker script contains logic and message handlers, does not reference window.document
      const worker = files['appservice.worker.js'] as string;
      assert.ok(worker.includes('com.goat.adversarial.taro'));
      assert.ok(worker.includes('[LOGIC_SANDBOX] Booted'));
      assert.ok(worker.includes('INIT_APPSERVICE'));
      assert.ok(worker.includes('UI_EVENT'));

      // 2. View HTML contains DOM mount hook and stylesheet link
      const webviewHtml = files['webview.html'] as string;
      assert.ok(webviewHtml.includes('<div id="goat-root"></div>'));
      assert.ok(webviewHtml.includes('__GOAT_VIEW_READY__'));
      assert.ok(webviewHtml.includes('app.css'));

      // 3. Subpackage manifest correctness
      const shopManifest = JSON.parse(files['subpackages/subpackages/shop/manifest.json'] as string);
      assert.strictEqual(shopManifest.root, 'subpackages/shop');
      assert.strictEqual(shopManifest.independent, true);
      assert.strictEqual(shopManifest.pages.length, 2);
    });
  });

  // ==========================================================================
  // 2. Single-Thread SPA Bundler Verification
  // ==========================================================================
  describe('Single-Thread SPA Bundler Generation', () => {
    it('generates single-thread SPA bundle with deterministic MD5 content hashes and dynamic chunks', async () => {
      const customJs = 'console.log("[SPA_ENTRY] Booting SPA"); const a = 42;';
      const customCss = '#root { width: 100vw; height: 100vh; background: #FFF; }';
      const shopJs = 'export const shopModule = { name: "ShopModule", version: "1.0.0" };';
      const shopCss = '.shop-spa { background: #EEE; }';

      const result = await compileSingleThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
        packageJson: { name: 'adversarial-taro-spa', version: '3.5.1' },
        bundleJsCode: customJs,
        bundleCssCode: customCss,
        subpackageChunks: {
          'subpackages/shop': { js: shopJs, css: shopCss },
        },
      });

      assert.ok(result);
      assert.strictEqual(result.goatConfig.target, 'single-thread');
      assert.strictEqual(result.manifest.appId, 'com.goat.adversarial.taro');

      const fileKeys = Object.keys(result.files);
      assert.ok(fileKeys.includes('manifest.json'));
      assert.ok(fileKeys.includes('goat.config.json'));
      assert.ok(fileKeys.includes('integrity.json'));
      assert.ok(fileKeys.includes('index.html'));

      // Verify content-hashed asset files
      const expectedJsHash = createHash('md5').update(customJs).digest('hex').substring(0, 8);
      const expectedCssHash = createHash('md5').update(customCss).digest('hex').substring(0, 8);
      const expectedShopJsHash = createHash('md5').update(shopJs).digest('hex').substring(0, 8);
      const expectedShopCssHash = createHash('md5').update(shopCss).digest('hex').substring(0, 8);

      const mainJsPath = `assets/main.${expectedJsHash}.js`;
      const mainCssPath = `assets/main.${expectedCssHash}.css`;
      const shopJsPath = `subpackages/subpackages/shop/chunk.${expectedShopJsHash}.js`;
      const shopCssPath = `subpackages/subpackages/shop/chunk.${expectedShopCssHash}.css`;

      assert.ok(fileKeys.includes(mainJsPath), `Expected main JS file ${mainJsPath}`);
      assert.ok(fileKeys.includes(mainCssPath), `Expected main CSS file ${mainCssPath}`);
      assert.ok(fileKeys.includes(shopJsPath), `Expected subpackage JS chunk ${shopJsPath}`);
      assert.ok(fileKeys.includes(shopCssPath), `Expected subpackage CSS chunk ${shopCssPath}`);

      // Verify index.html references the exact computed hashed paths
      const indexHtml = result.files['index.html'] as string;
      assert.ok(indexHtml.includes(mainJsPath), 'index.html missing mainJs reference');
      assert.ok(indexHtml.includes(mainCssPath), 'index.html missing mainCss reference');
    });
  });

  // ==========================================================================
  // 3. Cryptographic SHA-256 Integrity & Tamper Simulation
  // ==========================================================================
  describe('Cryptographic SHA-256 Integrity Verification System', () => {
    it('computes exact standard SHA-256 digests matching Node crypto engine', () => {
      const testCases = [
        'Mini-App Logic Layer Content',
        '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>Hello</body></html>',
        '/* CSS stylesheet with unicode 🚀 ✨ */ .btn { padding: 10px; }',
        Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0xAA, 0xFF]),
        '',
      ];

      for (const item of testCases) {
        const hash = computeSha256(item);
        const rawBuf = typeof item === 'string' ? Buffer.from(item, 'utf-8') : item;
        const expected = `sha256-${createHash('sha256').update(rawBuf).digest('hex')}`;
        assert.strictEqual(hash, expected);
      }
    });

    it('generates valid integrity.json without circular reference to integrity.json', async () => {
      const bundle = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
      });

      const integrity = bundle.integrity;
      assert.strictEqual(integrity.appId, 'com.goat.adversarial.taro');
      assert.strictEqual(integrity.target, 'dual-thread');
      assert.strictEqual(typeof integrity.timestamp, 'number');

      // Verify integrity.json is NOT in integrity.files
      assert.strictEqual(integrity.files['integrity.json'], undefined);

      // Verify all other emitted files ARE in integrity.files
      for (const filePath of Object.keys(bundle.files)) {
        if (filePath === 'integrity.json') continue;
        assert.ok(integrity.files[filePath], `File ${filePath} missing in integrity.json`);
        assert.ok(integrity.metadata?.fileSizes[filePath] !== undefined);
      }
    });

    it('empirically verifies untouched bundle passes verifyIntegrity with zero errors', async () => {
      const bundle = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
      });

      const check = verifyIntegrity(bundle.files, bundle.integrity);
      assert.strictEqual(check.valid, true);
      assert.strictEqual(check.missingFiles.length, 0);
      assert.strictEqual(check.mismatchedFiles.length, 0);
    });

    it('1-Byte Tamper Stress Test: Detects 1-byte mutation across EVERY emitted file', async () => {
      const bundle = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
        extraAssets: {
          'binary.bin': Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
        },
      });

      const targetFiles = Object.keys(bundle.files).filter((k) => k !== 'integrity.json');
      assert.ok(targetFiles.length >= 8, `Expected >= 8 target files, found ${targetFiles.length}`);

      for (const targetFile of targetFiles) {
        const tamperedFiles = { ...bundle.files };
        const originalContent = bundle.files[targetFile];

        if (typeof originalContent === 'string') {
          // Mutate a single character: toggle last character or append a space
          const mutated = originalContent.slice(0, -1) + (originalContent.endsWith(' ') ? 'X' : ' ');
          tamperedFiles[targetFile] = mutated;
        } else {
          // Mutate single byte in Buffer
          const mutatedBuf = Buffer.from(originalContent);
          mutatedBuf[0] = mutatedBuf[0] ^ 0x01;
          tamperedFiles[targetFile] = mutatedBuf;
        }

        const verification = verifyIntegrity(tamperedFiles, bundle.integrity);
        assert.strictEqual(
          verification.valid,
          false,
          `Tamper detection failed for 1-byte mutation in: ${targetFile}`
        );
        assert.ok(
          verification.mismatchedFiles.includes(targetFile),
          `mismatchedFiles list missing tampered file: ${targetFile}`
        );
        assert.strictEqual(
          verification.missingFiles.length,
          0,
          `Unexpected missingFiles for tampered file: ${targetFile}`
        );
      }
    });

    it('Missing File Detection: Detects missing files when individual files are removed', async () => {
      const bundle = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
      });

      const targetFiles = Object.keys(bundle.files).filter((k) => k !== 'integrity.json');

      for (const fileToRemove of targetFiles) {
        const partialFiles = { ...bundle.files };
        delete partialFiles[fileToRemove];

        const verification = verifyIntegrity(partialFiles, bundle.integrity);
        assert.strictEqual(verification.valid, false, `Failed to detect missing file: ${fileToRemove}`);
        assert.ok(
          verification.missingFiles.includes(fileToRemove),
          `missingFiles list does not contain: ${fileToRemove}`
        );
      }
    });

    it('Adversarial Challenge: Probing extra / unexpected injected file detection', async () => {
      const bundle = await compileDualThreadBundle({
        appConfig: sampleAppConfig,
        pluginOptions: samplePluginOptions,
      });

      // Inject unauthorized backdoor file
      const injectedFiles = {
        ...bundle.files,
        'unauthorized_payload.js': 'console.log("BACKDOOR");',
      };

      const verification = verifyIntegrity(injectedFiles, bundle.integrity);

      // verifyIntegrity checks that all manifest entries exist and match hashes
      assert.strictEqual(verification.missingFiles.length, 0);
      assert.strictEqual(verification.mismatchedFiles.length, 0);
      // NOTE FOR AUDIT REPORT: verifyIntegrity currently validates all expected files in manifest.
      // Any external scanner must check total file counts if extra file injection is disallowed.
    });
  });

  // ==========================================================================
  // 4. Subpackage Path Traversal & Schema Validation
  // ==========================================================================
  describe('Subpackage Path Traversal Resistance & Schema Validation', () => {
    it('parses route tables and normalizes path separators safely', () => {
      const appConfigWithSlashes: TaroAppConfig = {
        pages: ['/pages/index/index/', 'pages/detail/index'],
        subPackages: [
          {
            root: '/subpackages/shop/',
            pages: ['/pages/cart/index/', 'pages/checkout/index'],
          },
        ],
      };

      const routeTable = parseRouteTable(appConfigWithSlashes);
      assert.strictEqual(routeTable.routes[0].path, 'pages/index/index');
      assert.strictEqual(routeTable.routes[0].fullPath, 'pages/index/index');

      const subRoute = routeTable.routes.find((r) => r.isSubpackage);
      assert.ok(subRoute);
      assert.strictEqual(subRoute.subpackageRoot, 'subpackages/shop');
      assert.strictEqual(subRoute.path, 'pages/cart/index');
      assert.strictEqual(subRoute.fullPath, 'subpackages/shop/pages/cart/index');
    });

    it('rejects invalid manifest properties (invalid appId, empty appName, bad semver)', () => {
      const invalidAppId = validateManifest({
        appId: 'INVALID_UPPERCASE_APPID!',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      assert.strictEqual(invalidAppId.isValid, false);
      assert.ok(invalidAppId.errors.some((e) => e.includes('Invalid appId format')));

      const invalidVersion = validateManifest({
        appId: 'com.valid.app',
        appName: 'Test',
        version: 'v1.0-beta-bad',
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      assert.strictEqual(invalidVersion.isValid, false);
      assert.ok(invalidVersion.errors.some((e) => e.includes('Invalid version format')));

      const invalidVersionCode = validateManifest({
        appId: 'com.valid.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: -5,
        entryPage: 'pages/index/index',
      });
      assert.strictEqual(invalidVersionCode.isValid, false);
      assert.ok(invalidVersionCode.errors.some((e) => e.includes('Invalid versionCode')));
    });

    it('rejects duplicate subpackage roots', () => {
      const duplicateSubpackages = validateManifest({
        appId: 'com.valid.app',
        appName: 'Test App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        subpackages: [
          { root: 'shop', pages: ['p1'] },
          { root: 'shop', pages: ['p2'] },
        ],
      });
      assert.strictEqual(duplicateSubpackages.isValid, false);
      assert.ok(duplicateSubpackages.errors.some((e) => e.includes('Duplicate subpackage root')));
    });
  });
});
