// Core state types for the Goat Playground mock bridge

export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface MockState {
  /** Target device platform */
  platform: 'ios' | 'android';
  /** Biometric sensor mock state */
  biometric: 'success' | 'fail' | 'locked';
  /** GPS location spoof */
  gps: GpsCoords;
  /** Network connectivity mock */
  network: 'wifi' | '4g' | '3g' | 'offline';
  /** Battery level 0–100 */
  battery: number;
  /** App theme */
  theme: 'light' | 'dark';
}

export interface BridgeTrace {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  /** Round-trip latency in milliseconds */
  latency: number;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
}
