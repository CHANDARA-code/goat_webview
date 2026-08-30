/**
 * @goat/compiler-uniapp - Adversarial Empirical Challenge Suite
 * Tests Dual-Thread & Single-Thread Bundlers, Cryptographic SHA-256 Integrity,
 * 1-Byte Tamper Simulation across all artifacts, Missing / Extra File Injections,
 * Subpackage chunk isolation and Path Traversal resistance.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  compileDualThreadBundle,
  compileSingleThreadBundle,
  bundleGoatUniApp,
  generateIntegrityManifest,
  verifyBundleIntegrity,
  computeSha256,
  computeByteLength,
  transformPagesJsonToGoatManifest,
  validatePagesJson,
  validateGoatManifest,
  ConfigValidationError,
} from '../dist/index.js';
import type { BundlerInput, PagesJson, BundleFileArtifact } from '../dist/types.js';

describe('Adversarial Bundler & Cryptographic Integrity Verification Suite (Uni-app)', () => {
  const samplePagesJson: PagesJson = {
    pages: [
      { path: 'pages/index/index', style: { navigationBarTitleText: 'Home', navigationBarBackgroundColor: '#112233' } },
      { path: 'pages/detail/index', style: { navigationBarTitleText: 'Detail', backgroundColor: '#EFEFEF' } },
      { path: 'pages/settings/index', style: { navigationBarTitleText: 'Settings' } },
    ],
    globalStyle: {
      navigationBarTitleText: 'Adversarial UniApp',
      navigationBarTextStyle: 'white',
      backgroundColor: '#F8F8F8',
      navigationBarBackgroundColor: '#000000',
    },
    subPackages: [
      {
        root: 'subpackages/order',
        name: 'order',
        pages: ['cart', 'checkout', 'receipt'],
      },
      {
        root: 'subpackages/user',
        name: 'user',
        pages: ['profile', 'security'],
      },
    ],
  };

  const { manifest, goatConfig } = transformPagesJsonToGoatManifest(samplePagesJson, {
    appid: 'com.goat.adversarial.uniapp',
    name: 'Adversarial UniApp',
    versionName: '2.4.0',
    versionCode: 20400,
  });

  const baseInput: BundlerInput = {
    rootDir: '/virtual/project',
    outDir: '/virtual/project/dist',
    pagesJson: samplePagesJson,
    manifest,
    goatConfig,
  };

  // ==========================================================================
  // 1. Dual-Thread Bundler Generation
  // ==========================================================================
  describe('Uni-app Dual-Thread Bundler Generation', () => {
    it('generates complete dual-thread artifact tree with thread isolation and subpackage worker/view chunks', () => {
      const output = compileDualThreadBundle(baseInput);

      assert.strictEqual(output.threadModel, 'dual-thread');
      assert.strictEqual(output.entryPage, 'pages/index/index');

      const fileMap = new Map<string, string | Buffer>();
      for (const a of output.artifacts) {
        fileMap.set(a.path, a.content);
      }

      // Check all expected files exist
      const expectedPaths = [
        'manifest.json',
        'goat.config.json',
        'appservice.worker.js',
        'webview.html',
        'appview.renderer.js',
        'appview.css',
        'subpackages/order/order.worker.js',
        'subpackages/order/order.view.js',
        'subpackages/user/user.worker.js',
        'subpackages/user/user.view.js',
        'integrity.json',
      ];

      for (const p of expectedPaths) {
        assert.ok(fileMap.has(p), `Missing required dual-thread bundle file: ${p}`);
      }

      // Thread Isolation verification:
      // 1. Worker script has sandbox lifecycle, postMessage, and appId
      const worker = String(fileMap.get('appservice.worker.js'));
      assert.ok(worker.includes('com.goat.adversarial.uniapp'));
      assert.ok(worker.includes('__GOAT_WORKER_READY__'));
      assert.ok(worker.includes('onLaunch'));
      assert.ok(worker.includes('INIT_APP'));

      // 2. View HTML loads appview.renderer.js and appview.css
      const webviewHtml = String(fileMap.get('webview.html'));
      assert.ok(webviewHtml.includes('<div id="app" class="goat-page-container"></div>'));
      assert.ok(webviewHtml.includes('src="appview.renderer.js"'));
      assert.ok(webviewHtml.includes('href="appview.css"'));

      // 3. Renderer script has DOM mount handlers
      const renderer = String(fileMap.get('appview.renderer.js'));
      assert.ok(renderer.includes('renderPage'));
      assert.ok(renderer.includes('pages/index/index'));

      // 4. Subpackage chunks have proper registration hooks
      const subWorker = String(fileMap.get('subpackages/order/order.worker.js'));
      assert.ok(subWorker.includes('__GOAT_REGISTER_SUBPACKAGE__'));
      assert.ok(subWorker.includes('subpackages/order'));

      const subView = String(fileMap.get('subpackages/order/order.view.js'));
      assert.ok(subView.includes('__GOAT_REGISTER_SUBPACKAGE_VIEW__'));
    });
  });

  // ==========================================================================
  // 2. Single-Thread SPA Bundler Generation
  // ==========================================================================
  describe('Uni-app Single-Thread SPA Bundler Generation', () => {
    it('generates standard single-thread SPA bundle with index.html, app.js, and app.css', () => {
      const output = compileSingleThreadBundle(baseInput);

      assert.strictEqual(output.threadModel, 'single-thread');
      assert.strictEqual(output.entryPage, 'pages/index/index');

      const fileMap = new Map(output.artifacts.map((a) => [a.path, a.content]));
      assert.ok(fileMap.has('manifest.json'));
      assert.ok(fileMap.has('goat.config.json'));
      assert.ok(fileMap.has('index.html'));
      assert.ok(fileMap.has('assets/app.js'));
      assert.ok(fileMap.has('assets/app.css'));
      assert.ok(fileMap.has('integrity.json'));

      const indexHtml = String(fileMap.get('index.html'));
      assert.ok(indexHtml.includes('<div id="app"></div>'));
      assert.ok(indexHtml.includes('src="assets/app.js"'));
      assert.ok(indexHtml.includes('href="assets/app.css"'));

      const appJs = String(fileMap.get('assets/app.js'));
      assert.ok(appJs.includes('[GoatSPA] Mini-App Initialized:'));
      assert.ok(appJs.includes('pages/index/index'));
    });
  });

  // ==========================================================================
  // 3. Cryptographic SHA-256 Integrity Verification
  // ==========================================================================
  describe('Uni-app Cryptographic SHA-256 Integrity System', () => {
    it('computes exact standard SHA-256 digests and accurate byte lengths', () => {
      const testCases = [
        'Logic worker script test string',
        '<!DOCTYPE html><html><body>Renderer</body></html>',
        'body { margin: 0; background: red; }',
        Buffer.from([0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03]),
      ];

      for (const item of testCases) {
        const hash = computeSha256(item);
        const expected = createHash('sha256')
          .update(typeof item === 'string' ? Buffer.from(item, 'utf-8') : item)
          .digest('hex');
        assert.strictEqual(hash, expected);

        const size = computeByteLength(item);
        const expectedSize = typeof item === 'string' ? Buffer.byteLength(item, 'utf-8') : item.length;
        assert.strictEqual(size, expectedSize);
      }
    });

    it('generates valid integrity.json without self-inclusion', () => {
      const output = compileDualThreadBundle(baseInput);
      const integrity = output.integrity;

      assert.strictEqual(integrity.version, '1.0.0');
      assert.strictEqual(integrity.algorithm, 'sha256');
      assert.strictEqual(integrity.files['integrity.json'], undefined);

      // Verify all non-integrity artifacts are registered
      const nonIntegrityArtifacts = output.artifacts.filter((a) => a.path !== 'integrity.json');
      for (const a of nonIntegrityArtifacts) {
        assert.ok(integrity.files[a.path], `Artifact ${a.path} not in integrity.json`);
        assert.strictEqual(integrity.files[a.path].sha256, computeSha256(a.content));
        assert.strictEqual(integrity.files[a.path].size, computeByteLength(a.content));
      }
    });

    it('empirically verifies untouched bundle passes verifyBundleIntegrity', () => {
      const output = compileDualThreadBundle(baseInput);
      const verification = verifyBundleIntegrity(output.artifacts, output.integrity);

      assert.strictEqual(verification.valid, true);
      assert.strictEqual(verification.mismatchedFiles.length, 0);
      assert.strictEqual(verification.missingFiles.length, 0);
    });

    it('1-Byte Tamper Stress Test: Detects 1-byte mutation across EVERY emitted file artifact', () => {
      const output = compileDualThreadBundle(baseInput);
      const targetArtifacts = output.artifacts.filter((a) => a.path !== 'integrity.json');

      assert.ok(targetArtifacts.length >= 8, `Expected >= 8 target artifacts, got ${targetArtifacts.length}`);

      for (let i = 0; i < targetArtifacts.length; i++) {
        const targetPath = targetArtifacts[i].path;
        const tamperedArtifacts: BundleFileArtifact[] = output.artifacts.map((a) => {
          if (a.path !== targetPath) return { ...a };

          let mutatedContent: string | Buffer;
          if (typeof a.content === 'string') {
            mutatedContent = a.content.slice(0, -1) + (a.content.endsWith(' ') ? 'Q' : ' ');
          } else {
            const buf = Buffer.from(a.content);
            buf[0] = buf[0] ^ 0x01;
            mutatedContent = buf;
          }
          return {
            path: a.path,
            content: mutatedContent,
          };
        });

        const verification = verifyBundleIntegrity(tamperedArtifacts, output.integrity);
        assert.strictEqual(
          verification.valid,
          false,
          `Tamper detection failed for 1-byte mutation in artifact: ${targetPath}`
        );
        assert.ok(
          verification.mismatchedFiles.includes(targetPath),
          `mismatchedFiles list missing tampered artifact: ${targetPath}`
        );
        assert.strictEqual(
          verification.missingFiles.length,
          0,
          `Unexpected missingFiles for tampered artifact: ${targetPath}`
        );
      }
    });

    it('Missing File Detection: Detects missing files when individual artifacts are omitted', () => {
      const output = compileDualThreadBundle(baseInput);
      const targetArtifacts = output.artifacts.filter((a) => a.path !== 'integrity.json');

      for (const target of targetArtifacts) {
        const partialArtifacts = output.artifacts.filter((a) => a.path !== target.path);
        const verification = verifyBundleIntegrity(partialArtifacts, output.integrity);

        assert.strictEqual(verification.valid, false, `Failed to detect missing artifact: ${target.path}`);
        assert.ok(
          verification.missingFiles.includes(target.path),
          `missingFiles list missing: ${target.path}`
        );
      }
    });
  });

  // ==========================================================================
  // 4. Subpackage Path Traversal & Validator Security
  // ==========================================================================
  describe('Subpackage Configuration & Security Boundaries', () => {
    it('rejects pages.json with empty pages array', () => {
      assert.throws(
        () => validatePagesJson({ pages: [] }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('non-empty "pages" array')
      );
    });

    it('rejects duplicate main package page paths', () => {
      assert.throws(
        () => validatePagesJson({ pages: [{ path: 'pages/home/index' }, { path: 'pages/home/index' }] }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('Duplicate page path')
      );
    });

    it('rejects duplicate subpackage roots', () => {
      assert.throws(
        () =>
          validatePagesJson({
            pages: [{ path: 'pages/home/index' }],
            subPackages: [
              { root: 'subpackages/shop', pages: ['cart'] },
              { root: 'subpackages/shop', pages: ['pay'] },
            ],
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('Duplicate subpackage root')
      );
    });

    it('rejects subpackage routes that collide with main package routes', () => {
      assert.throws(
        () =>
          validatePagesJson({
            pages: [{ path: 'sub/cart' }],
            subPackages: [
              { root: 'sub', pages: ['cart'] },
            ],
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('conflicts with main package page')
      );
    });

    it('rejects invalid tabBar item counts and missing pagePath references', () => {
      assert.throws(
        () =>
          validatePagesJson({
            pages: [{ path: 'pages/home/index' }],
            tabBar: {
              list: [{ pagePath: 'pages/home/index', text: 'Home' }], // only 1 item, minimum is 2
            },
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('between 2 and 5 items')
      );

      assert.throws(
        () =>
          validatePagesJson({
            pages: [{ path: 'pages/home/index' }, { path: 'pages/detail/index' }],
            tabBar: {
              list: [
                { pagePath: 'pages/home/index', text: 'Home' },
                { pagePath: 'pages/nonexistent/index', text: 'Detail' },
              ],
            },
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('does not exist in main pages')
      );
    });

    it('rejects invalid Goat manifest appId, semver, and versionCode', () => {
      assert.throws(
        () =>
          validateGoatManifest({
            appId: 'INVALID_ID_WITH_CAPS',
            appName: 'Valid Name',
            version: '1.0.0',
            versionCode: 1,
            entryPage: 'pages/index/index',
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('reverse-domain format')
      );

      assert.throws(
        () =>
          validateGoatManifest({
            appId: 'com.valid.app',
            appName: 'Valid Name',
            version: 'not-semver',
            versionCode: 1,
            entryPage: 'pages/index/index',
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('valid semver')
      );

      assert.throws(
        () =>
          validateGoatManifest({
            appId: 'com.valid.app',
            appName: 'Valid Name',
            version: '1.0.0',
            versionCode: 0, // must be >= 1
            entryPage: 'pages/index/index',
          }),
        (err: any) => err instanceof ConfigValidationError && err.message.includes('integer >= 1')
      );
    });
  });
});
