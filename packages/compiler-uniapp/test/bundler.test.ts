import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bundleGoatUniApp, compileDualThreadBundle, compileSingleThreadBundle } from '../dist/bundler/index.js';
import { transformPagesJsonToGoatManifest } from '../dist/config/index.js';
import type { BundlerInput, PagesJson } from '../dist/types.js';

describe('Uni-app Bundler (Dual-Thread & Single-Thread)', () => {
  const samplePagesJson: PagesJson = {
    pages: [
      { path: 'pages/index/index', style: { navigationBarTitleText: 'Home' } },
      { path: 'pages/detail/index', style: { navigationBarTitleText: 'Detail' } },
    ],
    globalStyle: {
      navigationBarTitleText: 'App Title',
      backgroundColor: '#FAFAFA',
    },
    subPackages: [
      {
        root: 'subpackages/shop',
        name: 'shop',
        pages: ['cart', 'pay'],
      },
    ],
  };

  const { manifest, goatConfig } = transformPagesJsonToGoatManifest(samplePagesJson, {
    appid: 'com.goat.bundler.test',
    name: 'Bundler Test App',
    versionName: '1.0.0',
    versionCode: 1,
  });

  const baseInput: BundlerInput = {
    rootDir: '/app',
    outDir: '/app/dist',
    pagesJson: samplePagesJson,
    manifest,
    goatConfig,
  };

  it('compiles dual-thread bundle with worker, view renderer, and subpackages', () => {
    const output = compileDualThreadBundle(baseInput);

    assert.equal(output.threadModel, 'dual-thread');
    assert.equal(output.entryPage, 'pages/index/index');

    const fileMap = new Map(output.artifacts.map((a) => [a.path, a.content]));

    // Check core files
    assert.ok(fileMap.has('manifest.json'));
    assert.ok(fileMap.has('goat.config.json'));
    assert.ok(fileMap.has('appservice.worker.js'));
    assert.ok(fileMap.has('webview.html'));
    assert.ok(fileMap.has('appview.renderer.js'));
    assert.ok(fileMap.has('appview.css'));
    assert.ok(fileMap.has('integrity.json'));

    // Check subpackage chunks
    assert.ok(fileMap.has('subpackages/shop/shop.worker.js'));
    assert.ok(fileMap.has('subpackages/shop/shop.view.js'));

    // Verify worker content
    const workerCode = String(fileMap.get('appservice.worker.js'));
    assert.ok(workerCode.includes('com.goat.bundler.test'));
    assert.ok(workerCode.includes('pages/index/index'));

    // Verify webview HTML
    const webviewHtml = String(fileMap.get('webview.html'));
    assert.ok(webviewHtml.includes('<div id="app" class="goat-page-container"></div>'));
    assert.ok(webviewHtml.includes('appview.renderer.js'));
  });

  it('compiles single-thread SPA bundle with index.html and unified assets', () => {
    const output = compileSingleThreadBundle(baseInput);

    assert.equal(output.threadModel, 'single-thread');
    const fileMap = new Map(output.artifacts.map((a) => [a.path, a.content]));

    assert.ok(fileMap.has('manifest.json'));
    assert.ok(fileMap.has('goat.config.json'));
    assert.ok(fileMap.has('index.html'));
    assert.ok(fileMap.has('assets/app.js'));
    assert.ok(fileMap.has('assets/app.css'));
    assert.ok(fileMap.has('integrity.json'));

    const indexHtml = String(fileMap.get('index.html'));
    assert.ok(indexHtml.includes('<div id="app"></div>'));
    assert.ok(indexHtml.includes('assets/app.js'));
  });

  it('bundleGoatUniApp dispatches according to targetThreadModel', () => {
    const dualOutput = bundleGoatUniApp({ ...baseInput, targetThreadModel: 'dual-thread' });
    assert.equal(dualOutput.threadModel, 'dual-thread');

    const singleOutput = bundleGoatUniApp({ ...baseInput, targetThreadModel: 'single-thread' });
    assert.equal(singleOutput.threadModel, 'single-thread');
  });
});
