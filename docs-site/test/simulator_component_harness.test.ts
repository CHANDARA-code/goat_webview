/**
 * Simulator & Native Component Playground Test Suite
 * Deep integration tests for the 6 native widgets, device frames, hardware controllers, and IPC telemetry stream.
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';

import { SimulatorHarness } from './harness/simulator-harness.ts';
import { mockState } from '../../packages/bridge-mock/dist/src/index.js';

describe('Simulator & Native Component Playground Suite', () => {
  let harness: SimulatorHarness;

  beforeEach(() => {
    harness = new SimulatorHarness('app_component_playground');
    mockState.permissions.set('BIOMETRIC', true);
    mockState.permissions.set('CAMERA', true);
    mockState.recordUserGesture();
  });

  // ---------------------------------------------------------------------------
  // 1. Device Frames & Hardware Controls
  // ---------------------------------------------------------------------------
  describe('Device Frame & Hardware Simulation', () => {
    it('switches between iPhone 16 Pro and Pixel 9 Pro device frames', () => {
      harness.setDevice('iphone-16-pro');
      assert.equal(harness.device.deviceType, 'iphone-16-pro');
      assert.equal(harness.device.hasDynamicIsland, true);
      assert.equal(harness.device.safeArea.top, 59);

      harness.setDevice('pixel-9-pro');
      assert.equal(harness.device.deviceType, 'pixel-9-pro');
      assert.equal(harness.device.hasPunchHole, true);
      assert.equal(harness.device.safeArea.top, 48);
    });

    it('mutates hardware battery status and reflects in GET_DEVICE_INFO', async () => {
      harness.updateHardware({ battery: { level: 42, isCharging: true } });
      const info = await harness.executeAction<{ batteryLevel: number; isCharging: boolean }>('GET_DEVICE_INFO', {});
      assert.equal(info.batteryLevel, 42);
      assert.equal(info.isCharging, true);
    });

    it('mutates GPS coordinates and reflects in GET_LOCATION', async () => {
      harness.updateHardware({
        gps: { latitude: 37.7749, longitude: -122.4194, altitude: 15, accuracy: 5 },
      });
      const loc = await harness.executeAction<{ latitude: number; longitude: number }>('GET_LOCATION', {});
      assert.equal(loc.latitude, 37.7749);
      assert.equal(loc.longitude, -122.4194);
    });

    it('mutates network connectivity status and reflects in GET_NETWORK_TYPE', async () => {
      harness.updateHardware({ network: { isConnected: false, networkType: 'none' } });
      const net = await harness.executeAction<{ isConnected: boolean; networkType: string }>('GET_NETWORK_TYPE', {});
      assert.equal(net.isConnected, false);
      assert.equal(net.networkType, 'none');
    });

    it('toggles light/dark system theme', () => {
      harness.updateHardware({ theme: 'dark' });
      assert.equal(harness.hardware.theme, 'dark');

      harness.updateHardware({ theme: 'light' });
      assert.equal(harness.hardware.theme, 'light');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Widget 1: GoatNavigationBar
  // ---------------------------------------------------------------------------
  describe('Widget 1: GoatNavigationBar', () => {
    it('sets navigation bar title and subtitle', async () => {
      const res = await harness.executeAction<{ title: string; subtitle?: string }>('SET_NAV_BAR_TITLE', {
        title: 'Product Details',
        subtitle: 'SKU #90123',
      });
      assert.equal(res.title, 'Product Details');
      assert.equal(res.subtitle, 'SKU #90123');
      assert.equal(harness.navBarState.title, 'Product Details');
    });

    it('sets navigation bar background and text colors', async () => {
      const res = await harness.executeAction<{ backgroundColor: string; textColor: string; isDark: boolean }>('SET_NAV_BAR_COLOR', {
        backgroundColor: '#1e1e2e',
        textColor: '#cdd6f4',
        isDark: true,
      });
      assert.equal(res.backgroundColor, '#1e1e2e');
      assert.equal(res.textColor, '#cdd6f4');
      assert.equal(res.isDark, true);
    });

    it('toggles navigation bar progress indicator', async () => {
      const res = await harness.executeAction<{ visible: boolean; progress: number }>('SET_NAV_BAR_PROGRESS', {
        visible: true,
        progress: 75,
      });
      assert.equal(res.visible, true);
      assert.equal(res.progress, 75);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Widget 2: GoatBottomSheet
  // ---------------------------------------------------------------------------
  describe('Widget 2: GoatBottomSheet', () => {
    it('configures custom snap points and dismissibility', async () => {
      const res = await harness.executeAction<{ snapPoints: number[]; isDismissible: boolean }>('SET_SHEET_SNAP_POINTS', {
        snapPoints: [0.3, 0.6, 0.95],
        initialSnap: 1,
        isDismissible: true,
      });
      assert.deepEqual(res.snapPoints, [0.3, 0.6, 0.95]);
      assert.equal(res.isDismissible, true);
    });

    it('expands and collapses bottom sheet with state tracking', async () => {
      const expandRes = await harness.executeAction<{ isExpanded: boolean }>('EXPAND_BOTTOM_SHEET', {});
      assert.equal(expandRes.isExpanded, true);
      assert.equal(harness.bottomSheetState.isOpen, true);

      const collapseRes = await harness.executeAction<{ isCollapsed: boolean }>('COLLAPSE_BOTTOM_SHEET', {});
      assert.equal(collapseRes.isCollapsed, true);
      assert.equal(harness.bottomSheetState.isOpen, false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Widget 3: GoatPermissionPrimingDialog
  // ---------------------------------------------------------------------------
  describe('Widget 3: GoatPermissionPrimingDialog', () => {
    it('requests permission with educational rationale dialog', async () => {
      const res = await harness.executeAction<{ scope: string; granted: boolean }>('REQUEST_PERMISSION', {
        scope: 'CAMERA',
        rationale: 'Camera access is required to scan shipping labels.',
      });
      assert.equal(res.scope, 'CAMERA');
      assert.equal(res.granted, true);
    });

    it('queries permission status without prompting user', async () => {
      const res = await harness.executeAction<{ scope: string; granted: boolean }>('CHECK_PERMISSION', {
        scope: 'CAMERA',
      });
      assert.equal(res.scope, 'CAMERA');
      assert.equal(res.granted, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Widget 4: GoatExternalLinkWarningDialog
  // ---------------------------------------------------------------------------
  describe('Widget 4: GoatExternalLinkWarningDialog', () => {
    it('prompts confirmation warning for external URLs', async () => {
      const res = await harness.executeAction<{ opened: boolean; url: string }>('OPEN_EXTERNAL_LINK', {
        url: 'https://partner-portal.com',
      });
      assert.equal(res.opened, true);
      assert.equal(harness.externalLinkDialogState.isOpen, true);
      assert.equal(harness.externalLinkDialogState.targetUrl, 'https://partner-portal.com');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Widget 5: GoatHaptics
  // ---------------------------------------------------------------------------
  describe('Widget 5: GoatHaptics', () => {
    it('triggers impact haptics (light, medium, heavy)', async () => {
      const light = await harness.executeAction<{ triggered: boolean }>('HAPTIC_FEEDBACK', { type: 'impact', style: 'light' });
      const heavy = await harness.executeAction<{ triggered: boolean }>('HAPTIC_FEEDBACK', { type: 'impact', style: 'heavy' });
      assert.equal(light.triggered, true);
      assert.equal(heavy.triggered, true);
    });

    it('triggers notification haptics (success, warning, error)', async () => {
      const success = await harness.executeAction<{ triggered: boolean }>('HAPTIC_FEEDBACK', { type: 'notification', notificationType: 'success' });
      const error = await harness.executeAction<{ triggered: boolean }>('HAPTIC_FEEDBACK', { type: 'notification', notificationType: 'error' });
      assert.equal(success.triggered, true);
      assert.equal(error.triggered, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Widget 6: GoatBiometricPrompt
  // ---------------------------------------------------------------------------
  describe('Widget 6: GoatBiometricPrompt', () => {
    it('checks biometric hardware support and biometry type', async () => {
      const res = await harness.executeAction<{ supported: boolean; biometryType: string }>('CHECK_BIOMETRIC_SUPPORT', {});
      assert.equal(res.supported, true);
      assert.ok(['faceID', 'touchID', 'biometricPrompt'].includes(res.biometryType));
    });

    it('authenticates user with biometric modal prompt', async () => {
      const res = await harness.executeAction<{ authenticated: boolean }>('BIOMETRIC_AUTH', {
        reason: 'Confirm purchase of $19.99',
      });
      assert.equal(res.authenticated, true);
      assert.equal(harness.biometricsLog.length, 1);
      assert.equal(harness.biometricsLog[0].reason, 'Confirm purchase of $19.99');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Live Bridge IPC Inspector & Trace Pipeline
  // ---------------------------------------------------------------------------
  describe('Live Bridge IPC Inspector & Trace Pipeline', () => {
    it('records and queries live IPC trace records with latency benchmarks', async () => {
      await harness.executeAction('GET_DEVICE_INFO', {});
      await harness.executeAction('STORAGE_SET', { key: 'sample', value: '123' });

      assert.equal(harness.getTraceCount(), 2);
      assert.equal(harness.traceStream[0].action, 'STORAGE_SET');
      assert.equal(harness.traceStream[1].action, 'GET_DEVICE_INFO');

      for (const record of harness.traceStream) {
        assert.ok(record.latencyMs >= 0);
        assert.equal(record.status, 'SUCCESS');
        assert.ok(record.timestamp > 0);
      }
    });

    it('clears trace history buffer on demand', async () => {
      await harness.executeAction('GET_DEVICE_INFO', {});
      assert.equal(harness.getTraceCount(), 1);

      harness.clearTraces();
      assert.equal(harness.getTraceCount(), 0);
    });
  });
});
