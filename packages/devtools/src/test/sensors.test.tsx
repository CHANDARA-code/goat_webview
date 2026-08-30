/**
 * @goat/devtools - Hardware & Sensor Simulation Suite Unit & Component Tests
 * Milestone 3 Comprehensive Test Suite
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Store & Services
import { useDevToolsStore } from '../store/index.ts';
import { mockState } from '@goat/bridge-mock';
import {
  parseGpxXml,
  parseGpxRoute,
  calculateHaversineDistanceMeters,
  GpxRoutePlayer,
} from '../services/gpxParser.ts';
import { NetworkThrottler, NETWORK_PROFILES } from '../services/networkThrottler.ts';

// Sensor Components
import { MotionController } from '../components/sensors/MotionController.tsx';
import { MotionSensorPanel } from '../components/sensors/MotionSensorPanel.tsx';
import { GeolocationPicker } from '../components/sensors/GeolocationPicker.tsx';
import { GeolocationPanel } from '../components/sensors/GeolocationPanel.tsx';
import { NetworkThrottlePanel } from '../components/sensors/NetworkThrottlePanel.tsx';
import { NetworkEmulationPanel } from '../components/sensors/NetworkEmulationPanel.tsx';
import { BatteryBrightnessControls } from '../components/sensors/BatteryBrightnessControls.tsx';
import { BatteryBrightnessPanel } from '../components/sensors/BatteryBrightnessPanel.tsx';
import { BleNfcSimulator } from '../components/sensors/BleNfcSimulator.tsx';
import { BleSimulatorPanel } from '../components/sensors/BleSimulatorPanel.tsx';
import { NfcTagGeneratorPanel } from '../components/sensors/NfcTagGeneratorPanel.tsx';
import { BiometricsModal } from '../components/sensors/BiometricsModal.tsx';
import { SensorSuitePanel } from '../components/sensors/SensorSuitePanel.tsx';

describe('Milestone 3: GPX Parser & Route Simulation Service', () => {
  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
  <gpx version="1.1" creator="Goat GPX Studio">
    <metadata>
      <name>San Francisco Coastal Run</name>
    </metadata>
    <trk>
      <name>San Francisco Coastal Run</name>
      <trkseg>
        <trkpt lat="37.7749" lon="-122.4194">
          <ele>12.5</ele>
          <time>2026-08-27T10:00:00Z</time>
        </trkpt>
        <trkpt lat="37.7760" lon="-122.4180">
          <ele>15.0</ele>
          <time>2026-08-27T10:00:10Z</time>
        </trkpt>
        <trkpt lat="37.7775" lon="-122.4165">
          <ele>18.2</ele>
          <time>2026-08-27T10:00:20Z</time>
        </trkpt>
      </trkseg>
    </trk>
  </gpx>`;

  it('should parse standard GPX XML trackpoints with elevation and timestamps', () => {
    const points = parseGpxXml(sampleGpx);
    expect(points.length).toBe(3);
    expect(points[0].lat).toBe(37.7749);
    expect(points[0].lng).toBe(-122.4194);
    expect(points[0].ele).toBe(12.5);
    expect(points[0].time).toBe('2026-08-27T10:00:00Z');

    expect(points[2].lat).toBe(37.7775);
    expect(points[2].ele).toBe(18.2);
  });

  it('should handle malformed or empty GPX XML gracefully without throwing', () => {
    expect(parseGpxXml('')).toEqual([]);
    expect(parseGpxXml('not-xml-content')).toEqual([]);
    expect(parseGpxXml('<gpx></gpx>')).toEqual([]);
  });

  it('should calculate accurate Haversine distance in meters between coordinates', () => {
    // SF (37.7749, -122.4194) to Oakland (37.8044, -122.2711) ~13.5km
    const dist = calculateHaversineDistanceMeters(37.7749, -122.4194, 37.8044, -122.2711);
    expect(dist).toBeGreaterThan(12000);
    expect(dist).toBeLessThan(15000);

    // Distance to same point is 0
    expect(calculateHaversineDistanceMeters(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('should generate structured GpxRoute with name, total distance, and duration', () => {
    const route = parseGpxRoute(sampleGpx);
    expect(route.name).toBe('San Francisco Coastal Run');
    expect(route.waypoints.length).toBe(3);
    expect(route.totalDistanceMeters).toBeGreaterThan(100);
    expect(route.durationSeconds).toBeGreaterThan(0);
  });

  it('should manage route playback state, seek, pause, and speed multiplier', () => {
    const points = parseGpxXml(sampleGpx);
    const player = new GpxRoutePlayer(points);

    expect(player.getStatus().isPlaying).toBe(false);
    expect(player.getStatus().totalPoints).toBe(3);

    player.seek(1);
    expect(player.getCurrentPoint()?.lat).toBe(37.7760);

    player.setSpeed(5);
    expect(player.getStatus().speedMultiplier).toBe(5);

    let recordedIndex = -1;
    player.onPoint((pt, idx) => {
      recordedIndex = idx;
    });

    player.seek(2);
    expect(recordedIndex).toBe(2);

    player.stop();
    expect(player.getStatus().isPlaying).toBe(false);
    expect(player.getStatus().currentIndex).toBe(0);
  });
});

describe('Milestone 3: Network Throttler Service', () => {
  it('should expose all predefined network profiles correctly', () => {
    const throttler = new NetworkThrottler();

    expect(NETWORK_PROFILES.online.downloadKbps).toBe(100000);
    expect(NETWORK_PROFILES['2g'].latencyMs).toBe(400);
    expect(NETWORK_PROFILES['3g'].latencyMs).toBe(150);
    expect(NETWORK_PROFILES['4g'].latencyMs).toBe(40);
    expect(NETWORK_PROFILES['5g'].latencyMs).toBe(10);
    expect(NETWORK_PROFILES.offline.isOffline).toBe(true);
    expect(NETWORK_PROFILES['packet-loss'].packetLossRate).toBe(0.25);
  });

  it('should apply preset switching and custom configurations', () => {
    const throttler = new NetworkThrottler();

    throttler.setPreset('3g');
    expect(throttler.getProfile().preset).toBe('3g');
    expect(throttler.getProfile().latencyMs).toBe(150);

    throttler.setCustom({ latencyMs: 250, downloadKbps: 8000 });
    expect(throttler.getProfile().preset).toBe('custom');
    expect(throttler.getProfile().latencyMs).toBe(250);
    expect(throttler.getProfile().downloadKbps).toBe(8000);
  });

  it('should immediately throw when simulating requests under offline profile', async () => {
    const throttler = new NetworkThrottler();
    throttler.setPreset('offline');

    await expect(
      throttler.simulateRequest(async () => 'success')
    ).rejects.toThrow(/offline/i);
  });

  it('should execute request successfully when online with minimal latency', async () => {
    const throttler = new NetworkThrottler();
    throttler.setPreset('online');

    const res = await throttler.simulateRequest(async () => ({ ok: true, data: 123 }));
    expect(res).toEqual({ ok: true, data: 123 });
  });
});

describe('Milestone 3: Sensor Store & Bridge Mock Synchronization', () => {
  beforeEach(() => {
    useDevToolsStore.getState().resetSensors();
  });

  it('should update location and sync immediately to mockState.location', () => {
    const store = useDevToolsStore.getState();

    store.setLocation({
      latitude: 48.8566,
      longitude: 2.3522,
      altitude: 35,
      speed: 12.5,
      heading: 180,
    });

    const state = useDevToolsStore.getState();
    expect(state.location.latitude).toBe(48.8566);
    expect(state.location.longitude).toBe(2.3522);

    expect(mockState.location.latitude).toBe(48.8566);
    expect(mockState.location.longitude).toBe(2.3522);
    expect(mockState.location.altitude).toBe(35);
  });

  it('should apply motion presets and sync Euler angles and accelerometer', () => {
    const store = useDevToolsStore.getState();

    // Shake
    store.setMotionPreset('shake');
    expect(useDevToolsStore.getState().activeMotionPreset).toBe('shake');
    expect(useDevToolsStore.getState().accelerometer.x).toBeGreaterThan(20);

    // Tilt Left
    store.setMotionPreset('tilt-left');
    expect(useDevToolsStore.getState().deviceMotion.gamma).toBe(-45);

    // Face Down
    store.setMotionPreset('face-down');
    expect(useDevToolsStore.getState().deviceMotion.beta).toBe(180);
    expect(useDevToolsStore.getState().accelerometer.z).toBe(-9.81);

    // Freefall
    store.setMotionPreset('freefall');
    expect(useDevToolsStore.getState().accelerometer.z).toBeLessThan(1.0);
  });

  it('should update battery level and charging state and sync to mockState.battery', () => {
    const store = useDevToolsStore.getState();

    store.setBattery({ level: 45, isCharging: true });
    expect(useDevToolsStore.getState().battery.level).toBe(45);
    expect(useDevToolsStore.getState().battery.isCharging).toBe(true);

    expect(mockState.battery.level).toBe(45);
    expect(mockState.battery.isCharging).toBe(true);
  });

  it('should update screen brightness and clamp to valid range [0, 1]', () => {
    const store = useDevToolsStore.getState();

    store.setScreenBrightness(0.65);
    expect(useDevToolsStore.getState().screenBrightness).toBe(0.65);
    expect(mockState.brightness).toBe(0.65);

    // Test clamping
    store.setScreenBrightness(1.5);
    expect(useDevToolsStore.getState().screenBrightness).toBe(1.0);

    store.setScreenBrightness(-0.2);
    expect(useDevToolsStore.getState().screenBrightness).toBe(0.0);
  });

  it('should sync network profile and offline status to mockState.network', () => {
    const store = useDevToolsStore.getState();

    store.setNetworkPreset('offline');
    expect(useDevToolsStore.getState().networkThrottling.isOffline).toBe(true);
    expect(mockState.network.isConnected).toBe(false);

    store.setNetworkPreset('5g');
    expect(useDevToolsStore.getState().networkThrottling.isOffline).toBe(false);
    expect(mockState.network.isConnected).toBe(true);
  });

  it('should sync biometrics mode and enrollment to mockState.biometrics & permissions', () => {
    const store = useDevToolsStore.getState();

    store.setBiometrics({ type: 'faceId', isEnrolled: true, shouldSucceed: true });
    expect(mockState.biometrics.biometryType).toBe('face');
    expect(mockState.biometrics.autoAuthSuccess).toBe(true);
    expect(mockState.permissions.get('BIOMETRIC')).toBe(true);

    store.setBiometricsMode('fail');
    expect(mockState.biometrics.autoAuthSuccess).toBe(false);

    store.setBiometricsMode('lockout');
    expect(mockState.biometrics.isLockedOut).toBe(true);
  });

  it('should manage BLE peripherals CRUD and sync to mockState.bleDevices', () => {
    const store = useDevToolsStore.getState();

    const dev = {
      id: 'ble-smart-ring-01',
      name: 'Goat Smart Ring',
      rssi: -55,
      services: [{ uuid: '180F', characteristics: [{ uuid: '2A19', value: '95', properties: ['read'] }] }],
      isConnected: false,
    };

    store.addBlePeripheral(dev);
    expect(useDevToolsStore.getState().blePeripherals.length).toBe(1);
    expect(mockState.bleDevices.some((d) => d.deviceId === 'ble-smart-ring-01')).toBe(true);

    store.setBleConnected('ble-smart-ring-01', true);
    expect(useDevToolsStore.getState().blePeripherals[0].isConnected).toBe(true);
    expect(mockState.connectedBleDevices.has('ble-smart-ring-01')).toBe(true);

    store.removeBlePeripheral('ble-smart-ring-01');
    expect(useDevToolsStore.getState().blePeripherals.length).toBe(0);
    expect(mockState.bleDevices.some((d) => d.deviceId === 'ble-smart-ring-01')).toBe(false);
  });

  it('should sync NFC tag payload to mockState.nfcTag', () => {
    const store = useDevToolsStore.getState();

    store.setNfcTag({
      id: '04:12:34:56:78:9A:BC',
      techList: ['Ndef'],
      ndefMessage: 'https://goat.dev/pass/vip-access',
    });

    expect(mockState.nfcTag.payload).toBe('https://goat.dev/pass/vip-access');
    expect(mockState.nfcTag.uri).toBe('https://goat.dev/pass/vip-access');
  });
});

describe('Milestone 3: React Sensor Components Rendering & Interactions', () => {
  beforeEach(() => {
    useDevToolsStore.getState().resetSensors();
  });

  it('should render MotionController with 3D chassis, sliders, and preset buttons', () => {
    render(<MotionController />);
    expect(screen.getByTestId('motion-controller')).toBeInTheDocument();
    expect(screen.getByTestId('3d-motion-viewport')).toBeInTheDocument();
    expect(screen.getByText(/Motion & Gyroscope Sensors/i)).toBeInTheDocument();
    expect(screen.getByText('Flat')).toBeInTheDocument();
    expect(screen.getByText(/⚡ Shake/i)).toBeInTheDocument();
    expect(screen.getByText(/Freefall/i)).toBeInTheDocument();

    // Click shake preset
    fireEvent.click(screen.getByText(/⚡ Shake/i));
    expect(useDevToolsStore.getState().activeMotionPreset).toBe('shake');
  });

  it('should render MotionSensorPanel as backward compatible alias', () => {
    render(<MotionSensorPanel />);
    expect(screen.getByTestId('motion-controller')).toBeInTheDocument();
  });

  it('should render GeolocationPicker and inject new GPS coordinates', () => {
    render(<GeolocationPicker />);
    expect(screen.getByTestId('geolocation-picker')).toBeInTheDocument();
    expect(screen.getByText(/Geolocation & GPS Routing/i)).toBeInTheDocument();
    expect(screen.getByText(/Inject GPS Location/i)).toBeInTheDocument();

    // Click city preset
    const tokyoButton = screen.getByText('Tokyo');
    fireEvent.click(tokyoButton);
    expect(useDevToolsStore.getState().location.latitude).toBe(35.6762);
    expect(useDevToolsStore.getState().location.longitude).toBe(139.6503);
  });

  it('should render GeolocationPanel as backward compatible alias', () => {
    render(<GeolocationPanel />);
    expect(screen.getByTestId('geolocation-picker')).toBeInTheDocument();
  });

  it('should render NetworkThrottlePanel and switch throttling profiles', () => {
    render(<NetworkThrottlePanel />);
    expect(screen.getByTestId('network-throttle-panel')).toBeInTheDocument();
    expect(screen.getByText(/Network Throttling & Profiles/i)).toBeInTheDocument();

    // Select 5G
    const btn5g = screen.getByText(/5G High-Speed Mobile/i);
    fireEvent.click(btn5g);
    expect(useDevToolsStore.getState().networkThrottling.preset).toBe('5g');

    // Select Offline
    const btnOffline = screen.getByText(/Offline Mode/i);
    fireEvent.click(btnOffline);
    expect(useDevToolsStore.getState().networkThrottling.isOffline).toBe(true);
  });

  it('should render NetworkEmulationPanel as backward compatible alias', () => {
    render(<NetworkEmulationPanel />);
    expect(screen.getByTestId('network-throttle-panel')).toBeInTheDocument();
  });

  it('should render BatteryBrightnessControls and toggle charging & backlight', () => {
    render(<BatteryBrightnessControls />);
    expect(screen.getByTestId('battery-brightness-controls')).toBeInTheDocument();
    expect(screen.getByText(/Battery & Screen Backlight/i)).toBeInTheDocument();

    // Set 50% quick preset
    const btn50 = screen.getByText('50%');
    fireEvent.click(btn50);
    expect(useDevToolsStore.getState().battery.level).toBe(50);

    // Toggle charging
    const chargingToggle = screen.getByText(/Unplugged/i);
    fireEvent.click(chargingToggle);
    expect(useDevToolsStore.getState().battery.isCharging).toBe(true);
  });

  it('should render BatteryBrightnessPanel as backward compatible alias', () => {
    render(<BatteryBrightnessPanel />);
    expect(screen.getByTestId('battery-brightness-controls')).toBeInTheDocument();
  });

  it('should render BleNfcSimulator and toggle between BLE and NFC tabs', () => {
    render(<BleNfcSimulator />);
    expect(screen.getByTestId('ble-nfc-simulator')).toBeInTheDocument();
    expect(screen.getByTestId('ble-section')).toBeInTheDocument();

    // Switch to NFC tab
    const nfcTabButton = screen.getByText(/NFC Tag Generator/i);
    fireEvent.click(nfcTabButton);
    expect(screen.getByTestId('nfc-section')).toBeInTheDocument();
    expect(screen.getByText(/Simulated NFC Chip ID/i)).toBeInTheDocument();

    // Trigger NFC tap
    const tapButton = screen.getByText(/Trigger Virtual NFC Tag Tap/i);
    fireEvent.click(tapButton);
    expect(screen.getByText(/NFC Tag Tapped!/i)).toBeInTheDocument();
  });

  it('should render BleSimulatorPanel and NfcTagGeneratorPanel aliases', () => {
    const { unmount } = render(<BleSimulatorPanel />);
    expect(screen.getByTestId('ble-nfc-simulator')).toBeInTheDocument();
    unmount();

    render(<NfcTagGeneratorPanel />);
    expect(screen.getByTestId('ble-nfc-simulator')).toBeInTheDocument();
  });

  it('should render BiometricsModal and trigger Pass, Fail, Cancel, and Lockout', () => {
    const onAuth = vi.fn();
    render(<BiometricsModal isOpen={true} onAuthenticate={onAuth} />);

    expect(screen.getByTestId('biometrics-modal')).toBeInTheDocument();
    expect(screen.getByText(/Biometrics Verification Suite/i)).toBeInTheDocument();

    // Trigger Pass
    const passBtn = screen.getByText(/Pass \(Match\)/i);
    fireEvent.click(passBtn);
    expect(onAuth).toHaveBeenCalledWith({ success: true });

    // Trigger Fail
    const failBtn = screen.getByText(/Fail \(Mismatch\)/i);
    fireEvent.click(failBtn);
    expect(onAuth).toHaveBeenCalledWith(expect.objectContaining({ success: false }));

    // Trigger Lockout
    const lockoutBtn = screen.getByText(/Trigger Lockout/i);
    fireEvent.click(lockoutBtn);
    expect(screen.getByText(/Biometrics Locked Out:/i)).toBeInTheDocument();
  });

  it('should render SensorSuitePanel master container and switch sub-tabs', () => {
    render(<SensorSuitePanel />);
    expect(screen.getByTestId('sensor-suite-panel')).toBeInTheDocument();
    expect(screen.getByText(/Hardware & Sensor Suite/i)).toBeInTheDocument();

    // Default tab is motion
    expect(screen.getByTestId('motion-controller')).toBeInTheDocument();

    // Switch to GPS tab
    const gpsTab = screen.getByRole('button', { name: /^GPS$/i });
    fireEvent.click(gpsTab);
    expect(screen.getByTestId('geolocation-picker')).toBeInTheDocument();

    // Switch to Network tab
    const netTab = screen.getByRole('button', { name: /^Network$/i });
    fireEvent.click(netTab);
    expect(screen.getByTestId('network-throttle-panel')).toBeInTheDocument();

    // Switch to Battery tab
    const batTab = screen.getByRole('button', { name: /^Battery$/i });
    fireEvent.click(batTab);
    expect(screen.getByTestId('battery-brightness-controls')).toBeInTheDocument();

    // Switch to BLE & NFC tab
    const bleTab = screen.getByRole('button', { name: /^BLE & NFC$/i });
    fireEvent.click(bleTab);
    expect(screen.getByTestId('ble-nfc-simulator')).toBeInTheDocument();

    // Switch to Biometrics tab
    const bioTab = screen.getByRole('button', { name: /^Biometrics$/i });
    fireEvent.click(bioTab);
    expect(screen.getByTestId('biometrics-modal')).toBeInTheDocument();

    // Click Reset All button
    const resetAllBtn = screen.getByText('Reset All');
    fireEvent.click(resetAllBtn);
    expect(useDevToolsStore.getState().location.latitude).toBe(37.7749);
  });
});
