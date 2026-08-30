/**
 * r3-hardware-sensors.spec.ts — Tier 1 Feature Coverage for Requirement R3
 * Scope: 3D Motion, Geolocation & GPX, Network Throttling, Battery & Brightness,
 * BLE Peripherals, NFC Tag Generator, and Biometrics Modal.
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import { DevToolsTestHarness } from '../harness/devtools-test-harness.ts';
import { parseGpxXml } from '../../services/gpxParser.ts';

export function registerR3Tests() {
  describe('Tier 1: R3 — Comprehensive Sensor & Hardware Simulation Suite', () => {
    it('T1.R3.01: Motion sensor controller updates 3D Euler angles and accelerometer vectors', () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().setDeviceMotion({ alpha: 90, beta: 45, gamma: -30 });
      expect(harness.getState().deviceMotion.alpha).toBe(90);
      expect(harness.getState().deviceMotion.beta).toBe(45);
      expect(harness.getState().deviceMotion.gamma).toBe(-30);

      harness.store.getState().setAccelerometer({ x: 1.5, y: -2.3, z: 9.8 });
      expect(harness.getState().accelerometer.x).toBe(1.5);
      expect(harness.getState().accelerometer.y).toBe(-2.3);
      expect(harness.getState().accelerometer.z).toBe(9.8);
    });

    it('T1.R3.02: Motion presets apply simulated physical gestures (Shake, Tilt, Freefall, Face Down)', () => {
      const harness = new DevToolsTestHarness();

      harness.applyMotionPreset('shake');
      expect(harness.getState().accelerometer.x).toBeGreaterThan(20);

      harness.applyMotionPreset('tiltLeft');
      expect(harness.getState().deviceMotion.gamma).toBe(-45);

      harness.applyMotionPreset('tiltRight');
      expect(harness.getState().deviceMotion.gamma).toBe(45);

      harness.applyMotionPreset('freefall');
      expect(harness.getState().accelerometer.z).toBeLessThan(1.0);

      harness.applyMotionPreset('faceDown');
      expect(harness.getState().deviceMotion.beta).toBe(180);
    });

    it('T1.R3.03: Geolocation controller sets custom GPS coordinates and feeds GET_LOCATION queries', async () => {
      const harness = new DevToolsTestHarness();

      harness.setGpsLocation(37.7749, -122.4194, 15, 3, 1.2);
      expect(harness.getState().location.latitude).toBe(37.7749);
      expect(harness.getState().location.longitude).toBe(-122.4194);

      const res = await harness.callBridge('GET_LOCATION');
      expect(res.latitude).toBe(37.7749);
      expect(res.longitude).toBe(-122.4194);
    });

    it('T1.R3.04: GPX route player parses XML waypoints, scrubs, and manages playback status', () => {
      const gpxXml = `<?xml version="1.0"?>
      <gpx version="1.1">
        <trk><trkseg>
          <trkpt lat="37.7749" lon="-122.4194"><ele>10.0</ele></trkpt>
          <trkpt lat="37.7750" lon="-122.4195"><ele>11.0</ele></trkpt>
          <trkpt lat="37.7752" lon="-122.4198"><ele>12.0</ele></trkpt>
        </trkseg></trk>
      </gpx>`;

      const points = parseGpxXml(gpxXml);
      expect(points.length).toBe(3);
      expect(points[0].lat).toBe(37.7749);
      expect(points[2].ele).toBe(12.0);

      const harness = new DevToolsTestHarness();
      harness.store.getState().setGpxRoute(points);
      expect(harness.getState().gpxRoute.points.length).toBe(3);

      harness.store.getState().setGpxSpeed(5);
      expect(harness.getState().gpxRoute.speedMultiplier).toBe(5);

      harness.store.getState().setGpxIndex(2);
      expect(harness.getState().gpxRoute.currentIndex).toBe(2);
    });

    it('T1.R3.05: Network throttling presets and custom sliders configure latency and bandwidth', () => {
      const harness = new DevToolsTestHarness();

      harness.setNetworkPreset('2g');
      expect(harness.getState().networkThrottling.preset).toBe('2g');
      expect(harness.getState().networkThrottling.latencyMs).toBe(400);

      harness.setNetworkPreset('offline');
      expect(harness.getState().networkThrottling.isOffline).toBe(true);

      harness.store.getState().setNetworkCustom({ latencyMs: 250, downloadKbps: 1500 });
      expect(harness.getState().networkThrottling.preset).toBe('custom');
      expect(harness.getState().networkThrottling.latencyMs).toBe(250);
      expect(harness.getState().networkThrottling.downloadKbps).toBe(1500);
    });

    it('T1.R3.06: Device state controls adjust battery percentage, charging state, and screen brightness', () => {
      const harness = new DevToolsTestHarness();

      harness.setBattery(85, true);
      expect(harness.getState().battery.level).toBe(85);
      expect(harness.getState().battery.isCharging).toBe(true);

      harness.store.getState().setScreenBrightness(0.65);
      expect(harness.getState().screenBrightness).toBe(0.65);
    });

    it('T1.R3.07: BLE peripheral simulator manages virtual devices and GATT characteristics CRUD', () => {
      const harness = new DevToolsTestHarness();

      const bleDevice = {
        id: 'ble-hrm-01',
        name: 'Heart Rate Monitor',
        rssi: -65,
        serviceUuids: ['180D'],
        isConnected: false,
      };

      harness.store.getState().addBlePeripheral(bleDevice);
      expect(harness.getState().blePeripherals.length).toBe(1);
      expect(harness.getState().blePeripherals[0].name).toBe('Heart Rate Monitor');

      harness.store.getState().updateBlePeripheral('ble-hrm-01', { isConnected: true, rssi: -58 });
      expect(harness.getState().blePeripherals[0].isConnected).toBe(true);
      expect(harness.getState().blePeripherals[0].rssi).toBe(-58);

      harness.store.getState().removeBlePeripheral('ble-hrm-01');
      expect(harness.getState().blePeripherals.length).toBe(0);
    });

    it('T1.R3.08: NFC tag generator produces NDEF records and triggers virtual tag tap', async () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().setNfcTag({
        id: 'nfc-tag-001',
        techList: ['NfcA', 'Ndef'],
        ndefMessage: 'https://goat-engine.dev/miniapp/welcome',
      });

      expect(harness.getState().nfcTag.id).toBe('nfc-tag-001');

      const res = await harness.callBridge('NFC_READ_TAG');
      expect(res.payload).toBe('https://goat-engine.dev/miniapp/welcome');
    });

    it('T1.R3.09: Biometrics panel handles simulated Face ID/Fingerprint pass and fail triggers', async () => {
      const harness = new DevToolsTestHarness();

      // Test Success
      harness.store.getState().setBiometrics({ type: 'faceId', isEnrolled: true, shouldSucceed: true });
      const successRes = await harness.callBridge('BIOMETRIC_AUTH');
      expect(successRes.authenticated).toBe(true);

      // Test Fail
      harness.store.getState().setBiometrics({ shouldSucceed: false });
      let failed = false;
      try {
        await harness.callBridge('BIOMETRIC_AUTH');
      } catch (err: any) {
        failed = true;
        expect(err.message).toContain('AUTHENTICATION_FAILED');
      }
      expect(failed).toBe(true);
    });
  });
}
