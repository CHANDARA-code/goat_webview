import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock } from '../src/index.js';

test('Domain 16: Subpackages, WASM & Bytecode', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Subpackages: LOAD_SUBPACKAGE, IS_SUBPACKAGE_CACHED, GET_SUBPACKAGES, CLEAR_SUBPACKAGE_CACHE', async () => {
    const loadRes = await bridge.callNative('LOAD_SUBPACKAGE', { subpackageName: 'subpkg_live_stream' });
    assert.equal(loadRes.isSuccess, true);
    assert.equal(loadRes.subpackageName, 'subpkg_live_stream');

    const cachedRes = await bridge.callNative('IS_SUBPACKAGE_CACHED', { subpackageName: 'subpkg_live_stream' });
    assert.equal(cachedRes.isCached, true);

    const listRes = await bridge.callNative('GET_SUBPACKAGES');
    assert.equal(listRes.subpackages.includes('subpkg_live_stream'), true);

    const clearRes = await bridge.callNative('CLEAR_SUBPACKAGE_CACHE', { subpackageName: 'subpkg_live_stream' });
    assert.equal(clearRes.cleared, true);
  });

  await t.test('Bytecode Cache: PRECOMPILE_BYTECODE, IS_BYTECODE_WARM, GET_BYTECODE_STATS, CLEAR_BYTECODE_CACHE', async () => {
    const precompileRes = await bridge.callNative('PRECOMPILE_BYTECODE', { bundlePath: '/dist/app.bundle.js' });
    assert.equal(precompileRes.isSuccess, true);
    assert.equal(precompileRes.bytecodeSizeBytes > 0, true);

    const warmRes = await bridge.callNative('IS_BYTECODE_WARM');
    assert.equal(warmRes.isWarm, true);

    const statsRes = await bridge.callNative('GET_BYTECODE_STATS');
    assert.equal(statsRes.totalCachedBundles >= 1, true);
    assert.equal(statsRes.totalCacheSizeBytes > 0, true);

    const clearRes = await bridge.callNative('CLEAR_BYTECODE_CACHE');
    assert.equal(clearRes.cleared, true);
  });

  await t.test('VALIDATE_WASM_SUPPORT returns WebAssembly probing results', async () => {
    const wasmRes = await bridge.callNative('VALIDATE_WASM_SUPPORT');
    assert.equal(wasmRes.wasmSupported, true);
    assert.equal(wasmRes.simdSupported, true);
    assert.equal(wasmRes.maxMemoryPages, 65536);
  });
});
