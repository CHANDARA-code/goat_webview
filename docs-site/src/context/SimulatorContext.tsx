import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  GoatBridgeMock,
  mockState,
  SUPPORTED_ACTIONS,
  GoatBridgeError,
  BridgeErrorCodes,
} from '@goat/bridge-mock';
import type {
  MockHardwareState,
  PlatformType,
  ThemeType,
  NetworkType,
  BiometricType,
  BiometricMockResult,
  GpsLocation,
  BridgeTrace,
  NavBarState,
  BottomSheetState,
  PermissionDialogState,
  PermissionType,
  PermissionStatus,
  ExternalLinkDialogState,
  HapticEvent,
  BiometricsModalState,
} from '../types/simulator';

export const EXECUTABLE_ACTION_COUNT = SUPPORTED_ACTIONS.size;

export const GPS_PRESETS: Record<string, GpsLocation> = {
  sf: { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, accuracy: 5, altitude: 16, speed: 0 },
  tokyo: { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, accuracy: 3, altitude: 40, speed: 0 },
  london: { name: 'London, UK', lat: 51.5074, lng: -0.1278, accuracy: 8, altitude: 25, speed: 0 },
  paris: { name: 'Paris, France', lat: 48.8566, lng: 2.3522, accuracy: 6, altitude: 35, speed: 0 },
};

const DEFAULT_HARDWARE_STATE: MockHardwareState = {
  platform: 'ios',
  theme: 'dark',
  battery: {
    level: 92,
    charging: false,
    isLow: false,
  },
  network: {
    type: 'wifi',
    latencyMs: 35,
  },
  gps: GPS_PRESETS.sf,
  biometrics: {
    biometryType: 'face',
    mockResult: 'success',
    attempts: 0,
  },
};

const DEFAULT_NAVBAR_STATE: NavBarState = {
  title: 'Goat Mini App',
  subtitle: 'High-Performance Engine',
  backgroundColor: '#26241F',
  textColor: '#F4F3EE',
  isDark: true,
  progress: {
    visible: true,
    percent: 65,
  },
  leftButton: {
    id: 'btn_back',
    text: 'Back',
    icon: 'chevron-left',
    enabled: true,
  },
  rightButtons: [
    { id: 'btn_search', text: 'Search', icon: 'search', enabled: true },
    { id: 'btn_menu', text: 'Options', icon: 'more-vertical', enabled: true },
  ],
};

const DEFAULT_BOTTOM_SHEET_STATE: BottomSheetState = {
  isOpen: false,
  currentSnapIndex: 1,
  snapPoints: [0.25, 0.5, 0.9],
  heightPreset: 'half',
  customHeight: 380,
  isDismissible: true,
  activeTab: 'cart',
  tabs: [
    { id: 'cart', title: 'Shopping Cart', content: '3 Items in cart — $142.50 Total' },
    { id: 'delivery', title: 'Delivery Info', content: 'Standard 2-Day Air to 123 Tech Blvd, San Francisco' },
    { id: 'voucher', title: 'Coupons', content: 'GOAT2026 (-20% applied successfully)' },
  ],
};

const DEFAULT_PERMISSION_STATE: PermissionDialogState = {
  activePermission: null,
  stage: 'idle',
  statusMap: {
    camera: 'not_determined',
    location: 'not_determined',
    notifications: 'not_determined',
    contacts: 'not_determined',
    bluetooth: 'not_determined',
  },
};

const DEFAULT_EXTERNAL_LINK_STATE: ExternalLinkDialogState = {
  isOpen: false,
  url: 'https://checkout.stripe.com/pay/cs_test_goat123',
  destinationHost: 'checkout.stripe.com',
  sessionAllowedHosts: ['github.com', 'goat-webview.github.io'],
  dontAskAgainChecked: false,
  status: 'idle',
};

const DEFAULT_BIOMETRICS_MODAL_STATE: BiometricsModalState = {
  isOpen: false,
  reason: 'Authenticate to complete transaction of $49.99',
  state: 'idle',
  authResult: null,
};

export const DEFAULT_PLAYGROUND_CODE = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #F4F3EE; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
      pre { background: #1A1917; padding: 10px; border-radius: 8px; font-size: 11px; overflow-x: auto; max-height: 280px; }
      .btn-row { margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <h3>Goat Mini-App Workspace</h3>
    <div class="btn-row">
      <button id="btn-device">Get Device Info</button>
      <button id="btn-location">Get Location</button>
      <button id="btn-storage">Test Storage</button>
      <button id="btn-haptic">Trigger Haptic</button>
    </div>
    <pre id="out">Press a button to invoke the bridge…</pre>
    <script>
      function log(label, data) {
        console.log('[' + label + ']', data);
        document.getElementById('out').textContent = label + ':\\n' + JSON.stringify(data, null, 2);
      }

      document.getElementById('btn-device').addEventListener('click', async () => {
        const info = await goatBridge.callNative('GET_DEVICE_INFO', {});
        log('Device Info', info);
      });

      document.getElementById('btn-location').addEventListener('click', async () => {
        try {
          const loc = await goatBridge.callNative('GET_LOCATION', {});
          log('Location', loc);
        } catch (err) {
          console.error('Location Error', err);
          log('Location Error', err);
        }
      });

      document.getElementById('btn-storage').addEventListener('click', async () => {
        await goatBridge.callNative('STORAGE_SET', { key: 'sample.user', value: 'Goat Engineer' });
        const res = await goatBridge.callNative('STORAGE_GET', { key: 'sample.user' });
        log('Storage Result', res);
      });

      document.getElementById('btn-haptic').addEventListener('click', async () => {
        const res = await goatBridge.callNative('HAPTIC_FEEDBACK', { type: 'heavy' });
        log('Haptic', res);
      });
    </script>
  </body>
</html>
`;

export interface ConsoleLogEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  messages: string[];
  timestamp: number;
}

export interface ChaosConfig {
  enabled: boolean;
  failureRate: number;
}

export interface SimulatorStats {
  totalCalls: number;
  totalErrors: number;
  lastRunTimestamp: number | null;
}

export interface StorageSnapshot {
  storage: Record<string, string>;
  secureStorage: Record<string, string>;
  cookies: any[];
  files: Array<{ path: string; size: number; isDir: boolean; lastModified: number }>;
}

function resolvePermissionType(payload: Record<string, any>): PermissionType {
  const raw = (payload.permission ?? payload.scope ?? 'camera') as string;
  return (raw.startsWith('scope.') ? raw.slice('scope.'.length) : raw) as PermissionType;
}

function resolveHapticType(payload: Record<string, any>): HapticEvent['type'] {
  if (payload.type === 'impact' && payload.style) return payload.style as HapticEvent['type'];
  if (payload.type === 'notification' && payload.notificationType) return payload.notificationType as HapticEvent['type'];
  if (payload.type === 'selection') return 'selection';
  return (payload.type as HapticEvent['type']) || 'light';
}

const LEGACY_ACTION_ALIASES: Record<string, string> = {
  NAV_BAR_SET_TITLE: 'SET_NAV_BAR_TITLE',
  NAV_BAR_SET_COLOR: 'SET_NAV_BAR_COLOR',
  NAV_BAR_SET_BUTTONS: 'SET_NAV_BAR_BUTTONS',
  NAV_BAR_SET_PROGRESS: 'SET_NAV_BAR_PROGRESS',
  BOTTOM_SHEET_OPEN: 'EXPAND_BOTTOM_SHEET',
  BOTTOM_SHEET_CLOSE: 'COLLAPSE_BOTTOM_SHEET',
  BIOMETRIC_AUTH: 'BIOMETRIC_AUTH',
};

function inferDomain(action: string): string {
  if (action.startsWith('NAV_BAR_') || action.startsWith('SET_NAV_BAR_') || action.startsWith('PAGE_') || action.startsWith('TAB_')) return 'Navigation';
  if (action.startsWith('BOTTOM_SHEET_') || action.includes('SHEET') || action.includes('TOAST') || action.includes('MODAL')) return 'UI Sheet';
  if (action.includes('PERMISSION') || action === 'OPEN_SETTING' || action === 'GET_SETTING') return 'Permissions';
  if (action.includes('EXTERNAL_LINK') || action.includes('URL') || action.includes('OAUTH')) return 'Security';
  if (action.includes('HAPTIC') || action.includes('ACCELEROMETER') || action.includes('GYRO')) return 'Sensors';
  if (action.includes('BIOMETRIC') || action.includes('PASSKEY')) return 'Biometrics';
  if (action.includes('STORAGE') || action.includes('COOKIE')) return 'Storage';
  if (action.startsWith('FS_') || action.includes('FILE')) return 'FileSystem';
  if (action.includes('LOCATION') || action.includes('GEOFENCE')) return 'Geolocation';
  if (action.includes('NETWORK') || action.includes('SOCKET') || action.includes('API_REQUEST')) return 'Network';
  if (action.includes('DEVICE') || action.includes('BATTERY') || action.includes('BRIGHTNESS')) return 'Hardware';
  if (action.includes('BLE_') || action.includes('NFC_')) return 'IoT & Bluetooth';
  if (action.includes('WEB3_') || action.includes('PAY_') || action.includes('IAP_')) return 'Payments';
  return 'Core';
}

function inferThreadLane(action: string): string {
  if (action.includes('UI_PATCH') || action.includes('WORKER')) return 'appservice_to_appview';
  if (action.includes('PUSH') || action.includes('EVENT')) return 'native_to_appview';
  return 'appview_to_native';
}

export type ActiveWidgetTab = 'playground' | 'navbar' | 'bottomsheet' | 'permission' | 'externallink' | 'haptics' | 'biometrics';

interface SimulatorContextType {
  hardware: MockHardwareState;
  setHardware: React.Dispatch<React.SetStateAction<MockHardwareState>>;
  updateHardware: <K extends keyof MockHardwareState>(key: K, val: MockHardwareState[K]) => void;

  navBar: NavBarState;
  setNavBar: React.Dispatch<React.SetStateAction<NavBarState>>;

  bottomSheet: BottomSheetState;
  setBottomSheet: React.Dispatch<React.SetStateAction<BottomSheetState>>;

  permissionDialog: PermissionDialogState;
  setPermissionDialog: React.Dispatch<React.SetStateAction<PermissionDialogState>>;

  externalLinkDialog: ExternalLinkDialogState;
  setExternalLinkDialog: React.Dispatch<React.SetStateAction<ExternalLinkDialogState>>;

  biometricsModal: BiometricsModalState;
  setBiometricsModal: React.Dispatch<React.SetStateAction<BiometricsModalState>>;

  lastHaptic: HapticEvent | null;
  isHapticRippling: boolean;

  activeWidgetTab: ActiveWidgetTab;
  setActiveWidgetTab: (tab: ActiveWidgetTab) => void;

  frameScale: 'compact' | 'normal' | 'large';
  setFrameScale: (scale: 'compact' | 'normal' | 'large') => void;

  playgroundCode: string;
  setPlaygroundCode: (code: string) => void;
  playgroundRunKey: number;
  runPlayground: () => void;

  traces: BridgeTrace[];
  callBridge: (action: string, payload?: Record<string, any>, domain?: string) => Promise<BridgeTrace>;
  clearTraces: () => void;

  // Real Coverage & Hostile Simulation
  executableActionCount: number;
  chaosConfig: ChaosConfig;
  setChaosConfig: React.Dispatch<React.SetStateAction<ChaosConfig>>;
  updateChaos: (enabled: boolean, failureRate: number) => void;
  stats: SimulatorStats;

  // Console instrumentation
  consoleLogs: ConsoleLogEntry[];
  addConsoleLog: (log: ConsoleLogEntry) => void;
  clearConsoleLogs: () => void;

  // Storage Inspector
  getStorageSnapshot: () => StorageSnapshot;
  clearStorageType: (type: 'storage' | 'secureStorage' | 'cookies' | 'fs' | 'all') => void;

  // Interactive Helper Methods
  triggerHaptic: (type: HapticEvent['type']) => Promise<void>;
  triggerBiometrics: (reason?: string) => Promise<Record<string, any>>;
  requestPermissionFlow: (perm: PermissionType) => void;
  confirmPermissionStage1: () => void;
  respondPermissionSystemPrompt: (status: PermissionStatus) => void;
  openExternalLinkFlow: (url: string) => void;
  confirmExternalLinkOpen: () => void;
  cancelExternalLink: () => void;
  clearExternalLinkAllowlist: () => void;
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

let traceCounter = 0;
const bridgeMockInstance = new GoatBridgeMock();

function syncHardwareToMockState(hw: MockHardwareState, permMap: Record<PermissionType, PermissionStatus>) {
  mockState.deviceInfo.platform = hw.platform === 'ios' ? 'ios' : 'android';
  mockState.deviceInfo.model = hw.platform === 'ios' ? 'iPhone 18 Pro (Simulated)' : 'Pixel 10 (Simulated)';
  mockState.deviceInfo.brand = hw.platform === 'ios' ? 'Apple' : 'Google';

  mockState.battery.level = hw.battery.level;
  mockState.battery.isCharging = hw.battery.charging;
  mockState.deviceInfo.batteryLevel = hw.battery.level;
  mockState.deviceInfo.isCharging = hw.battery.charging;

  mockState.network.networkType = hw.network.type === 'offline' ? 'none' : hw.network.type;
  mockState.network.isConnected = hw.network.type !== 'offline';

  mockState.location.latitude = hw.gps.lat;
  mockState.location.longitude = hw.gps.lng;
  mockState.location.accuracy = hw.gps.accuracy;
  mockState.location.altitude = hw.gps.altitude || 16;
  mockState.location.speed = hw.gps.speed || 0;

  mockState.biometrics.supported = hw.biometrics.mockResult !== 'locked' ? true : true;
  mockState.biometrics.biometryType = hw.biometrics.biometryType === 'none' ? 'none' : hw.biometrics.biometryType === 'touch' ? 'fingerprint' : 'face';
  mockState.biometrics.autoAuthSuccess = hw.biometrics.mockResult === 'success';
  mockState.biometrics.isLockedOut = hw.biometrics.mockResult === 'locked';

  if (hw.biometrics.mockResult === 'fail') {
    mockState.biometrics.autoAuthSuccess = false;
    (mockState.biometrics as any).errorOnAuth = 'AUTH_FAILED';
  } else {
    delete (mockState.biometrics as any).errorOnAuth;
  }

  mockState.statusBarDark = hw.theme === 'dark';
  mockState.deviceInfo.isAlgorithmicDarkening = hw.theme === 'dark';

  mockState.permissions.set('LOCATION', permMap.location === 'granted');
  mockState.permissions.set('CAMERA', permMap.camera === 'granted');
  mockState.permissions.set('BIOMETRIC', permMap.camera !== 'denied');
  mockState.permissions.set('CONTACTS', permMap.contacts === 'granted');
  mockState.permissions.set('BLUETOOTH', permMap.bluetooth === 'granted');
  mockState.permissions.set('NOTIFICATION', permMap.notifications === 'granted');

  mockState.recordUserGesture();
}

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hardware, setHardware] = useState<MockHardwareState>(DEFAULT_HARDWARE_STATE);
  const [navBar, setNavBar] = useState<NavBarState>(DEFAULT_NAVBAR_STATE);
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>(DEFAULT_BOTTOM_SHEET_STATE);
  const [permissionDialog, setPermissionDialog] = useState<PermissionDialogState>(DEFAULT_PERMISSION_STATE);
  const [externalLinkDialog, setExternalLinkDialog] = useState<ExternalLinkDialogState>(DEFAULT_EXTERNAL_LINK_STATE);
  const [biometricsModal, setBiometricsModal] = useState<BiometricsModalState>(DEFAULT_BIOMETRICS_MODAL_STATE);
  const [lastHaptic, setLastHaptic] = useState<HapticEvent | null>(null);
  const [isHapticRippling, setIsHapticRippling] = useState(false);
  const [activeWidgetTab, setActiveWidgetTab] = useState<ActiveWidgetTab>('playground');
  const [frameScale, setFrameScale] = useState<'compact' | 'normal' | 'large'>('normal');
  const [playgroundCode, setPlaygroundCode] = useState<string>(DEFAULT_PLAYGROUND_CODE);
  const [playgroundRunKey, setPlaygroundRunKey] = useState(0);

  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>({ enabled: false, failureRate: 25 });
  const [stats, setStats] = useState<SimulatorStats>({ totalCalls: 0, totalErrors: 0, lastRunTimestamp: null });
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);

  const [traces, setTraces] = useState<BridgeTrace[]>([
    {
      id: 'rpc-seed-101',
      timestamp: Date.now() - 3200,
      domain: 'Sensors',
      action: 'HAPTIC_FEEDBACK',
      payload: { type: 'heavy', intensity: 1.0 },
      response: { success: true, patternMs: [40] },
      latencyMs: 3.2,
      status: 'success',
      threadLane: 'appservice_to_appview',
      seqId: 1,
      batchId: 'batch_seed_001',
      workerIpcLatencyMs: 0.6,
      nativeExecutionLatencyMs: 2.1,
      domRenderLatencyMs: 0.5,
    },
  ]);

  const hardwareRef = useRef(hardware);
  hardwareRef.current = hardware;

  const permissionDialogRef = useRef(permissionDialog);
  permissionDialogRef.current = permissionDialog;

  const chaosConfigRef = useRef(chaosConfig);
  chaosConfigRef.current = chaosConfig;

  // Initialize seed storage in mockState once
  useEffect(() => {
    const appId = mockState.defaultAppId;
    if (!mockState.storage.has(appId)) {
      const m = new Map<string, string>();
      m.set('user.theme', 'dark');
      m.set('session.locale', 'en-US');
      mockState.storage.set(appId, m);
    }
    if (!mockState.secureStorage.has(appId)) {
      const m = new Map<string, string>();
      m.set('auth.token', 'sec_jwt_goat_9921_mock');
      mockState.secureStorage.set(appId, m);
    }
  }, []);

  const runPlayground = useCallback(() => {
    setPlaygroundRunKey((k) => k + 1);
    setStats((s) => ({ ...s, lastRunTimestamp: Date.now() }));
  }, []);

  const updateHardware = useCallback(<K extends keyof MockHardwareState>(key: K, val: MockHardwareState[K]) => {
    setHardware((prev) => {
      const next = { ...prev, [key]: val };
      syncHardwareToMockState(next, permissionDialogRef.current.statusMap);
      return next;
    });
  }, []);

  const updateChaos = useCallback((enabled: boolean, failureRate: number) => {
    setChaosConfig({ enabled, failureRate: Math.max(1, Math.min(100, failureRate)) });
  }, []);

  const clearTraces = useCallback(() => {
    setTraces([]);
  }, []);

  const addConsoleLog = useCallback((log: ConsoleLogEntry) => {
    setConsoleLogs((prev) => [...prev.slice(-199), log]);
  }, []);

  const clearConsoleLogs = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const getStorageSnapshot = useCallback((): StorageSnapshot => {
    const appId = mockState.defaultAppId;
    const rawStorage = mockState.storage.get(appId) || new Map();
    const rawSecure = mockState.secureStorage.get(appId) || new Map();
    const rawCookies = mockState.cookies.get(appId) || [];
    const rawFs = mockState.fs.get(appId) || new Map();

    const storage: Record<string, string> = {};
    rawStorage.forEach((v, k) => {
      storage[k] = v;
    });

    const secureStorage: Record<string, string> = {};
    rawSecure.forEach((v, k) => {
      secureStorage[k] = v;
    });

    const cookies = [...rawCookies];

    const files: Array<{ path: string; size: number; isDir: boolean; lastModified: number }> = [];
    rawFs.forEach((v, k) => {
      files.push({
        path: k,
        size: v.data ? v.data.length : 0,
        isDir: v.isDir,
        lastModified: v.lastModified,
      });
    });

    return { storage, secureStorage, cookies, files };
  }, []);

  const clearStorageType = useCallback((type: 'storage' | 'secureStorage' | 'cookies' | 'fs' | 'all') => {
    const appId = mockState.defaultAppId;
    if (type === 'storage' || type === 'all') {
      mockState.storage.get(appId)?.clear();
    }
    if (type === 'secureStorage' || type === 'all') {
      mockState.secureStorage.get(appId)?.clear();
    }
    if (type === 'cookies' || type === 'all') {
      mockState.cookies.delete(appId);
    }
    if (type === 'fs' || type === 'all') {
      mockState.fs.get(appId)?.clear();
    }
  }, []);

  const handleReactUiSync = useCallback((action: string, payload: Record<string, any>) => {
    if (action === 'SET_NAV_BAR_TITLE') {
      const title = payload.title ?? 'Goat Mini App';
      const subtitle = payload.subtitle ?? '';
      setNavBar((prev) => ({ ...prev, title, subtitle }));
    } else if (action === 'SET_NAV_BAR_COLOR') {
      const color = payload.backgroundColor ?? payload.color ?? '#26241F';
      const textColor = payload.textColor ?? '#F4F3EE';
      const isDark = typeof payload.isDark === 'boolean' ? payload.isDark : true;
      setNavBar((prev) => ({ ...prev, backgroundColor: color, textColor, isDark }));
    } else if (action === 'SET_NAV_BAR_BUTTONS') {
      const leftButton = payload.leftButton ?? payload.left ?? null;
      const rightButtons = payload.rightButtons ?? payload.right ?? [];
      setNavBar((prev) => ({ ...prev, leftButton, rightButtons }));
    } else if (action === 'SET_NAV_BAR_PROGRESS') {
      const percent = payload.percent ?? payload.progress ?? 50;
      const visible = payload.visible ?? true;
      setNavBar((prev) => ({ ...prev, progress: { visible, percent } }));
    } else if (action === 'EXPAND_BOTTOM_SHEET') {
      const snapIndex = payload.snapIndex ?? 1;
      const height = payload.height ?? 380;
      setBottomSheet((prev) => ({ ...prev, isOpen: true, currentSnapIndex: snapIndex, customHeight: height }));
    } else if (action === 'COLLAPSE_BOTTOM_SHEET') {
      setBottomSheet((prev) => ({ ...prev, isOpen: false }));
    } else if (action === 'SET_SHEET_SNAP_POINTS') {
      const snapPoints = payload.snapPoints ?? [0.25, 0.5, 0.9];
      setBottomSheet((prev) => ({ ...prev, snapPoints }));
    } else if (action === 'HAPTIC_FEEDBACK') {
      const hapticType = resolveHapticType(payload);
      setLastHaptic({ type: hapticType, timestamp: Date.now() });
      setIsHapticRippling(true);
      setTimeout(() => setIsHapticRippling(false), 450);
    }
  }, []);

  const callBridge = useCallback(
    async (rawAction: string, payload: Record<string, any> = {}, customDomain?: string): Promise<BridgeTrace> => {
      const id = `rpc-${Date.now()}-${++traceCounter}`;
      const timestamp = Date.now();
      const currentHw = hardwareRef.current;
      const currentPerms = permissionDialogRef.current.statusMap;

      let action = rawAction;
      if (LEGACY_ACTION_ALIASES[action]) {
        action = LEGACY_ACTION_ALIASES[action];
      }

      const domain = customDomain || inferDomain(action);
      const threadLane = inferThreadLane(action);

      const pendingTrace: BridgeTrace = {
        id,
        timestamp,
        domain,
        action: rawAction,
        payload,
        response: null,
        latencyMs: 0,
        status: 'pending',
        threadLane,
        seqId: traceCounter,
      };

      setTraces((prev) => [pendingTrace, ...prev.slice(0, 99)]);
      setStats((s) => ({ ...s, totalCalls: s.totalCalls + 1, lastRunTimestamp: Date.now() }));

      syncHardwareToMockState(currentHw, currentPerms);

      // Chaos Injection
      if (chaosConfigRef.current.enabled && Math.random() * 100 < chaosConfigRef.current.failureRate) {
        const errorTrace: BridgeTrace = {
          ...pendingTrace,
          latencyMs: 14,
          status: 'error',
          errorMessage: `CHAOS_FAULT_INJECTED: Synthetic RPC failure by chaos mode (${chaosConfigRef.current.failureRate}%)`,
          response: {
            success: false,
            code: 'CHAOS_INJECTED',
            message: `Synthetic bridge failure injected by chaos engine (${chaosConfigRef.current.failureRate}% rate)`,
          },
        };
        setTraces((prev) => prev.map((t) => (t.id === id ? errorTrace : t)));
        setStats((s) => ({ ...s, totalErrors: s.totalErrors + 1 }));
        return errorTrace;
      }

      // Offline check for network actions
      if (currentHw.network.type === 'offline' && (action === 'API_REQUEST' || action === 'DOWNLOAD_FILE' || action === 'UPLOAD_FILE')) {
        const errorTrace: BridgeTrace = {
          ...pendingTrace,
          latencyMs: 8,
          status: 'error',
          errorMessage: 'NETWORK_OFFLINE: Device is currently disconnected from internet',
          response: {
            success: false,
            code: 'NETWORK_OFFLINE',
            message: 'Network unavailable in offline mock mode',
          },
        };
        setTraces((prev) => prev.map((t) => (t.id === id ? errorTrace : t)));
        setStats((s) => ({ ...s, totalErrors: s.totalErrors + 1 }));
        return errorTrace;
      }

      // Simulated network/IPC latency
      const jitter = Math.floor(Math.random() * 20) - 10;
      const effectiveLatency = currentHw.network.type === 'offline' ? 5 : Math.max(8, currentHw.network.latencyMs + jitter);
      await new Promise((res) => setTimeout(res, effectiveLatency));

      handleReactUiSync(action, payload);

      let response: any = null;
      let status: 'success' | 'error' = 'success';
      let errorMessage: string | undefined = undefined;

      try {
        response = await bridgeMockInstance.callNative(action, payload);
      } catch (err: any) {
        status = 'error';
        const code = err instanceof GoatBridgeError ? err.code : err?.code || 'EXECUTION_ERROR';
        errorMessage = `${code}: ${err?.message || String(err)}`;
        response = {
          success: false,
          code,
          message: err?.message || String(err),
          details: err?.details,
        };
        setStats((s) => ({ ...s, totalErrors: s.totalErrors + 1 }));
      }

      const workerIpcLatencyMs = Math.max(0.4, Number((effectiveLatency * 0.18).toFixed(1)));
      const nativeExecutionLatencyMs = Math.max(0.6, Number((effectiveLatency * 0.68).toFixed(1)));
      const domRenderLatencyMs = Math.max(0.2, Number((effectiveLatency - workerIpcLatencyMs - nativeExecutionLatencyMs).toFixed(1)));

      const completedTrace: BridgeTrace = {
        ...pendingTrace,
        response,
        latencyMs: effectiveLatency,
        status,
        errorMessage,
        workerIpcLatencyMs,
        nativeExecutionLatencyMs,
        domRenderLatencyMs,
      };

      setTraces((prev) => prev.map((t) => (t.id === id ? completedTrace : t)));
      return completedTrace;
    },
    [handleReactUiSync]
  );

  const triggerHaptic = useCallback(
    async (type: HapticEvent['type']) => {
      await callBridge('HAPTIC_FEEDBACK', { type }, 'Sensors');
    },
    [callBridge]
  );

  const triggerBiometrics = useCallback(
    async (reason = 'Verify Identity') => {
      setBiometricsModal({ isOpen: true, reason, state: 'scanning', authResult: null });
      const trace = await callBridge('BIOMETRIC_AUTH', { reason }, 'Biometrics');
      const isSuccess = trace.status === 'success' && trace.response?.authenticated !== false;
      setBiometricsModal((prev) => ({
        ...prev,
        state: isSuccess ? 'matched' : 'failed',
        authResult: trace.response,
      }));
      setTimeout(() => {
        setBiometricsModal((prev) => ({ ...prev, isOpen: false }));
      }, 1400);
      return trace.response || {};
    },
    [callBridge]
  );

  const requestPermissionFlow = useCallback(
    (perm: PermissionType) => {
      setPermissionDialog((prev) => ({ ...prev, activePermission: perm, stage: 'priming' }));
    },
    []
  );

  const confirmPermissionStage1 = useCallback(() => {
    setPermissionDialog((prev) => ({ ...prev, stage: 'system_prompt' }));
  }, []);

  const respondPermissionSystemPrompt = useCallback((permStatus: PermissionStatus) => {
    setPermissionDialog((prev) => {
      if (!prev.activePermission) return prev;
      const nextMap = { ...prev.statusMap, [prev.activePermission]: permStatus };
      mockState.permissions.set(prev.activePermission.toUpperCase(), permStatus === 'granted');
      return {
        ...prev,
        statusMap: nextMap,
        stage: permStatus === 'permanently_denied' ? 'permanently_denied_dialog' : 'idle',
      };
    });
  }, []);

  const openExternalLinkFlow = useCallback((url: string) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      setExternalLinkDialog((prev) => ({
        ...prev,
        isOpen: true,
        url,
        destinationHost: urlObj.hostname,
        status: 'warning',
      }));
    } catch {
      setExternalLinkDialog((prev) => ({ ...prev, isOpen: true, url, destinationHost: 'unknown', status: 'warning' }));
    }
  }, []);

  const confirmExternalLinkOpen = useCallback(() => {
    setExternalLinkDialog((prev) => ({
      ...prev,
      isOpen: false,
      status: 'opened',
      sessionAllowedHosts: prev.dontAskAgainChecked
        ? [...prev.sessionAllowedHosts, prev.destinationHost]
        : prev.sessionAllowedHosts,
    }));
  }, []);

  const cancelExternalLink = useCallback(() => {
    setExternalLinkDialog((prev) => ({ ...prev, isOpen: false, status: 'cancelled' }));
  }, []);

  const clearExternalLinkAllowlist = useCallback(() => {
    setExternalLinkDialog((prev) => ({ ...prev, sessionAllowedHosts: ['github.com', 'goat-webview.github.io'] }));
  }, []);

  const value = {
    hardware,
    setHardware,
    updateHardware,
    navBar,
    setNavBar,
    bottomSheet,
    setBottomSheet,
    permissionDialog,
    setPermissionDialog,
    externalLinkDialog,
    setExternalLinkDialog,
    biometricsModal,
    setBiometricsModal,
    lastHaptic,
    isHapticRippling,
    activeWidgetTab,
    setActiveWidgetTab,
    frameScale,
    setFrameScale,
    playgroundCode,
    setPlaygroundCode,
    playgroundRunKey,
    runPlayground,
    traces,
    callBridge,
    clearTraces,
    executableActionCount: EXECUTABLE_ACTION_COUNT,
    chaosConfig,
    setChaosConfig,
    updateChaos,
    stats,
    consoleLogs,
    addConsoleLog,
    clearConsoleLogs,
    getStorageSnapshot,
    clearStorageType,
    triggerHaptic,
    triggerBiometrics,
    requestPermissionFlow,
    confirmPermissionStage1,
    respondPermissionSystemPrompt,
    openExternalLinkFlow,
    confirmExternalLinkOpen,
    cancelExternalLink,
    clearExternalLinkAllowlist,
  };

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
};

export function useSimulator(): SimulatorContextType {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
}
