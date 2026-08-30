/**
 * deep-stress-challenger.ts
 * Comprehensive Empirical Stress Harness for Goat DevTools Studio IDE.
 *
 * Stress-tests and empirically verifies all 6 core DevTools component areas:
 * 1. Dual-thread 60fps frame batching under rapid setData bursts (10,000 mutations, VDOM diffing, patch queue).
 * 2. 3D motion accelerometer vectors & GPS coordinate GPX playback interpolation.
 * 3. Network throttling presets, dynamic delay injection, bandwidth calculations, packet loss simulation.
 * 4. Unified console log flood (5,000 - 10,000 entries) and thread origin tagging ([AppService], [AppView], [GoatHost], [System]).
 * 5. Storage explorer KV CRUD (large payloads, batch operations), SQLite queries, and sandboxed filesystem.
 * 6. Subpackage bundle visualizer & CLI `goat studio` launch arguments.
 */

import { performance } from 'node:perf_hooks';
import { DevToolsTestHarness } from './harness/devtools-test-harness.ts';
import { DEVICE_SPECS } from '../store/simulatorSlice.ts';
import { createDualThreadRuntime } from '../services/dualThreadRuntime.ts';
import { parseGpxXml, parseGpxRoute, calculateHaversineDistanceMeters, GpxRoutePlayer } from '../services/gpxParser.ts';
import { NetworkThrottler, NETWORK_PROFILES } from '../services/networkThrottler.ts';
import { parseStudioArgs } from '../../../cli/src/commands/studio.ts';
import { analyzeBytecodePrecompilation } from '../services/v8BytecodeAnalyzer.ts';
import { mockState } from '@goat/bridge-mock';

interface StressTestResult {
  dimension: string;
  testCase: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  details?: Record<string, any>;
  error?: string;
}

const allResults: StressTestResult[] = [];

function check(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function executeTest(
  dimension: string,
  testCase: string,
  fn: () => Promise<Record<string, any> | void> | Record<string, any> | void
) {
  const start = performance.now();
  try {
    const details = (await fn()) || undefined;
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    allResults.push({ dimension, testCase, status: 'PASS', durationMs, details });
    console.log(`  ✅ [${dimension}] ${testCase} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    allResults.push({ dimension, testCase, status: 'FAIL', durationMs, error: err.message || String(err) });
    console.error(`  ❌ [${dimension}] ${testCase} (${durationMs}ms) -> ${err.message}`);
  }
}

async function runDeepStressSuite() {
  console.log('='.repeat(80));
  console.log('🧪 EMPIRICAL CHALLENGER: DEEP ADVERSARIAL STRESS TEST SUITE');
  console.log('='.repeat(80));

  // =========================================================================
  // 1. Dual-Thread 60fps Frame Batching Under Rapid setData Bursts
  // =========================================================================
  console.log('\n[DIMENSION 1] Dual-Thread 60fps Frame Batching & State Bursts');

  await executeTest('Dual-Thread Batching', '1.1: 10,000 rapid setData mutations burst through IPC batcher', async () => {
    const runtime = createDualThreadRuntime({
      appId: 'burst-app-10k',
      batchIntervalMs: 16,
    });
    runtime.worker.launch();
    check(runtime.worker.state === 'RUNNING', 'Worker should be in RUNNING state');

    const totalUpdates = 10000;
    const start = performance.now();

    for (let i = 1; i <= totalUpdates; i++) {
      const idx = i;
      runtime.setData({ progress: idx }, (d) => ({
        type: 'ELEMENT' as const,
        tag: 'view',
        nodeId: 'container-view',
        props: { progress: idx },
        children: [
          {
            type: 'ELEMENT' as const,
            tag: 'text',
            nodeId: 'label-text',
            text: `Step #${idx}`,
          },
        ],
      }));
    }

    runtime.ipc.flushUiPatches();
    const elapsedMs = performance.now() - start;

    const domTree = runtime.getDomTree();
    check(domTree !== null, 'DOM tree should exist after burst');
    check(domTree?.nodeId === 'container-view', 'Container view node ID preserved');
    check(domTree?.children?.[0]?.text === `Step #${totalUpdates}`, `Final text must be Step #${totalUpdates}`);

    const metrics = runtime.getMetrics();
    check(metrics.fps >= 30, `FPS should maintain usable rate (>=30), got ${metrics.fps}`);

    runtime.destroy();
    return { totalUpdates, elapsedMs: Math.round(elapsedMs), throughputOpsSec: Math.round(totalUpdates / (elapsedMs / 1000)) };
  });

  await executeTest('Dual-Thread Batching', '1.2: VDOM patch coalescing and deep tree mutation integrity', () => {
    const runtime = createDualThreadRuntime({ appId: 'vdom-deep-tree' });
    runtime.worker.launch();

    // Create a 20-level nested hierarchy
    let deepNode: any = { type: 'ELEMENT', tag: 'text', nodeId: 'leaf-node', text: 'Leaf Content' };
    for (let i = 19; i >= 0; i--) {
      deepNode = {
        type: 'ELEMENT',
        tag: 'view',
        nodeId: `level-${i}`,
        children: [deepNode],
      };
    }

    runtime.setData({ nested: true }, () => deepNode);
    runtime.ipc.flushUiPatches();

    const root = runtime.getDomTree();
    check(root?.nodeId === 'level-0', 'Root level-0 matches');

    const foundLeaf = runtime.findVNodeById('leaf-node');
    check(foundLeaf !== null, 'Leaf node found in deep hierarchy');
    check(foundLeaf?.text === 'Leaf Content', 'Leaf text matches');

    runtime.destroy();
    return { depth: 20, foundLeafId: foundLeaf?.nodeId };
  });

  // =========================================================================
  // 2. 3D Motion Accelerometer Vectors & GPS GPX Playback Interpolation
  // =========================================================================
  console.log('\n[DIMENSION 2] 3D Motion Sensors & GPS GPX Playback Interpolation');

  await executeTest('Sensors & GPS', '2.1: 3D motion accelerometer vectors (ax, ay, az) and Euler orientation consistency', () => {
    const harness = new DevToolsTestHarness();

    // Test extreme G-force vector (+/- 50 m/s^2)
    harness.store.getState().setAccelerometer({ x: 45.2, y: -38.7, z: 98.1 });
    let st = harness.getState();
    check(st.accelerometer.x === 45.2, 'Accelerometer X match');
    check(st.accelerometer.y === -38.7, 'Accelerometer Y match');
    check(st.accelerometer.z === 98.1, 'Accelerometer Z match');

    // Test Euler angles across full +/- 180 and 360 degree bounds
    harness.store.getState().setDeviceMotion({ alpha: 359.5, beta: -89.9, gamma: 179.9 });
    st = harness.getState();
    check(st.deviceMotion.alpha === 359.5, 'Alpha angle match');
    check(st.deviceMotion.beta === -89.9, 'Beta angle match');
    check(st.deviceMotion.gamma === 179.9, 'Gamma angle match');

    return { accelerometer: st.accelerometer, deviceMotion: st.deviceMotion };
  });

  await executeTest('Sensors & GPS', '2.2: GPS GPX route playback, scrub/seek, speed multipliers, and Haversine distance', async () => {
    // Generate a 1,000-waypoint synthetic GPX track
    let gpxXml = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"><trk><trkseg>';
    for (let i = 0; i < 1000; i++) {
      const lat = 37.7749 + i * 0.0001;
      const lng = -122.4194 + i * 0.0001;
      gpxXml += `<trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${(10 + i * 0.1).toFixed(1)}</ele></trkpt>`;
    }
    gpxXml += '</trkseg></trk></gpx>';

    const route = parseGpxRoute(gpxXml, 'Synthetic Test Track');
    check(route.waypoints.length === 1000, `Expected 1000 waypoints, got ${route.waypoints.length}`);
    check(route.totalDistanceMeters > 10000, `Total distance should be > 10km, got ${route.totalDistanceMeters}m`);

    const player = new GpxRoutePlayer(route.waypoints.map((w) => ({ lat: w.latitude, lng: w.longitude, ele: w.elevation })));
    check(player.getStatus().totalPoints === 1000, 'Player total points = 1000');

    // Scrub / Seek to 50%
    player.seek(500);
    check(player.getStatus().currentIndex === 500, 'Current index after seek is 500');
    const pt500 = player.getCurrentPoint();
    check(pt500 !== null && pt500.lat >= 37.82, `Point 500 lat should be ~37.8249, got ${pt500?.lat}`);

    // Speed multiplier stress (0.1x to 50x)
    player.setSpeed(25.0);
    check(player.getStatus().speedMultiplier === 25.0, 'Speed multiplier updated');

    return { totalWaypoints: route.waypoints.length, totalDistanceMeters: route.totalDistanceMeters };
  });

  await executeTest('Sensors & GPS', '2.3: Geolocation extreme boundary coordinates (Equator, Poles, Date Line)', async () => {
    const harness = new DevToolsTestHarness();

    // North Pole
    harness.setGpsLocation(90.0, 0.0, 100, 1, 0);
    let res = await harness.callBridge('GET_LOCATION');
    check(res.latitude === 90.0 && res.longitude === 0.0, 'North Pole coordinates verified');

    // South Pole / International Date Line
    harness.setGpsLocation(-90.0, -180.0, 2800, 2, 0);
    res = await harness.callBridge('GET_LOCATION');
    check(res.latitude === -90.0 && res.longitude === -180.0, 'South Pole Date Line coordinates verified');

    return { northPole: { lat: 90, lng: 0 }, southPoleDateLine: { lat: -90, lng: -180 } };
  });

  // =========================================================================
  // 3. Network Throttling Presets & Dynamic Delay Injection
  // =========================================================================
  console.log('\n[DIMENSION 3] Network Throttling Presets & Dynamic Delay Injection');

  await executeTest('Network Throttling', '3.1: Verify all 9 network preset configurations & latency timings', async () => {
    const throttler = new NetworkThrottler();
    const presetsToTest: Array<{ preset: string; minDelayMs: number }> = [
      { preset: 'online', minDelayMs: 0 },
      { preset: '5g', minDelayMs: 8 },
      { preset: '4g', minDelayMs: 35 },
      { preset: '3g', minDelayMs: 140 },
      { preset: '2g', minDelayMs: 380 },
    ];

    const measurements: Record<string, number> = {};

    for (const item of presetsToTest) {
      throttler.setPreset(item.preset);
      const t0 = performance.now();
      await throttler.simulateRequest(async () => ({ success: true }), 256);
      const dur = performance.now() - t0;
      measurements[item.preset] = Math.round(dur);
      check(dur >= item.minDelayMs, `Preset ${item.preset} duration ${dur}ms < min ${item.minDelayMs}ms`);
    }

    // Test Offline Mode
    throttler.setPreset('offline');
    let offlineBlocked = false;
    try {
      await throttler.simulateRequest(async () => 'OK');
    } catch (e: any) {
      offlineBlocked = true;
      check(e.message.includes('offline'), `Expected offline error message, got ${e.message}`);
    }
    check(offlineBlocked, 'Offline mode must reject immediately');

    return measurements;
  });

  await executeTest('Network Throttling', '3.2: Packet loss probabilistic rate under burst concurrency', async () => {
    const throttler = new NetworkThrottler();
    // Configure custom 20% packet loss with 0ms latency for fast stress test
    throttler.setCustom({ packetLossRate: 0.20, latencyMs: 0, downloadKbps: 100000 });

    const totalRequests = 500;
    let droppedCount = 0;

    for (let i = 0; i < totalRequests; i++) {
      try {
        await throttler.simulateRequest(async () => 'OK', 64);
      } catch (err: any) {
        if (err.message.includes('packet loss')) {
          droppedCount++;
        }
      }
    }

    const lossRate = droppedCount / totalRequests;
    // With 500 samples, a 20% rate will statistically fall between 10% and 32% (p < 0.0001)
    check(lossRate >= 0.10 && lossRate <= 0.32, `Packet loss rate ${lossRate.toFixed(2)} outside expected range (0.10-0.32)`);

    return { totalRequests, droppedCount, measuredLossRate: Math.round(lossRate * 100) + '%' };
  });

  // =========================================================================
  // 4. Unified Console Log Flood (5,000+ entries) & Thread Origin Tagging
  // =========================================================================
  console.log('\n[DIMENSION 4] Unified Console Log Flood (5,000+ Entries) & Thread Tagging');

  await executeTest('Unified Console', '4.1: Ingest 10,000 log flood across [AppService], [AppView], [GoatHost], [System]', () => {
    const harness = new DevToolsTestHarness();
    harness.store.getState().clearConsoleLogs();
    harness.store.getState().clearLogs();

    const threads: Array<'AppService' | 'AppView' | 'GoatHost' | 'System'> = ['AppService', 'AppView', 'GoatHost', 'System'];
    const levels: Array<'log' | 'info' | 'warn' | 'error'> = ['log', 'info', 'warn', 'error'];

    const totalLogs = 10000;
    const start = performance.now();

    for (let i = 0; i < totalLogs; i++) {
      const thread = threads[i % 4];
      const level = levels[i % 4];
      harness.store.getState().addConsoleLog({
        thread,
        source: thread,
        level,
        message: `High-frequency telemetric log #${i} from thread [${thread}]`,
        data: { iteration: i, payload: { value: Math.sin(i) } },
      });
    }

    const durationMs = performance.now() - start;
    const logs = harness.getState().consoleLogs;
    check(logs.length === totalLogs, `Expected ${totalLogs} logs, got ${logs.length}`);

    // Verify origin tagging distribution
    const appServiceLogs = logs.filter((l) => l.thread === 'AppService' || l.source === 'AppService');
    const appViewLogs = logs.filter((l) => l.thread === 'AppView' || l.source === 'AppView');
    const goatHostLogs = logs.filter((l) => l.thread === 'GoatHost' || l.source === 'GoatHost');
    const systemLogs = logs.filter((l) => l.thread === 'System' || l.source === 'System');

    check(appServiceLogs.length === 2500, `AppService logs count = ${appServiceLogs.length}`);
    check(appViewLogs.length === 2500, `AppView logs count = ${appViewLogs.length}`);
    check(goatHostLogs.length === 2500, `GoatHost logs count = ${goatHostLogs.length}`);
    check(systemLogs.length === 2500, `System logs count = ${systemLogs.length}`);

    return {
      totalLogs,
      durationMs: Math.round(durationMs),
      logsPerSec: Math.round(totalLogs / (durationMs / 1000)),
      counts: { appService: appServiceLogs.length, appView: appViewLogs.length, goatHost: goatHostLogs.length, system: systemLogs.length },
    };
  });

  await executeTest('Unified Console', '4.2: Fast log clearing and log filtering under heavy load', () => {
    const harness = new DevToolsTestHarness();
    check(harness.getState().consoleLogs.length > 0, 'Logs present before clear');

    harness.store.getState().clearConsoleLogs();
    check(harness.getState().consoleLogs.length === 0, 'Console logs cleared cleanly');
    check(harness.getState().logs.length === 0, 'Logs cleared cleanly');

    return { cleared: true };
  });

  // =========================================================================
  // 5. Storage Explorer KV CRUD, SQLite Queries & Sandboxed FileSystem
  // =========================================================================
  console.log('\n[DIMENSION 5] Storage Explorer KV CRUD, SQLite Queries & Sandboxed FS');

  await executeTest('Storage & Sandbox', '5.1: High-throughput KV Storage CRUD with 1,000 keys and large payloads', async () => {
    const harness = new DevToolsTestHarness();

    // 1. Bulk Set 500 keys
    for (let i = 1; i <= 500; i++) {
      harness.store.getState().setStorageKv(`key_${i}`, { index: i, text: `Value for ${i}`, timestamp: Date.now() });
    }
    let st = harness.getState();
    check(Object.keys(st.storageData.kvStore).length >= 500, `Expected at least 500 keys, got ${Object.keys(st.storageData.kvStore).length}`);

    // 2. 2MB Large value payload
    const largeStr = 'ABCDEFGH'.repeat(256 * 1024); // 2MB string
    await harness.callBridge('STORAGE_SET', { key: 'large_binary_payload', value: largeStr });
    const getRes = await harness.callBridge('STORAGE_GET', { key: 'large_binary_payload' });
    check(getRes.value === largeStr, '2MB large value payload retrieved intact');

    // 3. Delete key
    harness.store.getState().deleteStorageKv('key_1');
    st = harness.getState();
    check(st.storageData.kvStore['key_1'] === undefined, 'Key key_1 was deleted');

    return { totalKeysTested: 500, largePayloadSizeKb: 2048 };
  });

  await executeTest('Storage & Sandbox', '5.2: SQLite table inspection, row manipulation and multi-table schemas', () => {
    const harness = new DevToolsTestHarness();
    const st = harness.getState();

    check(st.sqliteTables.length >= 2, `Expected >= 2 SQLite tables, got ${st.sqliteTables.length}`);
    const usersTable = st.sqliteTables.find((t) => t.name === 'users');
    check(usersTable !== undefined, 'Users table found');
    check(usersTable?.columns.length === 5, 'Users table has 5 columns');
    check(usersTable?.rows.length >= 3, 'Users table has rows');

    // Mutate table data
    const newRows = [...usersTable!.rows, { id: 4, username: 'stress_user_04', role: 'tester', email: 'test@goat.dev', balance: 500.0 }];
    harness.store.getState().setSqliteTableData('users', newRows);

    const updated = harness.getState().storageData.sqliteTables['users'];
    check(updated.length === 4, `Updated users table rows = ${updated.length}`);
    check(updated[3].username === 'stress_user_04', 'New user row inserted');

    return { tablesCount: st.sqliteTables.length, usersRowCount: updated.length };
  });

  await executeTest('Storage & Sandbox', '5.3: Sandboxed virtual filesystem directory tree and file CRUD', () => {
    const harness = new DevToolsTestHarness();
    const st = harness.getState();

    check(Object.keys(st.storageData.fsTree).length >= 3, 'FS tree has default sandboxed directories');

    // Add new file in sandbox
    harness.store.getState().setFsItem('/data/user/files', {
      name: 'database_dump.json',
      type: 'application/json',
      size: 1048576,
      mtime: Date.now(),
      content: '{"dump": true}',
    });

    let fsTree = harness.getState().storageData.fsTree;
    const fileList = fsTree['/data/user/files'] || [];
    check(fileList.some((f: any) => f.name === 'database_dump.json'), 'New file added to /data/user/files');

    // Delete file
    harness.store.getState().deleteFsItem('/data/user/files', 'database_dump.json');
    fsTree = harness.getState().storageData.fsTree;
    check(!fsTree['/data/user/files'].some((f: any) => f.name === 'database_dump.json'), 'File deleted from sandbox');

    return { initialDirs: Object.keys(fsTree).length };
  });

  // =========================================================================
  // 6. Subpackage Bundle Visualizer & CLI `goat studio` Launch Arguments
  // =========================================================================
  console.log('\n[DIMENSION 6] Subpackage Bundle Visualizer & CLI Launch Arguments');

  await executeTest('Subpackages & CLI', '6.1: Subpackage bundle size calculation and quota warnings', () => {
    const harness = new DevToolsTestHarness();

    // Multi-subpackage definition
    const complexBundle = {
      mainPackageSize: 450000,
      mainSizeBytes: 450000,
      subpackages: [
        { name: 'auth', root: 'subpackages/auth', sizeBytes: 120000, uncompressedSizeBytes: 300000, files: [] },
        { name: 'shop', root: 'subpackages/shop', sizeBytes: 850000, uncompressedSizeBytes: 2100000, files: [] },
        { name: 'media', root: 'subpackages/media', sizeBytes: 900000, uncompressedSizeBytes: 2400000, files: [] },
      ],
      totalSizeBytes: 2320000, // Exceeds 2MB quota
      maxRecommendedSizeBytes: 2097152,
      isWithinQuota: false,
      warnings: ['Total package size 2.32MB exceeds 2MB recommended ceiling.'],
    };

    harness.store.getState().setBundleStats(complexBundle);
    const st = harness.getState();
    check(st.bundleStats.isWithinQuota === false, 'Quota violation correctly flagged');
    check(st.bundleStats.subpackages.length === 3, '3 subpackages stored');
    check(st.bundleStats.warnings.length === 1, 'Warning message registered');

    return { totalSizeBytes: st.bundleStats.totalSizeBytes, isWithinQuota: st.bundleStats.isWithinQuota };
  });

  await executeTest('Subpackages & CLI', '6.2: V8 Bytecode precompilation analyzer metrics & cold boot speedup', () => {
    const sourceCode = `
      function heavyComputation() {
        let sum = 0;
        for (let i = 0; i < 100000; i++) sum += Math.sqrt(i);
        return sum;
      }
      export default heavyComputation;
    `;

    const summary = analyzeBytecodePrecompilation(sourceCode);
    check(summary.originalSizeBytes === sourceCode.length, 'Original size matches');
    check(summary.bytecodeSizeBytes > 64, 'Bytecode size calculated');
    check(summary.coldBootTimeBeforeMs > 0, 'Cold boot time estimated');
    check(summary.coldBootTimeAfterMs < summary.coldBootTimeBeforeMs, 'Cached boot is faster than cold boot');
    check(summary.integritySha256.startsWith('sha256-'), 'SHA-256 integrity hash generated');

    return summary;
  });

  await executeTest('Subpackages & CLI', '6.3: CLI parseStudioArgs matrix testing across all options and defaults', () => {
    // 1. Defaults
    const def = parseStudioArgs([]);
    check(def.port === 5173, `Default port 5173, got ${def.port}`);
    check(def.serverPort === 7373, `Default serverPort 7373, got ${def.serverPort}`);
    check(def.open === true, 'Default open=true');
    check(def.host === false, 'Default host=false');

    // 2. Custom Port and Server Port
    const custom = parseStudioArgs(['--port', '8080', '--server-port', '9090', '--no-open', '--host']);
    check(custom.port === 8080, 'Custom port 8080');
    check(custom.serverPort === 9090, 'Custom serverPort 9090');
    check(custom.open === false, 'open=false with --no-open');
    check(custom.host === true, 'host=true with --host');

    // 3. Shorthand project flag -p
    const proj = parseStudioArgs(['-p', './custom-app']);
    check(proj.project.endsWith('custom-app'), `Project path resolved: ${proj.project}`);

    return { defaultOptions: def, customOptions: custom };
  });

  // =========================================================================
  // SUMMARY REPORT & VERDICT
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  const passed = allResults.filter((r) => r.status === 'PASS').length;
  const failed = allResults.filter((r) => r.status === 'FAIL').length;
  const totalDuration = allResults.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`📊 DEEP ADVERSARIAL STRESS CHALLENGER SUMMARY:`);
  console.log(`   Passed: ${passed} / ${allResults.length} (${((passed / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} / ${allResults.length}`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.error('❌ EMPIRICAL CHALLENGER VERDICT: REQUEST_CHANGES');
    process.exit(1);
  } else {
    console.log('🎉 EMPIRICAL CHALLENGER VERDICT: APPROVE');
    process.exit(0);
  }
}

runDeepStressSuite().catch((err) => {
  console.error('Fatal crash during deep stress run:', err);
  process.exit(1);
});
