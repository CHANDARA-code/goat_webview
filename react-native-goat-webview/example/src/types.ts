export type TabId = 'ecommerce' | 'iot' | 'fieldservice' | 'vault' | 'diagnostics';

export interface MiniAppTab {
  id: TabId;
  appId: string;
  name: string;
  subtitle: string;
  icon: string;
  badge?: string;
  route: string;
  primaryColor: string;
  domainName: string;
  description: string;
}

export type IpcStatus = 'SUCCESS' | 'ERROR' | 'PENDING';
export type ThreadLane = 'AppService' | 'AppView' | 'Host';

export interface IpcMessageEntry {
  id: string;
  timestamp: number;
  action: string;
  status: IpcStatus;
  durationMs: number;
  isWarmPath: boolean;
  request?: any;
  response?: any;
  error?: string;
  lane: ThreadLane;
  appId: string;
}

export type BiometricMockMode = 'AUTO' | 'FORCE_SUCCESS' | 'FORCE_ERROR' | 'LOCKED_OUT' | 'NOT_ENROLLED';

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  label?: string;
}

export interface HardwareOverridesState {
  isOffline: boolean;
  mockGps: GpsLocation | null;
  mockBiometrics: BiometricMockMode;
  mockBleDevicesCount: number;
  mockNfcPayload: string | null;
  mockMotion: { alpha: number; beta: number; gamma: number };
}

export type AppServiceStatus = 'IDLE' | 'READY' | 'RUNNING' | 'CRASHED' | 'TERMINATED';

export interface AppServiceState {
  enabled: boolean;
  status: AppServiceStatus;
  appId: string;
  workerId: string;
  vdomPatchCount: number;
  messageCount: number;
  lastWorkerAction: string | null;
  lastError: string | null;
  laneCounts: {
    host: number;
    appService: number;
    appView: number;
  };
}

export interface LatencyStats {
  totalCalls: number;
  warmPathCalls: number;
  warmPathPercentage: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  recentDurations: number[];
}

export const SHOWCASE_TABS: MiniAppTab[] = [
  {
    id: 'ecommerce',
    appId: 'com.goat.ecommerce',
    name: 'E-Commerce',
    subtitle: 'Payments & Cart',
    icon: '🛍️',
    badge: '18 Actions',
    route: '#/ecommerce',
    primaryColor: '#6366F1',
    domainName: 'E-Commerce & Payments',
    description: 'Product catalog, cart state, Apple/Google Pay, Bakong/Alipay/PayPay, bottom-sheet checkout',
  },
  {
    id: 'iot',
    appId: 'com.goat.iot',
    name: 'IoT & HW',
    subtitle: 'BLE, NFC, 3D',
    icon: '📡',
    badge: '24 Actions',
    route: '#/iot',
    primaryColor: '#06B6D4',
    domainName: 'IoT & Hardware Dashboard',
    description: 'Bluetooth Low Energy scanning, NFC NDEF reading/writing, 3D motion orientation sensor fusion',
  },
  {
    id: 'fieldservice',
    appId: 'com.goat.fieldservice',
    name: 'Field Service',
    subtitle: 'GPS & Telemetry',
    icon: '🗺️',
    badge: '22 Actions',
    route: '#/fieldservice',
    primaryColor: '#10B981',
    domainName: 'Field Service & Navigation',
    description: 'Real-time GPS telemetry, geofence boundary monitoring, camera QR/barcode scanner, voice memo',
  },
  {
    id: 'vault',
    appId: 'com.goat.vault',
    name: 'Vault',
    subtitle: 'Biometrics & AES',
    icon: '🔒',
    badge: '16 Actions',
    route: '#/vault',
    primaryColor: '#8B5CF6',
    domainName: 'Secure Biometric Vault',
    description: 'Biometric FaceID/TouchID gate, AES-256 KeyStore encryption, sandboxed isolated filesystem',
  },
  {
    id: 'diagnostics',
    appId: 'com.goat.diagnostics',
    name: 'Diagnostics',
    subtitle: 'IPC & Engine',
    icon: '🛠️',
    badge: 'TurboModule',
    route: '#/diagnostics',
    primaryColor: '#F59E0B',
    domainName: 'Diagnostics & Latency Benchmark',
    description: 'Engine prewarming, cache control, Fabric vs Paper inspector, warm-path IPC benchmark suite',
  },
];
