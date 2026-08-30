/**
 * @goat/devtools - Sensors & Hardware Mock Type Definitions
 */

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

export interface GyroscopeData {
  x: number;
  y: number;
  z: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
}

export interface CompassData {
  direction: number;
  accuracy: number;
}

export interface DeviceMotionData {
  alpha: number;
  beta: number;
  gamma: number;
}

export type DeviceMotionPreset =
  | 'flat'
  | 'shake'
  | 'tilt-left'
  | 'tilt-right'
  | 'face-down'
  | 'freefall';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading?: number;
}

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
}

export interface GpxWaypoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: number;
}

export interface GpxRoute {
  name: string;
  waypoints: GpxWaypoint[];
  totalDistanceMeters: number;
  durationSeconds: number;
}

export interface GpxPlaybackState {
  points?: GpxPoint[];
  isPlaying: boolean;
  speedMultiplier: number;
  currentIndex: number;
  loop?: boolean;
}

export type NetworkPreset =
  | 'online'
  | 'offline'
  | '2g'
  | '3g'
  | '4g'
  | '5g'
  | 'high-latency'
  | 'high_latency'
  | 'packet-loss'
  | 'packet_loss'
  | 'custom';

export type NetworkProfileId =
  | 'online'
  | '5g'
  | '4g'
  | '3g'
  | '2g'
  | 'high-latency'
  | 'offline'
  | 'custom';

export interface NetworkProfile {
  id: NetworkProfileId;
  name: string;
  downloadKbps: number;
  uploadKbps: number;
  latencyMs: number;
  packetLossPercent: number;
}

export interface NetworkThrottlingState {
  preset: NetworkPreset;
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
  packetLossRate: number;
  isOffline: boolean;
}

export interface BatteryState {
  level: number; // 0 - 100
  isCharging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
  chargingSource?: 'ac' | 'usb' | 'wireless';
}

export interface BrightnessState {
  level: number; // 0.0 - 1.0
  autoAdjust?: boolean;
}

export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | 'none';
export type BiometricsMockMode = 'success' | 'fail' | 'cancel' | 'lockout';

export interface BiometricsState {
  type: BiometricType;
  isEnrolled: boolean;
  shouldSucceed: boolean;
  isModalOpen: boolean;
}

export interface BlePeripheral {
  id: string;
  name: string;
  rssi: number;
  serviceUuids: string[];
  isConnected?: boolean;
}

export interface BleMockPeripheral {
  id: string;
  name: string;
  rssi: number;
  services: Array<{
    uuid: string;
    characteristics: Array<{
      uuid: string;
      properties: string[];
      value: string;
    }>;
  }>;
  connected?: boolean;
}

export interface NfcTagState {
  id: string;
  techList: string[];
  ndefMessage?: string;
}

export interface NfcMockRecord {
  type: 'text' | 'uri' | 'mime';
  payload: string;
}

export interface SensorsSlice {
  accelerometer: AccelerometerData;
  gyroscope: GyroscopeData;
  compass: CompassData;
  deviceMotion: DeviceMotionData;
  activeMotionPreset?: DeviceMotionPreset;
  location: LocationData;
  gpxRoute: {
    points: GpxPoint[];
    isPlaying: boolean;
    speedMultiplier: number;
    currentIndex: number;
  };
  networkThrottling: NetworkThrottlingState;
  networkProfileId?: NetworkProfileId;
  battery: BatteryState;
  screenBrightness: number;
  blePeripherals: BlePeripheral[];
  nfcTag: NfcTagState;
  biometrics: BiometricsState;

  setAccelerometer: (acc: AccelerometerData) => void;
  setGyroscope: (gyro: GyroscopeData) => void;
  setCompass: (comp: CompassData) => void;
  setDeviceMotion: (motion: DeviceMotionData) => void;
  setMotionPreset?: (preset: DeviceMotionPreset) => void;
  setLocation: (loc: Partial<LocationData>) => void;
  setGpxRoute?: (points: GpxPoint[]) => void;
  setGpxRoutePoints?: (points: GpxPoint[]) => void;
  setGpxPlaying: (playing: boolean) => void;
  setGpxSpeed?: (speedMultiplier: number) => void;
  setGpxSpeedMultiplier?: (mult: number) => void;
  setGpxIndex?: (idx: number) => void;
  setGpxCurrentIndex?: (idx: number) => void;
  setNetworkPreset: (preset: NetworkPreset) => void;
  setNetworkProfile?: (profileId: NetworkProfileId) => void;
  setNetworkCustom?: (config: Partial<NetworkThrottlingState>) => void;
  setCustomNetworkThrottling?: (config: Partial<NetworkThrottlingState>) => void;
  setBattery: (bat: Partial<BatteryState>) => void;
  setScreenBrightness: (brightness: number) => void;
  addBlePeripheral: (dev: BlePeripheral) => void;
  removeBlePeripheral: (id: string) => void;
  updateBlePeripheral?: (id: string, updates: Partial<BlePeripheral>) => void;
  setBleConnected?: (id: string, connected: boolean) => void;
  setNfcTag: (tag: NfcTagState) => void;
  setBiometrics: (bio: Partial<BiometricsState>) => void;
}
