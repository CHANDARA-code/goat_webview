/**
 * Simulator & Component Playground Test Harness
 * Simulates iPhone 16 Pro / Pixel 9 Pro device frames, mock hardware controls, 6 native widgets, and live IPC telemetry inspector.
 */

import { GoatBridgeMock, mockState } from '../../../packages/bridge-mock/dist/src/index.js';

export interface DeviceFrameConfig {
  deviceType: 'iphone-16-pro' | 'pixel-9-pro';
  width: number;
  height: number;
  hasDynamicIsland: boolean;
  hasPunchHole: boolean;
  pixelRatio: number;
  safeArea: { top: number; bottom: number; left: number; right: number };
}

export interface MockHardwareState {
  battery: { level: number; isCharging: boolean };
  gps: { latitude: number; longitude: number; altitude: number; accuracy: number };
  network: { isConnected: boolean; networkType: 'wifi' | '5g' | '4g' | 'cellular' | 'none' };
  biometric: { supported: boolean; biometryType: 'faceID' | 'touchID' | 'fingerprint' | 'none'; failNextAuth: boolean };
  theme: 'dark' | 'light';
  orientation: 'portrait' | 'landscape';
}

export interface IpcTraceRecord {
  id: string;
  timestamp: number;
  action: string;
  payload: any;
  response?: any;
  error?: any;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  latencyMs: number;
}

export class SimulatorHarness {
  public device: DeviceFrameConfig;
  public hardware: MockHardwareState;
  public bridge: GoatBridgeMock;
  public traceStream: IpcTraceRecord[] = [];
  public activeAppId: string;

  // Component Playground States
  public navBarState = {
    title: 'Goat Mini-App',
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
    progress: 0,
    progressVisible: false,
    buttons: [] as any[],
  };

  public bottomSheetState = {
    isOpen: false,
    snapPoint: '50%',
    snapPoints: ['25%', '50%', '90%'],
    dismissible: true,
  };

  public permissionDialogState = {
    isOpen: false,
    permission: '',
    rationale: '',
    status: 'IDLE' as 'IDLE' | 'PRIMED' | 'GRANTED' | 'DENIED',
  };

  public externalLinkDialogState = {
    isOpen: false,
    targetUrl: '',
    isTrustedDomain: false,
    status: 'IDLE' as 'IDLE' | 'PROCEEDED' | 'BLOCKED',
  };

  public hapticsLog: { type: string; style?: string; timestamp: number }[] = [];
  public biometricsLog: { reason: string; success: boolean; timestamp: number }[] = [];

  constructor(appId: string = 'test_showcase_app', device: 'iphone-16-pro' | 'pixel-9-pro' = 'iphone-16-pro') {
    this.activeAppId = appId;
    this.bridge = new GoatBridgeMock({ appId });

    this.device = this.getFrameConfig(device);
    this.hardware = {
      battery: { level: 95, isCharging: false },
      gps: { latitude: 37.7749, longitude: -122.4194, altitude: 10, accuracy: 5 },
      network: { isConnected: true, networkType: 'wifi' },
      biometric: { supported: true, biometryType: 'faceID', failNextAuth: false },
      theme: 'dark',
      orientation: 'portrait',
    };

    this.applyHardwareToMockState();
  }

  public setDevice(deviceType: 'iphone-16-pro' | 'pixel-9-pro'): void {
    this.device = this.getFrameConfig(deviceType);
  }

  public getFrameConfig(deviceType: 'iphone-16-pro' | 'pixel-9-pro'): DeviceFrameConfig {
    if (deviceType === 'iphone-16-pro') {
      return {
        deviceType: 'iphone-16-pro',
        width: 393,
        height: 852,
        hasDynamicIsland: true,
        hasPunchHole: false,
        pixelRatio: 3.0,
        safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
      };
    } else {
      return {
        deviceType: 'pixel-9-pro',
        width: 412,
        height: 915,
        hasDynamicIsland: false,
        hasPunchHole: true,
        pixelRatio: 2.625,
        safeArea: { top: 48, bottom: 24, left: 0, right: 0 },
      };
    }
  }

  public updateHardware(partial: Partial<MockHardwareState>): void {
    if (partial.battery) this.hardware.battery = { ...this.hardware.battery, ...partial.battery };
    if (partial.gps) this.hardware.gps = { ...this.hardware.gps, ...partial.gps };
    if (partial.network) this.hardware.network = { ...this.hardware.network, ...partial.network };
    if (partial.biometric) this.hardware.biometric = { ...this.hardware.biometric, ...partial.biometric };
    if (partial.theme) this.hardware.theme = partial.theme;
    if (partial.orientation) this.hardware.orientation = partial.orientation;

    this.applyHardwareToMockState();
  }

  private applyHardwareToMockState(): void {
    mockState.battery.level = this.hardware.battery.level;
    mockState.battery.isCharging = this.hardware.battery.isCharging;
    mockState.deviceInfo.batteryLevel = this.hardware.battery.level;
    mockState.deviceInfo.isCharging = this.hardware.battery.isCharging;
    mockState.location.latitude = this.hardware.gps.latitude;
    mockState.location.longitude = this.hardware.gps.longitude;
    mockState.location.altitude = this.hardware.gps.altitude;
    mockState.location.accuracy = this.hardware.gps.accuracy;
    mockState.network.isConnected = this.hardware.network.isConnected;
    mockState.network.networkType = this.hardware.network.networkType;
    mockState.biometrics.supported = this.hardware.biometric.supported;
    mockState.biometrics.biometryType = this.hardware.biometric.biometryType;
    mockState.biometrics.failNextAuth = this.hardware.biometric.failNextAuth;
    mockState.permissions.set('BIOMETRIC', true);
    mockState.recordUserGesture();
  }

  /**
   * Dispatches action through bridge and records telemetry into traceStream
   */
  public async executeAction<T = any>(action: string, payload: any = {}): Promise<T> {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    try {
      const data = await this.bridge.callNative<T>(action, payload);
      const latencyMs = Date.now() - startTime;

      // Update component state models if relevant
      this.syncComponentAction(action, payload, data);

      const record: IpcTraceRecord = {
        id: callId,
        timestamp: startTime,
        action,
        payload,
        response: data,
        status: 'SUCCESS',
        latencyMs,
      };
      this.traceStream.unshift(record);
      return data;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const record: IpcTraceRecord = {
        id: callId,
        timestamp: startTime,
        action,
        payload,
        error: err?.message || String(err),
        status: 'ERROR',
        latencyMs,
      };
      this.traceStream.unshift(record);
      throw err;
    }
  }

  private syncComponentAction(action: string, payload: any, response: any): void {
    switch (action) {
      case 'SET_NAV_BAR_TITLE':
        if (payload.title) this.navBarState.title = payload.title;
        break;
      case 'SET_NAV_BAR_COLOR':
        if (payload.backgroundColor) this.navBarState.backgroundColor = payload.backgroundColor;
        if (payload.textColor) this.navBarState.textColor = payload.textColor;
        break;
      case 'SET_NAV_BAR_PROGRESS':
        this.navBarState.progress = payload.progress ?? 0;
        this.navBarState.progressVisible = payload.visible ?? true;
        break;
      case 'EXPAND_BOTTOM_SHEET':
        this.bottomSheetState.isOpen = true;
        this.bottomSheetState.snapPoint = payload.snapPoint || '100%';
        break;
      case 'COLLAPSE_BOTTOM_SHEET':
        this.bottomSheetState.isOpen = false;
        break;
      case 'SET_SHEET_SNAP_POINTS':
        if (Array.isArray(payload.snapPoints)) this.bottomSheetState.snapPoints = payload.snapPoints;
        break;
      case 'HAPTIC_FEEDBACK':
        this.hapticsLog.push({ type: payload.type || 'impact', style: payload.style, timestamp: Date.now() });
        break;
      case 'BIOMETRIC_AUTH':
        this.biometricsLog.push({ reason: payload.reason || '', success: true, timestamp: Date.now() });
        break;
      case 'REQUEST_PERMISSION':
        this.permissionDialogState.isOpen = true;
        this.permissionDialogState.permission = payload.permission || '';
        this.permissionDialogState.rationale = payload.rationale || '';
        this.permissionDialogState.status = response?.granted ? 'GRANTED' : 'DENIED';
        break;
      case 'OPEN_EXTERNAL_LINK':
        this.externalLinkDialogState.isOpen = true;
        this.externalLinkDialogState.targetUrl = payload.url || '';
        this.externalLinkDialogState.status = 'PROCEEDED';
        break;
    }
  }

  public getTraceCount(): number {
    return this.traceStream.length;
  }

  public clearTraces(): void {
    this.traceStream = [];
  }
}
