import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { goatUniAppPlugin } from '../dist/plugin.js';

describe('Vite & Rollup Plugin (goatUniAppPlugin)', () => {
  it('creates plugin with name and enforce pre', () => {
    const plugin = goatUniAppPlugin();
    assert.equal(plugin.name, 'goat-compiler-uniapp');
    assert.equal(plugin.enforce, 'pre');
  });

  it('config hook sets UNI_PLATFORM and resolve alias', () => {
    const plugin = goatUniAppPlugin({ targetPlatform: 'goat', threadModel: 'dual-thread' });
    const userConfig = {
      define: { 'process.env.MY_VAR': '"test"' },
      resolve: { alias: { custom: '/custom/path' } },
    };

    const merged = plugin.config(userConfig);
    assert.equal(merged.define['process.env.UNI_PLATFORM'], '"goat"');
    assert.equal(merged.define['process.env.GOAT_THREAD_MODEL'], '"dual-thread"');
    assert.equal(merged.define['process.env.MY_VAR'], '"test"');
    assert.ok(merged.resolve.alias['@']);
    assert.equal(merged.resolve.alias['custom'], '/custom/path');
  });

  it('resolveId and load hooks provide virtual modules', () => {
    const plugin = goatUniAppPlugin();

    // 1. virtual:goat-routes
    const routesId = plugin.resolveId('virtual:goat-routes');
    assert.equal(routesId, '\0virtual:goat-routes');
    const routesContent = plugin.load(routesId!);
    assert.ok(routesContent?.includes('export const routes'));
    assert.ok(routesContent?.includes('export const entryPage'));

    // 2. virtual:goat-manifest
    const manifestId = plugin.resolveId('virtual:goat-manifest');
    assert.equal(manifestId, '\0virtual:goat-manifest');
    const manifestContent = plugin.load(manifestId!);
    assert.ok(manifestContent?.includes('export const manifest'));

    // 3. virtual:goat-bridge
    const bridgeId = plugin.resolveId('virtual:goat-bridge');
    assert.equal(bridgeId, '\0virtual:goat-bridge');
    const bridgeContent = plugin.load(bridgeId!);
    assert.ok(bridgeContent?.includes('@goat/compiler-uniapp/runtime'));
  });

  it('transform hook processes conditional compilation and rpx CSS units', () => {
    const plugin = goatUniAppPlugin({ targetPlatform: 'GOAT' });

    // Test conditional code transform
    const jsCode = `
// #ifdef GOAT
export const isGoat = true;
// #endif
// #ifdef H5
export const isGoat = false;
// #endif
`;
    const transformedJs = plugin.transform(jsCode, '/src/main.ts');
    assert.ok(transformedJs);
    assert.ok(transformedJs.code.includes('export const isGoat = true;'));
    assert.ok(!transformedJs.code.includes('export const isGoat = false;'));

    // Test CSS rpx transform
    const cssCode = '.btn { width: 750rpx; height: 88rpx; }';
    const transformedCss = plugin.transform(cssCode, '/src/style.css');
    assert.ok(transformedCss);
    assert.ok(transformedCss.code.includes('calc(750 * 100vw / 750)'));
    assert.ok(transformedCss.code.includes('calc(88 * 100vw / 750)'));
  });

  it('generateBundle hook emits manifest and integrity assets', () => {
    const plugin = goatUniAppPlugin();
    // Simulate configResolved
    plugin.configResolved({ root: process.cwd() });

    const emittedFiles: Array<{ type: string; fileName: string; source: string }> = [];
    const mockContext = {
      emitFile: (file: any) => {
        emittedFiles.push(file);
      },
    };

    const sampleBundle = {
      'app.js': { type: 'chunk', code: 'console.log("app chunk");' },
      'app.css': { type: 'asset', source: '.app { color: red; }' },
    };

    // Call generateBundle on mockContext
    plugin.generateBundle.call(mockContext, {}, sampleBundle);

    // Verify integrity.json was emitted
    const integrityFile = emittedFiles.find((f) => f.fileName === 'integrity.json');
    assert.ok(integrityFile);
    const parsedIntegrity = JSON.parse(integrityFile.source);
    assert.equal(parsedIntegrity.version, '1.0.0');
    assert.equal(parsedIntegrity.algorithm, 'sha256');
    assert.ok(parsedIntegrity.files['app.js']);
    assert.ok(parsedIntegrity.files['app.css']);
  });
});
