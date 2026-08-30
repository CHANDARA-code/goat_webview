/**
 * @goat/bridge-mock - Mock State Types & Snapshot Interfaces
 */

import {
  DeviceInfo,
  LocationData,
  GetNetworkTypeResult,
  SafeAreaInsetsResult,
  KeyboardInsetsResult,
  NavBarConfigPayload,
  BottomSheetResult,
  BleDevice,
  AudioStateResult,
  ContactResult,
  GeofenceRegionResult,
  IapProductItem,
  PageStackEntryPayload,
  NativeComponentDescriptorResult,
  ApiCapabilityResult,
  StartupBenchmarkReportResult,
  ApmMetricsPayload,
  TraceEnvelope,
  CookieItem,
  NfcTagResult,
  TabHandle,
  OpenMiniAppResult,
  MediaFile,
} from '../types.js';

export interface BiometricConfig {
  supported: boolean;
  biometryType: 'face' | 'fingerprint' | 'none';
  autoAuthSuccess: boolean;
  errorOnAuth?: string;
  maxAttempts: number;
  failedAttempts: number;
  isLockedOut?: boolean;
}

export interface ScannerConfig {
  mockScanResult: string;
  mockScanType: string;
  scanDelayMs: number;
  autoScan: boolean;
}

export interface Web3Config {
  connected: boolean;
  address: string;
  publicKey: string;
  wallet: string;
  network: string;
  chainId: string;
  privateKeyMock: string;
}

export interface MockStateSnapshot {
  deviceInfo: DeviceInfo;
  battery: { level: number; isCharging: boolean };
  network: GetNetworkTypeResult;
  brightness: number;
  keepScreenOn: boolean;
  statusBarDark: boolean;
  clipboard: string;
  storage: Record<string, Record<string, string>>;
  secureStorage: Record<string, Record<string, string>>;
  cookies: Record<string, CookieItem[]>;
  httpAuthCreds: Record<string, { username: string; password: string }>;
  fs: Record<string, Record<string, { data: string; isDir: boolean; lastModified: number; isFile: boolean }>>;
  permissions: Record<string, boolean>;
  location: LocationData;
  geofences: Record<string, GeofenceRegionResult>;
  biometrics: BiometricConfig;
  scanner: ScannerConfig;
  media: MediaFile[];
  audio: AudioStateResult;
  contacts: ContactResult[];
  navBar: NavBarConfigPayload;
  bottomSheet: BottomSheetResult;
  safeAreaInsets: SafeAreaInsetsResult;
  keyboardInsets: KeyboardInsetsResult;
  tabs: TabHandle[];
  activeTabId: string | null;
  miniAppInstances: Record<string, OpenMiniAppResult>;
  bleDevices: BleDevice[];
  bleScanning: boolean;
  connectedBleDevices: string[];
  bleCharacteristics: Record<string, string>;
  nfcEnabled: boolean;
  nfcDiscovering: boolean;
  nfcTag: NfcTagResult;
  web3: Web3Config;
  iapProducts: IapProductItem[];
  iapPurchases: Array<{ invoiceSlug: string; status: string; transactionId: string; amount: number }>;
  binaryPorts: Record<string, { queue: Array<{ dataBase64: string; seq: number }>; closed: boolean; currentSeq: number }>;
  pageStack: PageStackEntryPayload[];
  subpackages: Record<string, { isCached: boolean; byteSize: number; extractedPath: string }>;
  bytecodeCache: Record<string, { bytecodeSizeBytes: number; cachePath: string; isWarm: boolean }>;
  activeNativeViews: Record<string, NativeComponentDescriptorResult>;
  isTransparentWindow: boolean;
  windowBgHex: string;
  dynamicCapabilities: Record<string, ApiCapabilityResult>;
  apmMetrics: ApmMetricsPayload[];
  startupBenchmark: StartupBenchmarkReportResult;
  bridgeTimings: Array<{ action: string; durationMs: number; id: string }>;
  traces: TraceEnvelope[];
  activeSpans: Record<string, { spanId: string; traceId: string; opName: string; startMs: number; traceparent: string }>;
  completedSpans: Array<{ spanId: string; traceId: string; opName: string; durationMs: number }>;
  pushToken: string;
  badgeCount: number;
  pushTopics: string[];
  pendingNotifications: Array<{ title: string; content: string; channelId?: string; data?: any }>;
  lastUserGestureTimestamp: number;
  lastDialogTimestamp: number;
  enforceGestureFreshness: boolean;
  enforceDialogCooldown: boolean;
}
