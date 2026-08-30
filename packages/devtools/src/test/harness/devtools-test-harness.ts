/**
 * devtools-test-harness.ts — Comprehensive Test Harness for DevTools Studio IDE
 * Provides hermetic in-memory simulation across all R1–R5 subsystems.
 */

import { createStore } from 'zustand/vanilla';
import type { DevToolsStore, EditorTab, DeviceSkinType, ViewportScale, Orientation, NetworkPreset, BiometricType, ConsoleLogEntry, BridgeTraceEntry } from '../../types/index.ts';
import { createWorkspaceSlice } from '../../store/workspaceSlice.ts';
import { createSimulatorSlice } from '../../store/simulatorSlice.ts';
import { createSensorsSlice } from '../../store/sensorsSlice.ts';
import { createDebuggerSlice } from '../../store/debuggerSlice.ts';
import { createPackagingSlice } from '../../store/packagingSlice.ts';
import { GOAT_BRIDGE_ACTIONS_CATALOG, generateMonacoBridgeDeclarations } from '../../services/monacoBridgeTypings.ts';
import { validateManifestJson, validateGoatConfigJson } from '../../services/schemaValidator.ts';
import { NetworkThrottler } from '../../services/networkThrottler.ts';
import { parseGpxXml, GpxRoutePlayer } from '../../services/gpxParser.ts';
import { analyzeBytecodePrecompilation } from '../../services/v8BytecodeAnalyzer.ts';

export class DevToolsTestHarness {
  public store: any;
  public networkThrottler: NetworkThrottler;
  public gpxPlayer: GpxRoutePlayer;
  private bridgeListeners: Map<string, Array<(payload: any) => void>> = new Map();

  constructor() {
    this.store = createStore<any>()((...a) => ({
      ...createWorkspaceSlice(...a),
      ...createSimulatorSlice(...a),
      ...createSensorsSlice(...a),
      ...createDebuggerSlice(...a),
      ...createPackagingSlice(...a),
    }));

    this.networkThrottler = new NetworkThrottler();
    this.gpxPlayer = new GpxRoutePlayer();
  }

  getState(): DevToolsStore {
    return this.store.getState();
  }

  // Workspace Helpers (R1)
  openFile(filePath: string): void {
    this.store.getState().openFile(filePath);
  }

  createFile(filePath: string, content: string = ''): void {
    this.store.getState().createFile(filePath, content);
  }

  updateFile(filePath: string, content: string): void {
    this.store.getState().updateFileContent(filePath, content);
  }

  deleteFile(filePath: string): void {
    this.store.getState().deleteFile(filePath);
  }

  switchTemplate(template: 'vanilla' | 'react' | 'vue'): void {
    this.store.getState().loadTemplate(template);
  }

  validateManifest(content?: string) {
    const raw = content || this.getState().files['manifest.json'] || '{}';
    return validateManifestJson(raw);
  }

  validateGoatConfig(content?: string) {
    const raw = content || this.getState().files['goat.config.json'] || '{}';
    return validateGoatConfigJson(raw);
  }

  getMonacoTypings(): string {
    return generateMonacoBridgeDeclarations();
  }

  // Simulator Helpers (R2)
  setDeviceSkin(skin: DeviceSkinType): void {
    this.store.getState().setActiveDeviceSkin(skin);
  }

  setViewportScale(scale: ViewportScale): void {
    this.store.getState().setViewportScale(scale);
  }

  toggleOrientation(): void {
    this.store.getState().toggleOrientation();
  }

  toggleTheme(): void {
    this.store.getState().toggleTheme();
  }

  // Sensor & Hardware Helpers (R3)
  setGpsLocation(lat: number, lng: number, altitude = 10, accuracy = 5, speed = 0): void {
    this.store.getState().setLocation({ latitude: lat, longitude: lng, altitude, accuracy, speed });
    this.emitBridgeEvent('locationChange', { latitude: lat, longitude: lng, altitude, accuracy, speed });
  }

  applyMotionPreset(preset: 'shake' | 'tiltLeft' | 'tiltRight' | 'freefall' | 'faceDown'): void {
    switch (preset) {
      case 'shake':
        this.store.getState().setAccelerometer({ x: 28.5, y: -15.2, z: 12.0 });
        this.emitBridgeEvent('onAccelerometerChange', { x: 28.5, y: -15.2, z: 12.0 });
        break;
      case 'tiltLeft':
        this.store.getState().setDeviceMotion({ alpha: 0, beta: 0, gamma: -45 });
        this.store.getState().setAccelerometer({ x: -6.9, y: 0, z: 6.9 });
        break;
      case 'tiltRight':
        this.store.getState().setDeviceMotion({ alpha: 0, beta: 0, gamma: 45 });
        this.store.getState().setAccelerometer({ x: 6.9, y: 0, z: 6.9 });
        break;
      case 'freefall':
        this.store.getState().setAccelerometer({ x: 0, y: 0, z: 0.1 });
        break;
      case 'faceDown':
        this.store.getState().setDeviceMotion({ alpha: 0, beta: 180, gamma: 0 });
        this.store.getState().setAccelerometer({ x: 0, y: 0, z: -9.8 });
        break;
    }
  }

  setNetworkPreset(preset: NetworkPreset): void {
    this.store.getState().setNetworkPreset(preset);
    this.networkThrottler.setPreset(preset);
  }

  setBattery(level: number, isCharging: boolean): void {
    this.store.getState().setBattery({ level, isCharging });
    this.emitBridgeEvent('onBatteryChange', { level, isCharging });
  }

  // Simulated GoatBridge RPC Dispatcher
  async callBridge(action: string, payload: any = {}): Promise<any> {
    const start = performance.now();

    // Add pending trace to Debugger
    const actionDef = GOAT_BRIDGE_ACTIONS_CATALOG.find((a) => a.action === action);
    const domain = actionDef ? actionDef.domain : 'Custom Domain';

    this.store.getState().addBridgeTrace({
      action,
      domain,
      direction: 'bridge',
      payload,
      durationMs: 0,
      status: 'pending',
    });

    try {
      let response: any;

      // Check network throttling if it's a network action
      if (['API_REQUEST', 'DOWNLOAD_FILE', 'UPLOAD_FILE'].includes(action)) {
        response = await this.networkThrottler.simulateRequest(async () => {
          return { status: 200, statusText: 'OK', data: { success: true }, durationMs: 12 };
        });
      } else if (action === 'GET_LOCATION') {
        const loc = this.getState().location;
        response = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          altitude: loc.altitude,
          accuracy: loc.accuracy,
          speed: loc.speed,
        };
      } else if (action === 'STORAGE_SET') {
        this.store.getState().setStorageKv(payload.key, payload.value);
        response = { success: true, key: payload.key };
      } else if (action === 'STORAGE_GET') {
        const val = this.getState().storageData.kvStore[payload.key];
        response = { key: payload.key, value: val !== undefined ? val : null };
      } else if (action === 'BIOMETRIC_AUTH') {
        const bio = this.getState().biometrics;
        if (!bio.isEnrolled) {
          throw new Error('BIOMETRIC_NOT_ENROLLED');
        }
        if (!bio.shouldSucceed) {
          throw new Error('BIOMETRIC_AUTHENTICATION_FAILED');
        }
        response = { authenticated: true, token: 'bio-auth-token-xyz789' };
      } else if (action === 'BLE_START_SCAN') {
        response = { isScanning: true, devices: this.getState().blePeripherals };
      } else if (action === 'NFC_READ_TAG') {
        const nfc = this.getState().nfcTag;
        response = { type: 'NDEF_TEXT', payload: nfc.ndefMessage || 'Default NDEF Payload', id: nfc.id };
      } else if (action === 'LOAD_SUBPACKAGE') {
        response = { subpackageName: payload.name, isSuccess: true, isCached: true, byteSize: 45120 };
      } else {
        response = { success: true, action };
      }

      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.store.getState().addConsoleLog({
        thread: 'GoatHost',
        level: 'info',
        message: `Bridge call [${action}] resolved in ${durationMs}ms`,
        data: response,
      });

      return response;
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.store.getState().addConsoleLog({
        thread: 'GoatHost',
        level: 'error',
        message: `Bridge call [${action}] failed: ${err.message}`,
      });
      throw err;
    }
  }

  emitBridgeEvent(event: string, data: any): void {
    const listeners = this.bridgeListeners.get(event) || [];
    for (const cb of listeners) {
      cb(data);
    }
    this.store.getState().addConsoleLog({
      thread: 'AppService',
      level: 'log',
      message: `Event [${event}] dispatched to mini-app worker`,
      data,
    });
  }

  onBridgeEvent(event: string, cb: (data: any) => void): void {
    if (!this.bridgeListeners.has(event)) {
      this.bridgeListeners.set(event, []);
    }
    this.bridgeListeners.get(event)!.push(cb);
  }

  // Packaging & V8 Bytecode Helpers (R5)
  analyzeBytecode(code: string) {
    return analyzeBytecodePrecompilation(code);
  }

  generateQrPairing(port = 4000) {
    const code = 'GOAT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const wsUrl = `ws://localhost:${port}/devtools/page/target-sim-01`;
    this.store.getState().setQrPairing({
      pairingCode: code,
      wsUrl,
      isConnected: true,
      clientDevice: { name: 'iPhone 16 Pro', platform: 'iOS', version: '18.0' },
    });
    return { code, wsUrl };
  }
}
