/**
 * @goat/devtools - Sensor & Hardware Mock Type Definitions
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
  alpha: number;
  beta: number;
  gamma: number;
}

export interface CompassData {
  direction: number;
  accuracy: number;
}

export type DeviceMotionPreset = 'flat' | 'shake' | 'tilt-left' | 'tilt-right' | 'face-down' | 'freefall';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading: number;
}

export interface GpxWaypoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: number;
}

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
}

export interface GpxRoute {
  name: string;
  waypoints: GpxWaypoint[];
  totalDistanceMeters: number;
  durationSeconds: number;
}

export interface GpxPlaybackState {
  isPlaying: boolean;
  speedMultiplier: number;
  currentIndex: number;
  loop: boolean;
}

export type NetworkProfileId = 'online' | '5g' | '4g' | '3g' | '2g' | 'high-latency' | 'offline' | 'custom';

export interface NetworkProfile {
  id: NetworkProfileId;
  name: string;
  downloadKbps: number;
  uploadKbps: number;
  latencyMs: number;
  packetLossPercent: number;
}

export interface BatteryState {
  level: number; // 0 - 100
  isCharging: boolean;
  chargingSource: 'ac' | 'usb' | 'wireless';
}

export interface BrightnessState {
  level: number; // 0.0 - 1.0
  autoAdjust: boolean;
}

export type BiometricsMockMode = 'success' | 'fail' | 'cancel' | 'lockout';

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

export interface NfcMockRecord {
  type: 'text' | 'uri' | 'mime';
  payload: string;
}
