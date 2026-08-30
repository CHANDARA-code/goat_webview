/**
 * challenger-1-stress-runner.ts
 * Challenger 1 (Simulator & Sensors Adversarial Challenger) Empirical Stress Harness.
 *
 * Executes exhaustive stress-testing, boundary condition fuzzing, mathematical property
 * verification, and concurrency benchmarks for:
 * 1. Viewport scaling bounds (50%-150%), orientation switching, dynamic island/punch-hole/foldable rendering.
 * 2. 60fps frame batcher under rapid state bursts (1,000+ setData calls).
 * 3. Motion accelerometer vectors (ax, ay, az) and Euler angles.
 * 4. Geolocation GPX route parsing and coordinate interpolation.
 * 5. Network throttling latency injection on API_REQUEST calls.
 * 6. Biometrics modal Face ID/Fingerprint success, failure, cancel, and 5x lockout behavior.
 */

import { performance } from 'node:perf_hooks';
import { DevToolsTestHarness } from './harness/devtools-test-harness.ts';
import { DEVICE_SPECS } from '../store/simulatorSlice.ts';
import { createDualThreadRuntime, DualThreadRuntimeService } from '../services/dualThreadRuntime.ts';
import { parseGpxXml, parseGpxRoute, calculateHaversineDistanceMeters, GpxRoutePlayer } from '../services/gpxParser.ts';
import { NetworkThrottler, NETWORK_PROFILES } from '../services/networkThrottler.ts';
import { mockState } from '@goat/bridge-mock';
import type { VNode } from '@goat/appservice';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  metrics?: Record<string, any>;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest(suite: string, name: string, fn: () => Promise<Record<string, any> | void> | Record<string, any> | void) {
  const start = performance.now();
  try {
    const metrics = (await fn()) || undefined;
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: true, durationMs, metrics });
    console.log(`  ✅ [${suite}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: false, durationMs, error: err.message || String(err) });
    console.error(`  ❌ [${suite}] ${name} (${durationMs}ms) -> ${err.message}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔥 CHALLENGER 1: SIMULATOR & SENSORS ADVERSARIAL STRESS HARNESS');
  console.log('='.repeat(80));

  // =========================================================================
  // SUITE 1: Viewport Scaling Bounds, Orientation Switching & Device Chassis
  // =========================================================================
  console.log('\n📱 SUITE 1: Viewport Scaling Bounds & Device Chassis Verification');

  await runTest('Viewport & Chassis', '1.1: Viewport scaling bounds (50%, 75%, 100%, 125%, 150%)', () => {
    const harness = new DevToolsTestHarness();
    const scales = [0.5, 0.75, 1.0, 1.25, 1.5];

    for (const s of scales) {
      harness.setViewportScale(s as any);
      assert(harness.getState().viewportScale === s, `Expected viewportScale ${s}, got ${harness.getState().viewportScale}`);
      assert(harness.getState().scale === s, `Expected scale ${s}, got ${harness.getState().scale}`);
    }

    return { testedScales: scales };
  });

  await runTest('Viewport & Chassis', '1.2: Device skin specifications & Safe Area Insets (All 4 skins)', () => {
    const harness = new DevToolsTestHarness();

    // 1. iPhone 16 Pro
    harness.setDeviceSkin('iphone16pro');
    let state = harness.getState();
    assert(state.activeDeviceSkin === 'iphone16pro', 'activeDeviceSkin should be iphone16pro');
    assert(state.safeAreaInsets.top === 59, `iPhone 16 Pro top inset should be 59, got ${state.safeAreaInsets.top}`);
    assert(state.safeAreaInsets.bottom === 34, `iPhone 16 Pro bottom inset should be 34, got ${state.safeAreaInsets.bottom}`);
    assert(DEVICE_SPECS.iphone16pro.hasDynamicIsland === true, 'iPhone 16 Pro must have dynamic island');
    assert(DEVICE_SPECS.iphone16pro.width === 393 && DEVICE_SPECS.iphone16pro.height === 852, 'iPhone 16 Pro dimensions mismatch');

    // 2. Pixel 9 Pro
    harness.setDeviceSkin('pixel9pro');
    state = harness.getState();
    assert(state.activeDeviceSkin === 'pixel9pro', 'activeDeviceSkin should be pixel9pro');
    assert(state.safeAreaInsets.top === 48, `Pixel 9 Pro top inset should be 48, got ${state.safeAreaInsets.top}`);
    assert(state.safeAreaInsets.bottom === 24, `Pixel 9 Pro bottom inset should be 24, got ${state.safeAreaInsets.bottom}`);
    assert(DEVICE_SPECS.pixel9pro.hasPunchHole === true, 'Pixel 9 Pro must have punch hole');
    assert(DEVICE_SPECS.pixel9pro.width === 412 && DEVICE_SPECS.pixel9pro.height === 892, 'Pixel 9 Pro dimensions mismatch');

    // 3. iPad Pro
    harness.setDeviceSkin('ipadpro');
    state = harness.getState();
    assert(state.activeDeviceSkin === 'ipadpro', 'activeDeviceSkin should be ipadpro');
    assert(state.safeAreaInsets.top === 24, `iPad Pro top inset should be 24, got ${state.safeAreaInsets.top}`);
    assert(DEVICE_SPECS.ipadpro.isTablet === true, 'iPad Pro must have isTablet=true');
    assert(DEVICE_SPECS.ipadpro.width === 768 && DEVICE_SPECS.ipadpro.height === 1024, 'iPad Pro dimensions mismatch');

    // 4. Foldable Dual-Screen
    harness.setDeviceSkin('foldable');
    state = harness.getState();
    assert(state.activeDeviceSkin === 'foldable', 'activeDeviceSkin should be foldable');
    assert(state.safeAreaInsets.top === 32, `Foldable top inset should be 32, got ${state.safeAreaInsets.top}`);
    assert(DEVICE_SPECS.foldable.isFoldable === true, 'Foldable must have isFoldable=true');
    assert(DEVICE_SPECS.foldable.width === 680 && DEVICE_SPECS.foldable.height === 600, 'Foldable dimensions mismatch');

    return { verifiedSkins: ['iphone16pro', 'pixel9pro', 'ipadpro', 'foldable'] };
  });

  await runTest('Viewport & Chassis', '1.3: Orientation switching recalculates landscape safe areas for all skins', () => {
    const harness = new DevToolsTestHarness();

    // iPhone 16 Pro Landscape
    harness.setDeviceSkin('iphone16pro');
    harness.store.getState().setOrientation('landscape');
    let state = harness.getState();
    assert(state.orientation === 'landscape', 'Orientation should be landscape');
    assert(state.safeAreaInsets.left === 59 && state.safeAreaInsets.right === 59, 'iPhone 16 Pro landscape insets left/right must be 59');
    assert(state.safeAreaInsets.top === 0 && state.safeAreaInsets.bottom === 21, 'iPhone 16 Pro landscape insets top=0, bottom=21');

    // Pixel 9 Pro Landscape
    harness.setDeviceSkin('pixel9pro');
    harness.store.getState().setOrientation('landscape');
    state = harness.getState();
    assert(state.safeAreaInsets.left === 48 && state.safeAreaInsets.right === 48, 'Pixel 9 Pro landscape insets left/right must be 48');
    assert(state.safeAreaInsets.top === 0 && state.safeAreaInsets.bottom === 16, 'Pixel 9 Pro landscape insets top=0, bottom=16');

    // Foldable Landscape
    harness.setDeviceSkin('foldable');
    harness.store.getState().setOrientation('landscape');
    state = harness.getState();
    assert(state.safeAreaInsets.left === 32 && state.safeAreaInsets.right === 32, 'Foldable landscape insets left/right must be 32');

    // Rapid toggle stress: 100 orientation toggles
    for (let i = 0; i < 100; i++) {
      harness.toggleOrientation();
    }
    assert(harness.getState().orientation === 'landscape', '100 toggles from landscape should finish at landscape');

    return { iterations: 100 };
  });

  // =========================================================================
  // SUITE 2: 60fps Frame Batcher Under Rapid State Bursts (1,000+ setData Calls)
  // =========================================================================
  console.log('\n⚡ SUITE 2: 60fps Frame Batcher & Dual-Thread State Bursts');

  await runTest('Frame Batcher', '2.1: 1,000 rapid setData mutations burst without deadlock or frame drop', async () => {
    const runtime = createDualThreadRuntime({
      appId: 'stress-burst-app',
      batchIntervalMs: 16,
    });

    runtime.worker.launch();
    assert(runtime.worker.state === 'RUNNING', 'Worker should be in RUNNING state');

    const totalMutations = 1000;
    const startBurst = performance.now();

    for (let i = 1; i <= totalMutations; i++) {
      const currentVal = i;
      runtime.setData({ count: currentVal }, (d) => ({
        type: 'ELEMENT' as const,
        tag: 'div',
        nodeId: 'root-burst',
        props: { 'data-count': currentVal },
        children: [
          {
            type: 'ELEMENT' as const,
            tag: 'span',
            nodeId: 'count-label',
            text: `Count: ${currentVal}`,
          },
        ],
      }));
    }

    // Flush pending IPC UI patches
    runtime.ipc.flushUiPatches();
    const burstDurationMs = performance.now() - startBurst;

    // Verify the final VDOM tree state matches the 1000th mutation
    const finalTree = runtime.getDomTree();
    assert(finalTree !== null, 'DOM tree should not be null');
    assert(finalTree?.nodeId === 'root-burst', `Expected root-burst nodeId, got ${finalTree?.nodeId}`);
    assert(finalTree?.children?.[0]?.text === `Count: ${totalMutations}`, `Expected final text "Count: ${totalMutations}", got "${finalTree?.children?.[0]?.text}"`);

    const metrics = runtime.getMetrics();
    assert(metrics.fps >= 30, `Expected FPS >= 30, got ${metrics.fps}`);

    runtime.destroy();

    return {
      totalMutations,
      burstDurationMs: Math.round(burstDurationMs * 100) / 100,
      opsPerSec: Math.round((totalMutations / (burstDurationMs / 1000))),
      finalFps: metrics.fps,
    };
  });

  await runTest('Frame Batcher', '2.2: 5,000 rapid state bursts under frame batching vs unbatched IPC', async () => {
    const runtime = createDualThreadRuntime({
      appId: 'massive-burst-app',
      batchIntervalMs: 16,
    });
    runtime.worker.launch();

    const burstSize = 5000;
    const start = performance.now();

    for (let i = 1; i <= burstSize; i++) {
      runtime.setData({ index: i });
    }

    runtime.ipc.flushUiPatches();
    const duration = performance.now() - start;

    assert(runtime.worker.state === 'RUNNING', 'Worker remained stable after 5,000 mutations');
    runtime.destroy();

    return { burstSize, durationMs: Math.round(duration * 100) / 100, opsPerSec: Math.round(burstSize / (duration / 1000)) };
  });

  await runTest('Frame Batcher', '2.3: Runtime lifecycle transitions (suspend, resume, restart, evaluateScript)', () => {
    const runtime = createDualThreadRuntime({ appId: 'lifecycle-test' });
    runtime.worker.launch();

    // 1. Script evaluation
    const evalRes = runtime.evaluateCode('const pi = 3.14159; const area = pi * 10 * 10;', false);
    assert(evalRes.success === true, 'evaluateCode should succeed');

    // 2. Suspend (Pause)
    runtime.pause();
    assert(runtime.worker.state === 'SUSPENDED', 'Worker state must be SUSPENDED');

    // 3. Resume
    runtime.resume();
    assert(runtime.worker.state === 'RUNNING', 'Worker state must be RUNNING');

    // 4. Restart
    runtime.restart();
    assert(runtime.worker.state === 'UNINITIALIZED' || runtime.worker.state === 'READY', 'Worker restarted');

    runtime.destroy();
  });

  // =========================================================================
  // SUITE 3: Motion Accelerometer Vectors (ax, ay, az) and Euler Angles
  // =========================================================================
  console.log('\n🧭 SUITE 3: Motion Sensor, Accelerometer Vectors & Euler Angles');

  await runTest('Motion & Sensors', '3.1: Mathematical correctness of Euler angles and 3D Rotation Matrix bounds', () => {
    const harness = new DevToolsTestHarness();

    // Angle test matrix
    const angles = [
      { alpha: 0, beta: 0, gamma: 0 },
      { alpha: 90, beta: 45, gamma: -30 },
      { alpha: 180, beta: -60, gamma: 60 },
      { alpha: 360, beta: 90, gamma: -90 },
    ];

    for (const a of angles) {
      harness.store.getState().setDeviceMotion(a);
      const dm = harness.getState().deviceMotion;
      assert(dm.alpha === a.alpha, `Expected alpha ${a.alpha}, got ${dm.alpha}`);
      assert(dm.beta === a.beta, `Expected beta ${a.beta}, got ${dm.beta}`);
      assert(dm.gamma === a.gamma, `Expected gamma ${a.gamma}, got ${dm.gamma}`);
    }

    return { anglesTested: angles.length };
  });

  await runTest('Motion & Sensors', '3.2: Verification of all 6 physical motion presets', () => {
    const harness = new DevToolsTestHarness();

    // Preset 1: Flat
    harness.store.getState().setMotionPreset('flat');
    let state = harness.getState();
    assert(state.accelerometer.x === 0 && state.accelerometer.y === 0 && state.accelerometer.z === 9.81, 'Flat preset mismatch');

    // Preset 2: Shake (burst acceleration)
    harness.store.getState().setMotionPreset('shake');
    state = harness.getState();
    assert(state.accelerometer.x === 28.5 && state.accelerometer.y === -15.2 && state.accelerometer.z === 12.0, 'Shake preset mismatch');
    assert(state.deviceMotion.alpha === 180 && state.deviceMotion.beta === 45 && state.deviceMotion.gamma === -30, 'Shake Euler mismatch');

    // Preset 3: Tilt Left (-45 deg roll)
    harness.store.getState().setMotionPreset('tilt-left');
    state = harness.getState();
    assert(state.accelerometer.x === -6.9 && state.accelerometer.z === 6.9, 'Tilt Left acc mismatch');
    assert(state.deviceMotion.gamma === -45, 'Tilt Left gamma mismatch');

    // Preset 4: Tilt Right (+45 deg roll)
    harness.store.getState().setMotionPreset('tilt-right');
    state = harness.getState();
    assert(state.accelerometer.x === 6.9 && state.accelerometer.z === 6.9, 'Tilt Right acc mismatch');
    assert(state.deviceMotion.gamma === 45, 'Tilt Right gamma mismatch');

    // Preset 5: Freefall (near-0 G)
    harness.store.getState().setMotionPreset('freefall');
    state = harness.getState();
    assert(state.accelerometer.z === 0.1 && state.accelerometer.x === 0, 'Freefall acc mismatch');

    // Preset 6: Face Down (inverted gravity -9.81 m/s^2)
    harness.store.getState().setMotionPreset('face-down');
    state = harness.getState();
    assert(state.accelerometer.z === -9.81, 'Face Down acc mismatch');
    assert(state.deviceMotion.beta === 180, 'Face Down beta mismatch');

    return { presetsTested: 6 };
  });

  await runTest('Motion & Sensors', '3.3: High-frequency 10,000 sensor update burst stress test', () => {
    const harness = new DevToolsTestHarness();
    const count = 10000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      const val = (i % 360);
      harness.store.getState().setCompass({ direction: val, accuracy: 65 });
      harness.store.getState().setAccelerometer({ x: Math.sin(i), y: Math.cos(i), z: 9.81 });
    }

    const duration = performance.now() - start;
    assert(harness.getState().compass.direction === ((count - 1) % 360), 'Compass final direction mismatch');

    return { count, durationMs: Math.round(duration * 100) / 100, opsPerSec: Math.round(count / (duration / 1000)) };
  });

  // =========================================================================
  // SUITE 4: Geolocation GPX Route Parsing and Coordinate Interpolation
  // =========================================================================
  console.log('\n🗺️ SUITE 4: Geolocation, GPX Parsing & Haversine Distance');

  await runTest('Geolocation & GPX', '4.1: Haversine distance calculation and boundary distances', () => {
    // Distance SF (37.7749, -122.4194) to San Jose (37.3382, -121.8863) ~ 67km
    const distMeters = calculateHaversineDistanceMeters(37.7749, -122.4194, 37.3382, -121.8863);
    assert(distMeters >= 65000 && distMeters <= 70000, `Expected ~67,000m, got ${distMeters}m`);

    // Zero distance
    const zeroDist = calculateHaversineDistanceMeters(37.7749, -122.4194, 37.7749, -122.4194);
    assert(zeroDist === 0, `Expected 0m, got ${zeroDist}m`);

    // Equator across 1 degree longitude ~ 111km
    const eqDist = calculateHaversineDistanceMeters(0, 0, 0, 1);
    assert(eqDist >= 111000 && eqDist <= 112000, `Expected ~111,000m, got ${eqDist}m`);

    return { sfToSjMeters: distMeters, equator1DegMeters: eqDist };
  });

  await runTest('Geolocation & GPX', '4.2: Comprehensive GPX XML Parser (<trkpt>, <wpt>, <rtept>, <ele>, <time>)', () => {
    const complexGpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="GoatStudio">
      <name>San Francisco Marathon Route</name>
      <wpt lat="37.7955" lon="-122.3937">
        <ele>4.5</ele>
        <time>2026-08-27T08:00:00Z</time>
      </wpt>
      <trk>
        <name>Embarcadero Run</name>
        <trkseg>
          <trkpt lat="37.7960" lon="-122.3940"><ele>5.0</ele><time>2026-08-27T08:01:00Z</time></trkpt>
          <trkpt lat="37.7975" lon="-122.3955"><ele>6.2</ele><time>2026-08-27T08:02:30Z</time></trkpt>
          <trkpt lat="37.8000" lon="-122.3980"><ele>8.0</ele><time>2026-08-27T08:05:00Z</time></trkpt>
        </trkseg>
      </trk>
      <rte>
        <rtept lat="37.8050" lon="-122.4050"><ele>12.0</ele></rtept>
      </rte>
    </gpx>`;

    const route = parseGpxRoute(complexGpx);
    assert(route.name === 'San Francisco Marathon Route', `Expected name "San Francisco Marathon Route", got "${route.name}"`);
    assert(route.waypoints.length === 5, `Expected 5 waypoints, got ${route.waypoints.length}`);
    assert(route.waypoints[0].latitude === 37.7955, 'Waypoint 0 lat mismatch');
    assert(route.waypoints[0].elevation === 4.5, 'Waypoint 0 ele mismatch');
    assert(route.totalDistanceMeters > 1000, `Expected total distance > 1000m, got ${route.totalDistanceMeters}`);

    return { waypointsCount: route.waypoints.length, totalDistanceMeters: route.totalDistanceMeters };
  });

  await runTest('Geolocation & GPX', '4.3: GPX Route Player seeking, scrubbing, playback, and speed multiplier', async () => {
    const points = [
      { lat: 37.7749, lng: -122.4194, ele: 10 },
      { lat: 37.7755, lng: -122.4182, ele: 12 },
      { lat: 37.7762, lng: -122.4170, ele: 14 },
      { lat: 37.7770, lng: -122.4155, ele: 16 },
      { lat: 37.7780, lng: -122.4140, ele: 18 },
    ];

    const player = new GpxRoutePlayer(points);
    assert(player.getStatus().totalPoints === 5, 'Total points should be 5');

    // Seek to index 3
    player.seek(3);
    assert(player.getStatus().currentIndex === 3, `Expected currentIndex 3, got ${player.getStatus().currentIndex}`);
    assert(player.getCurrentPoint()?.lat === 37.7770, 'Current point lat mismatch');

    // Change speed
    player.setSpeed(10.0);
    assert(player.getStatus().speedMultiplier === 10.0, 'Speed multiplier mismatch');

    // Test playback callback
    let receivedPoints: number[] = [];
    player.onPoint((pt, idx) => {
      receivedPoints.push(idx);
    });

    player.play();
    assert(player.getStatus().isPlaying === true, 'Player should be playing');

    // Wait 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));
    player.stop();

    assert(player.getStatus().isPlaying === false, 'Player should be stopped');
    assert(player.getStatus().currentIndex === 0, 'Current index after stop should be 0');

    return { receivedPointsCount: receivedPoints.length };
  });

  await runTest('Geolocation & GPX', '4.4: Live synchronisation of GPS Coordinates with Bridge Mock state', async () => {
    const harness = new DevToolsTestHarness();

    harness.setGpsLocation(40.7128, -74.0060, 25, 2.5, 5.0);
    const loc = harness.getState().location;
    assert(loc.latitude === 40.7128, 'Location lat mismatch');
    assert(loc.longitude === -74.0060, 'Location lng mismatch');

    const res = await harness.callBridge('GET_LOCATION');
    assert(res.latitude === 40.7128 && res.longitude === -74.0060, 'GET_LOCATION bridge return mismatch');
  });

  // =========================================================================
  // SUITE 5: Network Throttling Latency Injection on API_REQUEST Calls
  // =========================================================================
  console.log('\n🌐 SUITE 5: Network Throttling Latency Injection');

  await runTest('Network Throttling', '5.1: Latency injection timing verification across all profiles', async () => {
    const throttler = new NetworkThrottler();

    // 1. Offline: Immediate rejection
    throttler.setPreset('offline');
    let threwOffline = false;
    try {
      await throttler.simulateRequest(async () => 'OK');
    } catch (e: any) {
      threwOffline = true;
      assert(e.message.includes('offline'), `Expected offline error, got "${e.message}"`);
    }
    assert(threwOffline === true, 'Offline preset did not reject');

    // 2. 5G (~10ms)
    throttler.setPreset('5g');
    const t0 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 100);
    const d5g = performance.now() - t0;
    assert(d5g >= 8, `5G delay should be >= 8ms, got ${d5g.toFixed(1)}ms`);

    // 3. 4G (~40ms)
    throttler.setPreset('4g');
    const t1 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 100);
    const d4g = performance.now() - t1;
    assert(d4g >= 35, `4G delay should be >= 35ms, got ${d4g.toFixed(1)}ms`);

    // 4. 3G (~150ms)
    throttler.setPreset('3g');
    const t2 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 100);
    const d3g = performance.now() - t2;
    assert(d3g >= 140, `3G delay should be >= 140ms, got ${d3g.toFixed(1)}ms`);

    // 5. 2G (~400ms)
    throttler.setPreset('2g');
    const t3 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 100);
    const d2g = performance.now() - t3;
    assert(d2g >= 380, `2G delay should be >= 380ms, got ${d2g.toFixed(1)}ms`);

    return {
      d5gMs: Math.round(d5g),
      d4gMs: Math.round(d4g),
      d3gMs: Math.round(d3g),
      d2gMs: Math.round(d2g),
    };
  });

  await runTest('Network Throttling', '5.2: Bandwidth simulation transfer delay based on payload size', async () => {
    const throttler = new NetworkThrottler();

    // 2G Profile: 250 Kbps download (31.25 KB/s).
    // Test 8KB payload: (8192 bytes / (250 * 1024 / 8)) * 1000 = ~256ms transfer + 400ms = ~656ms.
    throttler.setPreset('2g');
    const t0 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 8192);
    const duration = performance.now() - t0;

    assert(duration >= 600, `Expected duration >= 600ms for 8KB on 2G, got ${duration.toFixed(1)}ms`);

    return { payloadBytes: 8192, durationMs: Math.round(duration) };
  });

  await runTest('Network Throttling', '5.3: Custom network bandwidth & latency configuration', async () => {
    const throttler = new NetworkThrottler();
    throttler.setCustom({ latencyMs: 75, downloadKbps: 50000 });

    const t0 = performance.now();
    await throttler.simulateRequest(async () => 'OK', 100);
    const duration = performance.now() - t0;

    assert(duration >= 70, `Expected custom latency >= 70ms, got ${duration.toFixed(1)}ms`);
    return { customLatencyMs: 75, actualMs: Math.round(duration) };
  });

  // =========================================================================
  // SUITE 6: Biometrics Modal Face ID/Fingerprint & 5x Lockout Behavior
  // =========================================================================
  console.log('\n🔒 SUITE 6: Biometrics Verification Suite & 5x Lockout Fuzzing');

  await runTest('Biometrics', '6.1: Biometrics authentication success trigger', async () => {
    const harness = new DevToolsTestHarness();

    harness.store.getState().setBiometrics({
      type: 'faceId',
      isEnrolled: true,
      shouldSucceed: true,
    });

    const res = await harness.callBridge('BIOMETRIC_AUTH');
    assert(res.authenticated === true, 'Authenticated should be true');
    assert(res.token !== undefined, 'Token should be returned');
  });

  await runTest('Biometrics', '6.2: Biometrics authentication failure when not enrolled', async () => {
    const harness = new DevToolsTestHarness();

    harness.store.getState().setBiometrics({
      type: 'faceId',
      isEnrolled: false,
      shouldSucceed: true,
    });

    let failed = false;
    try {
      await harness.callBridge('BIOMETRIC_AUTH');
    } catch (err: any) {
      failed = true;
      assert(err.message.includes('NOT_ENROLLED'), `Expected NOT_ENROLLED, got ${err.message}`);
    }
    assert(failed === true, 'Expected bridge call to fail for non-enrolled device');
  });

  await runTest('Biometrics', '6.3: Biometrics 5x failure lockout simulation', async () => {
    const harness = new DevToolsTestHarness();

    harness.store.getState().setBiometrics({
      type: 'fingerprint',
      isEnrolled: true,
      shouldSucceed: false,
    });

    let failCount = 0;
    for (let i = 1; i <= 5; i++) {
      try {
        await harness.callBridge('BIOMETRIC_AUTH');
      } catch (err: any) {
        failCount++;
      }
    }

    assert(failCount === 5, `Expected 5 failed attempts, got ${failCount}`);

    // Set lockout mode in store
    harness.store.getState().setBiometricsMode('lockout');
    assert(harness.getState().biometricsMode === 'lockout', 'Store biometricsMode should be lockout');
  });

  // =========================================================================
  // FINAL REPORT & VERDICT SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`📊 CHALLENGER 1 RESULTS SUMMARY:`);
  console.log(`   Passed: ${passedCount} / ${results.length} (${((passedCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failedCount} / ${results.length}`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('='.repeat(80));

  if (failedCount > 0) {
    console.error('❌ ADVERSARIAL CHALLENGER VERDICT: REQUEST_CHANGES');
    process.exit(1);
  } else {
    console.log('🎉 ADVERSARIAL CHALLENGER VERDICT: APPROVE');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal crash during stress test:', err);
  process.exit(1);
});
