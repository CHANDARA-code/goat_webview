import { HardwareOverridesState, GpsLocation, BiometricMockMode } from './types';

export const GPS_PRESETS: { name: string; location: GpsLocation }[] = [
  {
    name: 'Apple Park (Cupertino, CA)',
    location: {
      latitude: 37.3346,
      longitude: -122.009,
      accuracy: 3.2,
      altitude: 15.0,
      label: 'Apple Park HQ',
    },
  },
  {
    name: 'Tokyo Station (Tokyo, Japan)',
    location: {
      latitude: 35.6812,
      longitude: 139.7671,
      accuracy: 4.5,
      altitude: 5.0,
      label: 'Tokyo Central',
    },
  },
  {
    name: 'London Bridge (London, UK)',
    location: {
      latitude: 51.5079,
      longitude: -0.0877,
      accuracy: 5.0,
      altitude: 10.0,
      label: 'London Bridge',
    },
  },
  {
    name: 'Angkor Wat (Siem Reap, Cambodia)',
    location: {
      latitude: 13.4125,
      longitude: 103.867,
      accuracy: 2.8,
      altitude: 20.0,
      label: 'Angkor Wat Temple',
    },
  },
];

type Listener = (state: HardwareOverridesState) => void;

class HardwareOverridesStore {
  private state: HardwareOverridesState = {
    isOffline: false,
    mockGps: null,
    mockBiometrics: 'AUTO',
    mockBleDevicesCount: 3,
    mockNfcPayload: 'NDEF://goat.miniapp/asset-tag-984',
    mockMotion: { alpha: 45, beta: 15, gamma: -10 },
  };

  private listeners: Set<Listener> = new Set();

  public getState(): HardwareOverridesState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public setOffline(offline: boolean) {
    this.state.isOffline = offline;
    this.notify();
  }

  public setMockGps(gps: GpsLocation | null) {
    this.state.mockGps = gps ? { ...gps } : null;
    this.notify();
  }

  public setBiometricMode(mode: BiometricMockMode) {
    this.state.mockBiometrics = mode;
    this.notify();
  }

  public setMockBleDevicesCount(count: number) {
    this.state.mockBleDevicesCount = count;
    this.notify();
  }

  public setMockNfcPayload(payload: string | null) {
    this.state.mockNfcPayload = payload;
    this.notify();
  }

  public setMockMotion(motion: { alpha: number; beta: number; gamma: number }) {
    this.state.mockMotion = { ...motion };
    this.notify();
  }

  public resetAll() {
    this.state = {
      isOffline: false,
      mockGps: null,
      mockBiometrics: 'AUTO',
      mockBleDevicesCount: 3,
      mockNfcPayload: 'NDEF://goat.miniapp/asset-tag-984',
      mockMotion: { alpha: 0, beta: 0, gamma: 0 },
    };
    this.notify();
  }

  /**
   * Evaluates biometric authentication request based on mock setting.
   */
  public evaluateBiometrics(promptTitle: string = 'Authenticate'): {
    success: boolean;
    error?: string;
    biometryType: string;
  } {
    const mode = this.state.mockBiometrics;
    if (mode === 'FORCE_SUCCESS' || mode === 'AUTO') {
      return { success: true, biometryType: 'FaceID' };
    }
    if (mode === 'FORCE_ERROR') {
      return { success: false, error: 'User canceled authentication prompt', biometryType: 'FaceID' };
    }
    if (mode === 'LOCKED_OUT') {
      return { success: false, error: 'Biometrics locked out due to too many failed attempts', biometryType: 'FaceID' };
    }
    if (mode === 'NOT_ENROLLED') {
      return { success: false, error: 'No biometric credentials enrolled on this device', biometryType: 'None' };
    }
    return { success: true, biometryType: 'FaceID' };
  }

  /**
   * Generates mock BLE peripherals list.
   */
  public getMockBlePeripherals() {
    const count = this.state.mockBleDevicesCount;
    const devices = [
      { id: 'BLE-001', name: 'Goat Smart Gateway V2', rssi: -42, txPower: 4, isConnectable: true },
      { id: 'BLE-002', name: 'Beacon-Warehouse-Zone4', rssi: -68, txPower: 0, isConnectable: false },
      { id: 'BLE-003', name: 'Industrial Temp Sensor #12', rssi: -55, txPower: 2, isConnectable: true },
      { id: 'BLE-004', name: 'Goat Health Band Pro', rssi: -38, txPower: 6, isConnectable: true },
      { id: 'BLE-005', name: 'Automotive OBD-II Dongle', rssi: -72, txPower: 0, isConnectable: true },
    ];
    return devices.slice(0, count);
  }
}

export const hardwareOverrides = new HardwareOverridesStore();
