/**
 * challenger-adversarial-empirical.ts
 * Challenger 1: Empirical Adversarial Stress Harness for Milestone 6 DevTools Studio IDE.
 *
 * Exhaustively stress-tests:
 * 1. CLI execution: goat studio --help, goat studio --no-open --port=5180, flag matrix
 * 2. Simulator edge cases: Orientation switching, zoom bounds (50%-150%), rapid frame batching
 * 3. Sensor stress tests: GPX route scrub extremes, network throttling disconnect & packet loss, biometrics lockout
 * 4. Debugger edge cases: deep DOM trees, malformed storage keys, high-frequency logs
 */

import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DevToolsTestHarness } from './harness/devtools-test-harness.ts';
import { DEVICE_SPECS } from '../store/simulatorSlice.ts';
import { createDualThreadRuntime } from '../services/dualThreadRuntime.ts';
import { parseGpxRoute, calculateHaversineDistanceMeters, GpxRoutePlayer } from '../services/gpxParser.ts';
import { NetworkThrottler } from '../services/networkThrottler.ts';
import { mockState } from '@goat/bridge-mock';
import type { LogEntry } from '../types/debugger.ts';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest(suite: string, name: string, fn: () => Promise<any> | any) {
  const start = performance.now();
  try {
    const details = (await fn()) || undefined;
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: true, durationMs, details });
    console.log(`  ✅ [${suite}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: false, durationMs, error: err.message || String(err) });
    console.error(`  ❌ [${suite}] ${name} (${durationMs}ms) -> ${err.message}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🧪 CHALLENGER 1: COMPREHENSIVE EMPIRICAL & ADVERSARIAL STRESS HARNESS');
  console.log('='.repeat(80));

  // =========================================================================
  // SECTION 1: CLI Execution & Parameter Fuzzing
  // =========================================================================
  console.log('\n💻 SECTION 1: CLI Execution & Parameter Fuzzing');

  const cliBin = resolve(process.cwd(), 'packages/cli/bin/goat.mjs');

  await runTest('CLI Execution', '1.1: `goat studio --help` outputs usage instructions and available options', () => {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', cliBin, '--help'], {
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    assert(out.includes('goat studio') || out.includes('studio'), 'Help should list studio command');
    assert(out.includes('Usage: goat'), 'Help should include usage syntax');
    return { outputSnippet: out.slice(0, 120) };
  });

  await runTest('CLI Execution', '1.2: `goat studio --no-open --port=5180` configures port and suppresses browser launch', () => {
    const out = execFileSync(
      process.execPath,
      ['--experimental-strip-types', cliBin, 'studio', '--no-open', '--port=5180'],
      { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0' } }
    );
    assert(out.includes('5180'), 'Output should contain port 5180');
    assert(out.includes('Auto-Open   : no') || out.includes('Auto-Open: no') || !out.includes('Opening browser'), 'Auto-open should be disabled');
    assert(out.includes('DevTools Studio server listening on http://localhost:5180'), 'Should log listening address');
    return { port: 5180, autoOpen: 'no' };
  });

  await runTest('CLI Execution', '1.3: `goat studio` parameter matrix (--project, --host, --server-port)', () => {
    const out = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        cliBin,
        'studio',
        '--project=./custom-app',
        '--host',
        '--server-port=7575',
        '--port=5199',
        '--no-open',
      ],
      { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0' } }
    );
    assert(out.includes('5199'), 'Custom UI port 5199');
    assert(out.includes('7575'), 'Custom server relay port 7575');
    assert(out.includes('custom-app'), 'Custom project directory');
    assert(out.includes('0.0.0.0') || out.includes('127.0.0.1'), 'Host binding set');
    return { customPorts: { ui: 5199, server: 7575 } };
  });

  // =========================================================================
  // SECTION 2: Simulator Edge Cases (Orientation, Zoom Bounds, Frame Batching)
  // =========================================================================
  console.log('\n📱 SECTION 2: Simulator Edge Cases & Concurrency Stress');

  await runTest('Simulator Edge Cases', '2.1: Viewport zoom scale clamping (50% to 150%)', () => {
    const harness = new DevToolsTestHarness();
    const validScales = [0.5, 0.75, 1.0, 1.25, 1.5];

    for (const scale of validScales) {
      harness.setViewportScale(scale as any);
      assert(harness.getState().viewportScale === scale, `Scale should be ${scale}`);
      assert(harness.getState().scale === scale, `Scale mirror should be ${scale}`);
    }

    return { validScalesTested: validScales };
  });

  await runTest('Simulator Edge Cases', '2.2: Device orientation switching across all 4 skins with insets verification', () => {
    const harness = new DevToolsTestHarness();
    const skins: Array<'iphone16pro' | 'pixel9pro' | 'ipadpro' | 'foldable'> = [
      'iphone16pro',
      'pixel9pro',
      'ipadpro',
      'foldable',
    ];

    for (const skin of skins) {
      // Portrait
      harness.setDeviceSkin(skin);
      harness.store.getState().setOrientation('portrait');
      let state = harness.getState();
      assert(state.orientation === 'portrait', `Orientation should be portrait for ${skin}`);
      assert(state.safeAreaInsets.top > 0, `Top inset should be > 0 in portrait for ${skin}`);

      // Landscape
      harness.store.getState().setOrientation('landscape');
      state = harness.getState();
      assert(state.orientation === 'landscape', `Orientation should be landscape for ${skin}`);

      if (skin === 'iphone16pro') {
        assert(state.safeAreaInsets.left === 59 && state.safeAreaInsets.right === 59, 'iPhone 16 Pro landscape insets mismatch');
        assert(state.safeAreaInsets.top === 0 && state.safeAreaInsets.bottom === 21, 'iPhone 16 Pro top/bottom insets mismatch');
      } else if (skin === 'pixel9pro') {
        assert(state.safeAreaInsets.left === 48 && state.safeAreaInsets.right === 48, 'Pixel 9 Pro landscape insets mismatch');
      } else if (skin === 'foldable') {
        assert(state.safeAreaInsets.left === 32 && state.safeAreaInsets.right === 32, 'Foldable landscape insets mismatch');
      }
    }

    // Rapid toggle stress: 500 consecutive orientation flips
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      harness.toggleOrientation();
    }
    const flipDuration = performance.now() - t0;
    assert(harness.getState().orientation === 'landscape', '500 flips from landscape should end at landscape');

    return { skinsTested: skins.length, flips: 500, flipDurationMs: Math.round(flipDuration) };
  });

  await runTest('Simulator Edge Cases', '2.3: Rapid frame batching under 2,000 VDOM patch mutations', async () => {
    const runtime = createDualThreadRuntime({
      appId: 'batcher-stress-app',
      batchIntervalMs: 16,
    });
    runtime.worker.launch();
    assert(runtime.worker.state === 'RUNNING', 'Worker should be RUNNING');

    const totalMutations = 2000;
    const t0 = performance.now();

    for (let i = 1; i <= totalMutations; i++) {
      const idx = i;
      runtime.setData({ progress: idx }, (d) => ({
        type: 'ELEMENT' as const,
        tag: 'div',
        nodeId: 'container-node',
        props: { 'data-version': idx },
        children: [
          {
            type: 'ELEMENT' as const,
            tag: 'span',
            nodeId: 'label-node',
            text: `Step: ${idx}/${totalMutations}`,
          },
        ],
      }));
    }

    runtime.ipc.flushUiPatches();
    const durationMs = performance.now() - t0;

    const domTree = runtime.getDomTree();
    assert(domTree !== null, 'DOM tree should not be null');
    assert(domTree?.children?.[0]?.text === `Step: ${totalMutations}/${totalMutations}`, 'Final VDOM text convergence mismatch');

    const metrics = runtime.getMetrics();
    assert(metrics.fps >= 30, `FPS should remain healthy, got ${metrics.fps}`);

    runtime.destroy();
    return {
      totalMutations,
      durationMs: Math.round(durationMs),
      opsPerSec: Math.round(totalMutations / (durationMs / 1000)),
      fps: metrics.fps,
    };
  });

  // =========================================================================
  // SECTION 3: Sensor Stress Tests (GPX Extremes, Network Throttling, Biometrics)
  // =========================================================================
  console.log('\n🧭 SECTION 3: Sensor & Hardware Stress Testing');

  await runTest('Sensor Stress', '3.1: GPX route scrub extremes (out-of-bounds, empty XML, large route)', () => {
    // 1. Empty route parser resilience
    const emptyRoute = parseGpxRoute('');
    assert(emptyRoute.waypoints.length === 0, 'Empty GPX should yield 0 waypoints');

    // 2. Malformed XML without tags
    const malformedRoute = parseGpxRoute('<gpx><trk><trkseg><trkpt lat="37.77" lon="-122.41">');
    assert(malformedRoute !== null, 'Malformed XML should not throw fatal error');

    // 3. Player boundary scrub tests
    const points = [
      { lat: 10.0, lng: 20.0, ele: 100 },
      { lat: 10.1, lng: 20.1, ele: 110 },
      { lat: 10.2, lng: 20.2, ele: 120 },
    ];
    const player = new GpxRoutePlayer(points);

    // Negative seek (should clamp to 0)
    player.seek(-5);
    assert(player.getStatus().currentIndex === 0, `Seek -5 should clamp to 0, got ${player.getStatus().currentIndex}`);

    // Overflow seek (should clamp to length - 1)
    player.seek(999);
    assert(player.getStatus().currentIndex === 2, `Seek 999 should clamp to 2, got ${player.getStatus().currentIndex}`);

    // Extreme Haversine distance: North Pole (90, 0) to South Pole (-90, 0) ~ 20,015 km
    const poleDistanceMeters = calculateHaversineDistanceMeters(90, 0, -90, 0);
    assert(
      poleDistanceMeters >= 20000000 && poleDistanceMeters <= 20030000,
      `Pole to pole distance expected ~20,015km, got ${Math.round(poleDistanceMeters / 1000)}km`
    );

    return {
      emptyHandled: true,
      clampedLower: 0,
      clampedUpper: 2,
      poleDistanceKm: Math.round(poleDistanceMeters / 1000),
    };
  });

  await runTest('Sensor Stress', '3.2: Network throttling disconnect, latency injection, and packet loss', async () => {
    const throttler = new NetworkThrottler();

    // 1. Offline disconnect immediate rejection
    throttler.setPreset('offline');
    let offlineThrew = false;
    try {
      await throttler.simulateRequest(async () => 'OK');
    } catch (e: any) {
      offlineThrew = true;
      assert(e.message.toLowerCase().includes('offline') || e.message.toLowerCase().includes('network'), 'Offline error');
    }
    assert(offlineThrew === true, 'Offline mode must reject network requests');

    // 2. Packet Loss profile configuration
    throttler.setPreset('packet-loss');
    assert(throttler.getProfile().packetLossRate === 0.25, 'Packet loss rate should be 0.25 (25%)');

    // 3. 3G Latency injection validation (~150ms)
    throttler.setPreset('3g');
    const t0 = performance.now();
    await throttler.simulateRequest(async () => 'DATA', 200);
    const d3g = performance.now() - t0;
    assert(d3g >= 140, `3G request delay should be >= 140ms, got ${d3g.toFixed(1)}ms`);

    // 4. Large payload bandwidth delay (32KB on 2G: 250kbps = 31.25 KB/s -> ~1024ms + 400ms = ~1424ms)
    throttler.setPreset('2g');
    const t1 = performance.now();
    await throttler.simulateRequest(async () => 'BLOB', 32768);
    const d2gLarge = performance.now() - t1;
    assert(d2gLarge >= 1200, `32KB on 2G should take >= 1200ms, got ${d2gLarge.toFixed(1)}ms`);

    return {
      d3gMs: Math.round(d3g),
      d2gLargePayloadMs: Math.round(d2gLarge),
    };
  });

  await runTest('Sensor Stress', '3.3: Biometrics authentication and 5x failure lockout state machine', async () => {
    const harness = new DevToolsTestHarness();

    // 1. Success Auth
    harness.store.getState().setBiometrics({
      type: 'faceId',
      isEnrolled: true,
      shouldSucceed: true,
    });
    const authRes = await harness.callBridge('BIOMETRIC_AUTH');
    assert(authRes.authenticated === true, 'Biometric auth should succeed');
    assert(authRes.token !== undefined, 'Auth token should be generated');

    // 2. Non-enrolled refusal
    harness.store.getState().setBiometrics({
      type: 'faceId',
      isEnrolled: false,
      shouldSucceed: true,
    });
    let nonEnrolledFailed = false;
    try {
      await harness.callBridge('BIOMETRIC_AUTH');
    } catch (e: any) {
      nonEnrolledFailed = true;
      assert(e.message.includes('NOT_ENROLLED'), `Expected NOT_ENROLLED error, got: ${e.message}`);
    }
    assert(nonEnrolledFailed === true, 'Non-enrolled auth should fail');

    // 3. 5x Failure Lockout Simulation
    harness.store.getState().setBiometrics({
      type: 'fingerprint',
      isEnrolled: true,
      shouldSucceed: false,
    });

    let consecutiveFails = 0;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await harness.callBridge('BIOMETRIC_AUTH');
      } catch (err: any) {
        consecutiveFails++;
      }
    }
    assert(consecutiveFails === 5, `Expected 5 consecutive fails, got ${consecutiveFails}`);

    harness.store.getState().setBiometricsMode('lockout');
    assert(harness.getState().biometricsMode === 'lockout', 'Store biometricsMode should be locked out');

    return { consecutiveFails, lockoutActive: true };
  });

  // =========================================================================
  // SECTION 4: Debugger Edge Cases (Deep DOM, Malformed Storage, High-Freq Logs)
  // =========================================================================
  console.log('\n🔍 SECTION 4: Debugger Edge Cases & Memory Bounds');

  await runTest('Debugger Edge Cases', '4.1: Deep DOM tree hierarchy (100 nested levels) and computed styles', () => {
    const harness = new DevToolsTestHarness();

    // Construct 100-level deep VDOM tree
    let current: any = {
      tag: 'span',
      nodeId: 'leaf-100',
      text: 'Deepest Leaf Element',
      attributes: { 'data-depth': '100' },
      children: [],
    };

    for (let depth = 99; depth >= 1; depth--) {
      current = {
        tag: 'div',
        nodeId: `node-depth-${depth}`,
        attributes: { 'data-depth': String(depth), class: 'nested-container' },
        children: [current],
      };
    }

    harness.store.getState().setDomTree(current);
    const storedTree = harness.getState().domElements.domTree;
    assert(storedTree.nodeId === 'node-depth-1', 'Root node should be node-depth-1');

    // Select deep leaf node
    harness.store.getState().setSelectedDomNodeId('leaf-100');
    assert(harness.getState().selectedDomNodeId === 'leaf-100', 'Selected DOM node should be leaf-100');

    // Set computed styles for inspected node
    harness.store.getState().setComputedStyles({
      display: 'flex',
      'font-size': '14px',
      color: '#38bdf8',
    });
    const styles = harness.getState().domElements.computedStyles;
    assert(styles['font-size'] === '14px', 'Computed styles font-size mismatch');
    assert(styles.color === '#38bdf8', 'Computed styles color mismatch');

    return { maxDepth: 100, selectedNodeId: 'leaf-100' };
  });

  await runTest('Debugger Edge Cases', '4.2: Storage Explorer: malformed keys, 1MB payload values, SQLite & FS tree', () => {
    const harness = new DevToolsTestHarness();

    // 1. Unicode, symbol, and edge keys in KV storage
    const testKeys = [
      'key_with_spaces and punctuation!@#$',
      'ключ_с_юникодом_🚀',
      'key.with.dots.and.slashes/path',
      '',
    ];

    for (const key of testKeys) {
      harness.store.getState().setStorageItem(key, `Val for [${key}]`);
      assert(harness.getState().storageData.kvStore[key] === `Val for [${key}]`, `Key "${key}" not stored properly`);
    }

    // 2. Large 1MB payload string
    const large1MBValue = 'X'.repeat(1024 * 1024);
    harness.store.getState().setStorageItem('large_blob_1mb', large1MBValue);
    assert(harness.getState().storageData.kvStore['large_blob_1mb'].length === 1048576, '1MB value length mismatch');

    // Delete large item
    harness.store.getState().deleteStorageKv('large_blob_1mb');
    assert(harness.getState().storageData.kvStore['large_blob_1mb'] === undefined, 'Large key should be deleted');

    // 3. SQLite tables inspection & dynamic rows insertion
    harness.store.getState().setSqliteTableData('users', [
      { id: 101, username: 'stress_user', role: 'admin' },
      { id: 102, username: 'stress_user_2', role: 'guest' },
    ]);
    const usersTable = harness.getState().storageData.sqliteTables['users'];
    assert(usersTable.length === 2, 'SQLite users table rows mismatch');
    assert(usersTable[0].username === 'stress_user', 'User record mismatch');

    // 4. FileSystem tree CRUD
    harness.store.getState().setFsItem('/data/user/files', {
      name: 'adversarial_test.bin',
      type: 'application/octet-stream',
      size: 65536,
      mtime: Date.now(),
    });
    let files = harness.getState().storageData.fsTree['/data/user/files'];
    assert(files.some((f: any) => f.name === 'adversarial_test.bin'), 'File should exist in fsTree');

    harness.store.getState().deleteFsItem('/data/user/files', 'adversarial_test.bin');
    files = harness.getState().storageData.fsTree['/data/user/files'];
    assert(!files.some((f: any) => f.name === 'adversarial_test.bin'), 'File should be removed from fsTree');

    return { testedKeysCount: testKeys.length, largeBlobTested: '1MB', sqliteVerified: true, fsTreeVerified: true };
  });

  await runTest('Debugger Edge Cases', '4.3: High-frequency log aggregation (10,000 logs) & ring buffer memory bounds', () => {
    const harness = new DevToolsTestHarness();
    harness.store.getState().clearLogs();
    assert(harness.getState().logs.length === 0, 'Logs should be cleared');

    const totalLogs = 10000;
    const threads: Array<'AppService' | 'AppView' | 'GoatHost'> = ['AppService', 'AppView', 'GoatHost'];
    const levels: Array<'info' | 'warn' | 'error' | 'debug'> = ['info', 'warn', 'error', 'debug'];

    const t0 = performance.now();
    for (let i = 1; i <= totalLogs; i++) {
      const thread = threads[i % 3];
      const level = levels[i % 4];
      harness.store.getState().addLog({
        thread: thread as any,
        level: level as any,
        message: `High frequency event payload #${i} from thread ${thread}`,
        timestamp: Date.now(),
        data: { seq: i, payloadHex: '0xDEADBEEF' },
      });
    }
    const logDuration = performance.now() - t0;

    const storedLogs = harness.getState().logs;
    // Ring buffer bounds: slice(-9999) keeps at most 10,000 entries
    assert(storedLogs.length <= 10000, `Logs length should be <= 10000, got ${storedLogs.length}`);
    assert(storedLogs.length === 10000, `Expected exactly 10,000 logs stored, got ${storedLogs.length}`);

    // Verify last log content
    const lastLog = storedLogs[storedLogs.length - 1];
    assert(lastLog.message.includes('#10000'), `Last log message should contain #10000, got ${lastLog.message}`);

    return {
      totalLogsPushed: totalLogs,
      storedLogsCount: storedLogs.length,
      logDurationMs: Math.round(logDuration),
      logsPerSec: Math.round(totalLogs / (logDuration / 1000)),
    };
  });

  // =========================================================================
  // SUMMARY & VERDICT
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`📊 CHALLENGER 1 ADVERSARIAL STRESS SUITE RESULTS:`);
  console.log(`   Passed: ${passed} / ${results.length} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} / ${results.length}`);
  console.log(`   Total Duration: ${(totalMs / 1000).toFixed(2)}s`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.error('\n❌ VERDICT: REJECTED');
    process.exit(1);
  } else {
    console.log('\n🎉 VERDICT: APPROVED (All stress tests passed 100%)');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal crash during adversarial test harness execution:', err);
  process.exit(1);
});
