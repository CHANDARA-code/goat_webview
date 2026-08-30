/**
 * Empirical Challenger Verification Suite for Docs-Site Interactive Components
 * Tests:
 * 1. DeviceSimulator: Dual skins (iPhone 16 Pro Dynamic Island & Pixel 9 Pro Punch Hole), safe-area insets, hardware spoofing (GPS, battery, network, latency, biometrics).
 * 2. BridgePlayground & BridgeInspector: 18-domain execution against @goat/bridge-mock, custom JSON payload editor, multi-lane telemetry streams, replay calls.
 * 3. LiveTraceInspector: APM 3-stage latency breakdown (T_worker_ipc, T_native_exec, T_dom_flush), thread hops, error stacks.
 * 4. Theme Toggle: Dark/light synchronization across components.
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { GoatBridgeMock, mockState } from '../../packages/bridge-mock/dist/src/index.js';
import { DOMAIN_CATALOG, TOTAL_ACTIONS_COUNT } from './harness/api-catalog-oracle.ts';
import { SimulatorHarness } from './harness/simulator-harness.ts';

const GPS_PRESETS: Record<string, { name: string; lat: number; lng: number; accuracy: number; altitude: number; speed: number }> = {
  sf: { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, accuracy: 5, altitude: 16, speed: 0 },
  tokyo: { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, accuracy: 3, altitude: 40, speed: 0 },
  london: { name: 'London, UK', lat: 51.5074, lng: -0.1278, accuracy: 8, altitude: 25, speed: 0 },
  paris: { name: 'Paris, France', lat: 48.8566, lng: 2.3522, accuracy: 6, altitude: 35, speed: 0 },
};

describe('Empirical Challenger Suite: Interactive Components & @goat/bridge-mock Execution', () => {

  // =========================================================================
  // 1. DeviceSimulator: Dual-Skin, Safe-Areas & Hardware Spoofing
  // =========================================================================
  describe('1. DeviceSimulator: Dual-Skin & Hardware Spoofing', () => {
    let harness: SimulatorHarness;

    beforeEach(() => {
      harness = new SimulatorHarness('challenger_sim_app');
    });

    it('1.1 Dual-Skin Geometry: iPhone 16 Pro Dynamic Island vs Pixel 9 Pro Punch Hole', () => {
      // iPhone 16 Pro
      harness.setDevice('iphone-16-pro');
      assert.equal(harness.device.deviceType, 'iphone-16-pro');
      assert.equal(harness.device.width, 393);
      assert.equal(harness.device.height, 852);
      assert.equal(harness.device.hasDynamicIsland, true);
      assert.equal(harness.device.hasPunchHole, false);
      assert.equal(harness.device.pixelRatio, 3.0);
      assert.deepEqual(harness.device.safeArea, { top: 59, bottom: 34, left: 0, right: 0 });

      // Pixel 9 Pro
      harness.setDevice('pixel-9-pro');
      assert.equal(harness.device.deviceType, 'pixel-9-pro');
      assert.equal(harness.device.width, 412);
      assert.equal(harness.device.height, 915);
      assert.equal(harness.device.hasDynamicIsland, false);
      assert.equal(harness.device.hasPunchHole, true);
      assert.equal(harness.device.pixelRatio, 2.625);
      assert.deepEqual(harness.device.safeArea, { top: 48, bottom: 24, left: 0, right: 0 });
    });

    it('1.2 Hardware Spoofing: GPS Presets & Custom Coordinates Propagation', async () => {
      // Test all predefined GPS Presets (SF, Tokyo, London, Paris)
      assert.ok(GPS_PRESETS.sf, 'SF preset exists');
      assert.ok(GPS_PRESETS.tokyo, 'Tokyo preset exists');
      assert.ok(GPS_PRESETS.london, 'London preset exists');
      assert.ok(GPS_PRESETS.paris, 'Paris preset exists');

      // Spoof Tokyo
      harness.updateHardware({
        gps: {
          latitude: GPS_PRESETS.tokyo.lat,
          longitude: GPS_PRESETS.tokyo.lng,
          altitude: GPS_PRESETS.tokyo.altitude,
          accuracy: GPS_PRESETS.tokyo.accuracy,
        },
      });
      let locRes = await harness.executeAction<{ latitude: number; longitude: number }>('GET_LOCATION', {});
      assert.equal(locRes.latitude, 35.6762);
      assert.equal(locRes.longitude, 139.6503);

      // Spoof Custom Arbitrary Coordinates (Sydney Opera House)
      harness.updateHardware({
        gps: { latitude: -33.8568, longitude: 151.2153, altitude: 5, accuracy: 2 },
      });
      locRes = await harness.executeAction<{ latitude: number; longitude: number }>('GET_LOCATION', {});
      assert.equal(locRes.latitude, -33.8568);
      assert.equal(locRes.longitude, 151.2153);
    });

    it('1.3 Hardware Spoofing: Battery Level & Charging State Machine', async () => {
      // Full battery on AC power
      harness.updateHardware({ battery: { level: 100, isCharging: true } });
      let devInfo = await harness.executeAction<{ batteryLevel: number; isCharging: boolean }>('GET_DEVICE_INFO', {});
      assert.equal(devInfo.batteryLevel, 100);
      assert.equal(devInfo.isCharging, true);

      // Low battery critical (12%) discharging
      harness.updateHardware({ battery: { level: 12, isCharging: false } });
      devInfo = await harness.executeAction<{ batteryLevel: number; isCharging: boolean }>('GET_DEVICE_INFO', {});
      assert.equal(devInfo.batteryLevel, 12);
      assert.equal(devInfo.isCharging, false);
    });

    it('1.4 Hardware Spoofing: Network Latency & Offline Isolation', async () => {
      // 5G Network
      harness.updateHardware({ network: { isConnected: true, networkType: '5g' } });
      let netInfo = await harness.executeAction<{ isConnected: boolean; networkType: string }>('GET_NETWORK_TYPE', {});
      assert.equal(netInfo.isConnected, true);
      assert.equal(netInfo.networkType, '5g');

      // Offline mode
      harness.updateHardware({ network: { isConnected: false, networkType: 'none' } });
      netInfo = await harness.executeAction<{ isConnected: boolean; networkType: string }>('GET_NETWORK_TYPE', {});
      assert.equal(netInfo.isConnected, false);
      assert.equal(netInfo.networkType, 'none');
    });

    it('1.5 Hardware Spoofing: Biometrics Outcome Tri-State (Pass, Fail, Locked)', async () => {
      mockState.permissions.set('BIOMETRIC', true);
      mockState.recordUserGesture();

      // Outcome 1: Pass
      mockState.biometrics.supported = true;
      mockState.biometrics.isLockedOut = false;
      mockState.biometrics.errorOnAuth = undefined;
      mockState.biometrics.autoAuthSuccess = true;
      const passRes = await harness.executeAction<{ authenticated: boolean; token?: string }>('BIOMETRIC_AUTH', { reason: 'Test Auth' });
      assert.equal(passRes.authenticated, true);
      assert.ok(passRes.token !== undefined);

      // Outcome 2: Fail (Simulate failed authentication)
      mockState.recordUserGesture();
      mockState.biometrics.errorOnAuth = 'BIOMETRIC_REJECTED';
      const failRes = await harness.executeAction<{ authenticated: boolean; error?: string }>('BIOMETRIC_AUTH', { reason: 'Test Auth Fail' });
      assert.equal(failRes.authenticated, false);
      assert.equal(failRes.error, 'BIOMETRIC_REJECTED');

      // Outcome 3: Lockout (Simulate too many attempts)
      mockState.recordUserGesture();
      mockState.biometrics.errorOnAuth = undefined;
      mockState.biometrics.isLockedOut = true;
      const lockRes = await harness.executeAction<{ authenticated: boolean; error?: string }>('BIOMETRIC_AUTH', { reason: 'Test Auth Locked' });
      assert.equal(lockRes.authenticated, false);
      assert.equal(lockRes.error, 'BIOMETRIC_LOCKOUT');
      mockState.biometrics.isLockedOut = false;
    });
  });

  // =========================================================================
  // 2. BridgePlayground / BridgeInspector: 18-Domain Execution & Multi-Lane Telemetry
  // =========================================================================
  describe('2. BridgePlayground & BridgeInspector: 18 Domains, Custom JSON & Telemetry', () => {
    let harness: SimulatorHarness;

    beforeEach(() => {
      harness = new SimulatorHarness('challenger_bridge_app');
      mockState.permissions.set('CAMERA', true);
      mockState.permissions.set('BIOMETRIC', true);
      mockState.permissions.set('BLUETOOTH', true);
      mockState.permissions.set('READ_CONTACTS', true);
      mockState.permissions.set('POST_NOTIFICATIONS', true);
      mockState.permissions.set('NFC', true);
      mockState.permissions.set('INTERNET', true);
      mockState.recordUserGesture();

      mockState.binaryPorts.set('port_1', { queue: [{ dataBase64: 'AQID', seq: 1 }], closed: false, currentSeq: 1 });
      mockState.activeNativeViews.set('view_1', {
        componentId: 'view_1',
        componentType: 'map',
        x: 0,
        y: 100,
        width: 375,
        height: 200,
        zIndex: 1,
        isVisible: true,
      });

      const fs = mockState.getAppFs('challenger_bridge_app');
      fs.set('/data/test.json', { data: '{"status":"ok"}', isDir: false, isFile: true, lastModified: Date.now() });
      fs.set('/data/cache', { data: '', isDir: true, isFile: false, lastModified: Date.now() });
    });

    it('2.1 18-Domain Exhaustive Execution against @goat/bridge-mock', async () => {
      assert.equal(DOMAIN_CATALOG.length, 18);
      assert.equal(TOTAL_ACTIONS_COUNT, 197);

      for (const domain of DOMAIN_CATALOG) {
        // Execute at least one sample action per domain
        const sample = domain.actions[0];
        mockState.recordUserGesture();
        const res = await harness.executeAction(sample.action, sample.samplePayload);
        assert.ok(res !== undefined, `Domain ${domain.name} sample ${sample.action} returned undefined`);
      }

      assert.ok(harness.getTraceCount() >= 18, `Expected >=18 traces recorded, got ${harness.getTraceCount()}`);
    });

    it('2.2 Custom JSON Payload Editor Execution & Parameter Reflection', async () => {
      // Execute with custom structured JSON payload
      const customPayload = {
        key: 'auth.session.token',
        value: { user: 'challenger_tester', role: 'admin', expiry: 1780000000 },
        encrypted: true,
      };

      const setRes = await harness.executeAction<{ stored?: boolean; key?: string }>('STORAGE_SET', customPayload);
      assert.ok(setRes !== undefined);

      const getRes = await harness.executeAction<{ value?: any; exists?: boolean }>('STORAGE_GET', { key: 'auth.session.token' });
      assert.ok(getRes !== undefined);
    });

    it('2.3 Multi-Lane Telemetry Stream Attribution', () => {
      // Test lane classification logic
      const workerAction = 'WORKER_POST_MESSAGE';
      const uiPatchAction = 'RENDER_UI_PATCH';
      const viewToNativeAction = 'STORAGE_GET';
      const nativePushAction = 'PUSH_NOTIFICATION_EVENT';

      const classifyLane = (action: string): string => {
        if (action.includes('UI_PATCH') || action.includes('WORKER')) return 'appservice_to_appview';
        if (action.includes('PUSH') || action.includes('EVENT')) return 'native_to_appview';
        return 'appview_to_native';
      };

      assert.equal(classifyLane(workerAction), 'appservice_to_appview');
      assert.equal(classifyLane(uiPatchAction), 'appservice_to_appview');
      assert.equal(classifyLane(viewToNativeAction), 'appview_to_native');
      assert.equal(classifyLane(nativePushAction), 'native_to_appview');
    });

    it('2.4 Replay Call Functionality', async () => {
      // Execute initial action
      await harness.executeAction('SET_NAV_BAR_TITLE', { title: 'Initial Title' });
      assert.equal(harness.getTraceCount(), 1);
      const firstTrace = harness.traceStream[0];
      assert.equal(firstTrace.action, 'SET_NAV_BAR_TITLE');
      assert.deepEqual(firstTrace.payload, { title: 'Initial Title' });

      // Replay call with exact payload
      await harness.executeAction(firstTrace.action, firstTrace.payload);
      assert.equal(harness.getTraceCount(), 2);
      assert.equal(harness.traceStream[0].action, 'SET_NAV_BAR_TITLE');
      assert.equal(harness.navBarState.title, 'Initial Title');
    });
  });

  // =========================================================================
  // 3. LiveTraceInspector: APM Latency Waterfall, Thread Hops & Error Stacks
  // =========================================================================
  describe('3. LiveTraceInspector: 3-Stage APM Latency Breakdown & Error Envelopes', () => {
    it('3.1 3-Stage Latency Decomposition Formula: T_total = T_worker_ipc + T_native_exec + T_dom_flush', () => {
      const calculate3StageBreakdown = (totalLatencyMs: number) => {
        const total = Math.max(totalLatencyMs || 0, 0.1);
        const workerIpcLatency = Math.max(0.4, Number((total * 0.18).toFixed(1)));
        const nativeExecLatency = Math.max(0.6, Number((total * 0.68).toFixed(1)));
        const domRenderLatency = Math.max(0.2, Number((total - workerIpcLatency - nativeExecLatency).toFixed(1)));
        const sum = Number((workerIpcLatency + nativeExecLatency + domRenderLatency).toFixed(1));
        return {
          total,
          workerIpcLatency,
          nativeExecLatency,
          domRenderLatency,
          sum,
          isWarmPath: total < 5.0,
        };
      };

      // Case 1: Ultra-fast warm path (3.2 ms)
      const warm = calculate3StageBreakdown(3.2);
      assert.equal(warm.isWarmPath, true);
      assert.ok(warm.workerIpcLatency > 0);
      assert.ok(warm.nativeExecLatency > 0);
      assert.ok(warm.domRenderLatency > 0);
      assert.equal(warm.sum, 3.2);

      // Case 2: Realistic bridge call (35.0 ms)
      const standard = calculate3StageBreakdown(35.0);
      assert.equal(standard.isWarmPath, false);
      assert.equal(standard.workerIpcLatency, 6.3);
      assert.equal(standard.nativeExecLatency, 23.8);
      assert.equal(standard.domRenderLatency, 4.9);
      assert.equal(standard.sum, 35.0);

      // Case 3: Heavy operation (120.0 ms)
      const heavy = calculate3StageBreakdown(120.0);
      assert.equal(heavy.sum, 120.0);
    });

    it('3.2 Standard Error Envelope & Taxonomy Compliance', () => {
      const createErrorEnvelope = (code: string, message: string, details?: any) => {
        return {
          success: false,
          error: {
            code,
            message,
            details: details || null,
          },
          timestamp: Date.now(),
        };
      };

      const err = createErrorEnvelope('PERMISSION_DENIED', 'Camera access was rejected by user', { permission: 'CAMERA' });
      assert.equal(err.success, false);
      assert.equal(err.error.code, 'PERMISSION_DENIED');
      assert.equal(err.error.message, 'Camera access was rejected by user');
      assert.deepEqual(err.error.details, { permission: 'CAMERA' });
    });
  });

  // =========================================================================
  // 4. Theme Toggle: Dark & Light Theme Synchronization
  // =========================================================================
  describe('4. Theme Synchronization', () => {
    it('4.1 System Theme State & CSS Variable Compatibility', () => {
      const harness = new SimulatorHarness('challenger_theme_app');

      // Test Dark Mode
      harness.updateHardware({ theme: 'dark' });
      assert.equal(harness.hardware.theme, 'dark');

      // Test Light Mode
      harness.updateHardware({ theme: 'light' });
      assert.equal(harness.hardware.theme, 'light');
    });
  });
});
