import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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
  backgroundColor: '#1e293b',
  textColor: '#ffffff',
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

export type ActiveWidgetTab = 'navbar' | 'bottomsheet' | 'permission' | 'externallink' | 'haptics' | 'biometrics';

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
  
  traces: BridgeTrace[];
  callBridge: (action: string, payload: Record<string, any>, domain?: string) => Promise<BridgeTrace>;
  clearTraces: () => void;
  
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

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hardware, setHardware] = useState<MockHardwareState>(DEFAULT_HARDWARE_STATE);
  const [navBar, setNavBar] = useState<NavBarState>(DEFAULT_NAVBAR_STATE);
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>(DEFAULT_BOTTOM_SHEET_STATE);
  const [permissionDialog, setPermissionDialog] = useState<PermissionDialogState>(DEFAULT_PERMISSION_STATE);
  const [externalLinkDialog, setExternalLinkDialog] = useState<ExternalLinkDialogState>(DEFAULT_EXTERNAL_LINK_STATE);
  const [biometricsModal, setBiometricsModal] = useState<BiometricsModalState>(DEFAULT_BIOMETRICS_MODAL_STATE);
  const [lastHaptic, setLastHaptic] = useState<HapticEvent | null>(null);
  const [isHapticRippling, setIsHapticRippling] = useState(false);
  const [activeWidgetTab, setActiveWidgetTab] = useState<ActiveWidgetTab>('navbar');
  const [frameScale, setFrameScale] = useState<'compact' | 'normal' | 'large'>('normal');
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
    {
      id: 'rpc-seed-102',
      timestamp: Date.now() - 2100,
      domain: 'Biometrics',
      action: 'BIOMETRIC_AUTH',
      payload: { prompt: 'Authorize payment transfer', allowDeviceCredential: true },
      response: { authenticated: true, biometryType: 'face' },
      latencyMs: 14.8,
      status: 'success',
      threadLane: 'appview_to_native',
      seqId: 2,
      workerIpcLatencyMs: 1.2,
      nativeExecutionLatencyMs: 12.4,
      domRenderLatencyMs: 1.2,
    },
    {
      id: 'rpc-seed-103',
      timestamp: Date.now() - 950,
      domain: 'Geolocation',
      action: 'LOCATION_ON_CHANGE',
      payload: { coords: { lat: 37.7749, lng: -122.4194, accuracy: 5.0 } },
      response: { received: true },
      latencyMs: 2.4,
      status: 'success',
      threadLane: 'native_to_appview',
      seqId: 3,
      workerIpcLatencyMs: 0.4,
      nativeExecutionLatencyMs: 1.5,
      domRenderLatencyMs: 0.5,
    },
  ]);

  const hardwareRef = useRef(hardware);
  hardwareRef.current = hardware;

  const updateHardware = useCallback(<K extends keyof MockHardwareState>(key: K, val: MockHardwareState[K]) => {
    setHardware((prev) => ({ ...prev, [key]: val }));
  }, []);

  const clearTraces = useCallback(() => {
    setTraces([]);
  }, []);

  const callBridge = useCallback(
    async (action: string, payload: Record<string, any>, customDomain?: string): Promise<BridgeTrace> => {
      const id = `rpc-${Date.now()}-${++traceCounter}`;
      const timestamp = Date.now();
      const currentHw = hardwareRef.current;

      // Infer domain from action string if not provided
      let domain = customDomain || 'Core';
      if (action.startsWith('NAV_BAR_') || action.startsWith('SET_NAV_BAR_')) domain = 'Navigation';
      else if (action.startsWith('BOTTOM_SHEET_') || action.includes('SHEET')) domain = 'UI Sheet';
      else if (action.includes('PERMISSION') || action === 'OPEN_SETTING') domain = 'Permissions';
      else if (action.includes('EXTERNAL_LINK') || action.includes('URL')) domain = 'Security';
      else if (action.includes('HAPTIC')) domain = 'Sensors';
      else if (action.includes('BIOMETRIC')) domain = 'Biometrics';
      else if (action.includes('STORAGE')) domain = 'Storage';
      else if (action.includes('LOCATION') || action.includes('GEOFENCE')) domain = 'Geolocation';
      else if (action.includes('NETWORK')) domain = 'Network';
      else if (action.includes('DEVICE')) domain = 'Hardware';

      const threadLane =
        action.includes('UI_PATCH') || action.includes('WORKER')
          ? 'appservice_to_appview'
          : action.includes('PUSH') || action.includes('EVENT')
          ? 'native_to_appview'
          : 'appview_to_native';

      const pendingTrace: BridgeTrace = {
        id,
        timestamp,
        domain,
        action,
        payload,
        response: null,
        latencyMs: 0,
        status: 'pending',
        threadLane,
        seqId: traceCounter,
      };

      setTraces((prev) => [pendingTrace, ...prev.slice(0, 99)]); // Keep last 100 traces

      // Check if offline
      if (currentHw.network.type === 'offline' && action !== 'GET_DEVICE_INFO' && !action.startsWith('NAV_BAR_') && !action.includes('HAPTIC')) {
        const errorTrace: BridgeTrace = {
          ...pendingTrace,
          latencyMs: 8,
          status: 'error',
          errorMessage: 'NETWORK_OFFLINE: Device is currently disconnected from internet',
          response: {
            success: false,
            errorCode: 503,
            errorMessage: 'Network unavailable in offline mock mode',
          },
        };
        setTraces((prev) => prev.map((t) => (t.id === id ? errorTrace : t)));
        return errorTrace;
      }

      // Calculate synthetic latency based on hardware network latency slider + jitter
      const jitter = Math.floor(Math.random() * 25) - 10;
      const effectiveLatency = Math.max(8, currentHw.network.latencyMs + jitter);

      await new Promise((res) => setTimeout(res, effectiveLatency));

      let response: Record<string, any> = { success: true };
      let status: 'success' | 'error' = 'success';
      let errorMessage: string | undefined = undefined;

      // Handle Bridge Actions
      switch (action) {
        case 'NAV_BAR_SET_TITLE':
        case 'SET_NAV_BAR_TITLE': {
          const title = payload.title ?? 'Goat Mini App';
          const subtitle = payload.subtitle ?? '';
          setNavBar((prev) => ({ ...prev, title, subtitle }));
          response = { success: true, title, subtitle };
          break;
        }
        case 'NAV_BAR_SET_COLOR':
        case 'SET_NAV_BAR_COLOR': {
          const color = payload.color ?? '#1e293b';
          const textColor = payload.textColor ?? '#ffffff';
          const isDark = payload.isDark ?? true;
          setNavBar((prev) => ({ ...prev, backgroundColor: color, textColor, isDark }));
          response = { success: true, backgroundColor: color, textColor, isDark };
          break;
        }
        case 'NAV_BAR_SET_BUTTONS':
        case 'SET_NAV_BAR_BUTTONS': {
          const leftButton = payload.leftButton ?? null;
          const rightButtons = payload.rightButtons ?? [];
          setNavBar((prev) => ({ ...prev, leftButton, rightButtons }));
          response = { success: true, leftButton, rightButtons };
          break;
        }
        case 'NAV_BAR_SET_PROGRESS':
        case 'SET_NAV_BAR_PROGRESS': {
          const percent = payload.percent ?? payload.progress ?? 50;
          const visible = payload.visible ?? true;
          setNavBar((prev) => ({ ...prev, progress: { visible, percent } }));
          response = { success: true, percent, visible };
          break;
        }
        case 'BOTTOM_SHEET_OPEN':
        case 'EXPAND_BOTTOM_SHEET': {
          const snapIndex = payload.snapIndex ?? 1;
          const height = payload.height ?? 380;
          setBottomSheet((prev) => ({ ...prev, isOpen: true, currentSnapIndex: snapIndex, customHeight: height }));
          response = { success: true, state: 'opened', snapIndex, height };
          break;
        }
        case 'BOTTOM_SHEET_CLOSE':
        case 'COLLAPSE_BOTTOM_SHEET': {
          setBottomSheet((prev) => ({ ...prev, isOpen: false }));
          response = { success: true, state: 'closed' };
          break;
        }
        case 'SET_SHEET_SNAP_POINTS': {
          const snapPoints = payload.snapPoints ?? [0.25, 0.5, 0.9];
          setBottomSheet((prev) => ({ ...prev, snapPoints }));
          response = { success: true, snapPoints };
          break;
        }
        case 'REQUEST_PERMISSION': {
          const perm = (payload.permission as PermissionType) || 'camera';
          const currentStatus = permissionDialog.statusMap[perm] || 'not_determined';
          if (currentStatus === 'granted') {
            response = { granted: true, permission: perm, status: 'granted' };
          } else if (currentStatus === 'permanently_denied') {
            status = 'error';
            errorMessage = 'PERMISSION_PERMANENTLY_DENIED: Direct user to OS settings';
            response = { granted: false, permission: perm, status: 'permanently_denied', requiresSettings: true };
          } else {
            response = { granted: true, permission: perm, status: 'prompt_triggered' };
          }
          break;
        }
        case 'CHECK_PERMISSION': {
          const perm = (payload.permission as PermissionType) || 'camera';
          const currentStatus = permissionDialog.statusMap[perm] || 'not_determined';
          response = { permission: perm, status: currentStatus, granted: currentStatus === 'granted' };
          break;
        }
        case 'OPEN_SETTING': {
          setPermissionDialog((prev) => ({
            ...prev,
            statusMap: {
              ...prev.statusMap,
              camera: 'granted',
              location: 'granted',
              notifications: 'granted',
            },
            stage: 'idle',
          }));
          response = { success: true, opened: 'app_settings', permissionsReset: true };
          break;
        }
        case 'OPEN_EXTERNAL_LINK': {
          const url = payload.url || 'https://checkout.stripe.com';
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          const host = urlObj.hostname;
          const isAllowed = externalLinkDialog.sessionAllowedHosts.includes(host);
          if (isAllowed || payload.skipWarningIfOptedOut) {
            response = { success: true, host, bypassedWarning: true, action: 'opened_in_safari_view_controller' };
          } else {
            response = { success: true, host, warningTriggered: true, action: 'interstitial_modal_shown' };
          }
          break;
        }
        case 'CLEAR_EXTERNAL_LINK_OPT_OUTS': {
          setExternalLinkDialog((prev) => ({ ...prev, sessionAllowedHosts: [] }));
          response = { success: true, sessionAllowedHosts: [] };
          break;
        }
        case 'HAPTIC_FEEDBACK': {
          const type = (payload.type as HapticEvent['type']) || 'light';
          setLastHaptic({ type, timestamp: Date.now() });
          setIsHapticRippling(true);
          setTimeout(() => setIsHapticRippling(false), 500);

          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
              if (type === 'heavy') navigator.vibrate([40]);
              else if (type === 'medium') navigator.vibrate([25]);
              else if (type === 'success') navigator.vibrate([15, 50, 15]);
              else if (type === 'warning') navigator.vibrate([30, 40, 30]);
              else if (type === 'error') navigator.vibrate([40, 30, 40, 30, 40]);
              else navigator.vibrate([12]);
            } catch {
              // ignore vibration restriction
            }
          }
          response = { success: true, type, patternMs: [15] };
          break;
        }
        case 'CHECK_BIOMETRIC_SUPPORT': {
          const isSupported = currentHw.biometrics.biometryType !== 'none';
          response = {
            supported: isSupported,
            biometryType: currentHw.biometrics.biometryType,
            enrolled: isSupported,
            hardwareAvailable: true,
          };
          break;
        }
        case 'BIOMETRIC_AUTH': {
          const outcome = currentHw.biometrics.mockResult;
          if (outcome === 'locked') {
            status = 'error';
            errorMessage = 'BIOMETRIC_LOCKED: Too many failed attempts. Passcode required.';
            response = {
              success: false,
              errorCode: 'AUTH_LOCKOUT',
              errorMessage: 'Biometric authentication locked out after 5 consecutive failures.',
            };
          } else if (outcome === 'fail') {
            status = 'error';
            errorMessage = 'BIOMETRIC_FAILED: Fingerprint/Face did not match.';
            response = {
              success: false,
              errorCode: 'AUTH_FAILED',
              errorMessage: 'Biometric verification failed. User rejected or mismatch.',
            };
          } else {
            response = {
              success: true,
              token: `goat_bio_jwt_${Date.now()}_valid_signature_256`,
              biometryType: currentHw.biometrics.biometryType,
              authenticatedAt: new Date().toISOString(),
            };
          }
          break;
        }
        case 'GET_DEVICE_INFO': {
          response = {
            platform: currentHw.platform,
            osVersion: currentHw.platform === 'ios' ? '18.2' : '15.0',
            model: currentHw.platform === 'ios' ? 'iPhone 16 Pro' : 'Pixel 9 Pro',
            brand: currentHw.platform === 'ios' ? 'Apple' : 'Google',
            batteryLevel: currentHw.battery.level,
            isCharging: currentHw.battery.charging,
            networkType: currentHw.network.type,
            theme: currentHw.theme,
            screen: { width: 393, height: 852, scale: 3.0 },
            safeArea: currentHw.platform === 'ios' ? { top: 59, bottom: 34 } : { top: 40, bottom: 24 },
          };
          break;
        }
        case 'GET_LOCATION': {
          response = {
            latitude: currentHw.gps.lat,
            longitude: currentHw.gps.lng,
            accuracy: currentHw.gps.accuracy,
            altitude: currentHw.gps.altitude || 20,
            speed: currentHw.gps.speed || 0,
            timestamp: Date.now(),
            provider: 'gps',
          };
          break;
        }
        case 'GET_NETWORK_TYPE': {
          response = {
            networkType: currentHw.network.type,
            isConnected: currentHw.network.type !== 'offline',
            isWifi: currentHw.network.type === 'wifi',
            isCellular: ['5g', '4g', '3g'].includes(currentHw.network.type),
          };
          break;
        }
        case 'STORAGE_SET': {
          response = { success: true, key: payload.key, sizeBytes: JSON.stringify(payload.value).length };
          break;
        }
        case 'STORAGE_GET': {
          response = { success: true, key: payload.key, value: payload.key === 'user.token' ? 'sec_jwt_auth_9912' : 'mock_value' };
          break;
        }
        default: {
          response = { success: true, action, echo: payload, simulated: true };
          break;
        }
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
    [permissionDialog.statusMap, externalLinkDialog.sessionAllowedHosts]
  );

  const triggerHaptic = useCallback(
    async (type: HapticEvent['type']) => {
      await callBridge('HAPTIC_FEEDBACK', { type }, 'Sensors');
    },
    [callBridge]
  );

  const triggerBiometrics = useCallback(
    async (reason = 'Confirm payment with biometrics'): Promise<Record<string, any>> => {
      setBiometricsModal({
        isOpen: true,
        reason,
        state: 'scanning',
        authResult: null,
      });

      const trace = await callBridge('BIOMETRIC_AUTH', { reason }, 'Biometrics');

      if (trace.status === 'success') {
        setBiometricsModal((prev) => ({
          ...prev,
          state: 'matched',
          authResult: trace.response,
        }));
        setTimeout(() => {
          setBiometricsModal((prev) => ({ ...prev, isOpen: false, state: 'idle' }));
        }, 1200);
      } else {
        const isLocked = trace.errorMessage?.includes('LOCKED');
        setBiometricsModal((prev) => ({
          ...prev,
          state: isLocked ? 'locked' : 'failed',
          authResult: trace.response,
        }));
        setTimeout(() => {
          setBiometricsModal((prev) => ({ ...prev, isOpen: false, state: 'idle' }));
        }, 1600);
      }

      return trace.response || {};
    },
    [callBridge]
  );

  const requestPermissionFlow = useCallback(
    (perm: PermissionType) => {
      setPermissionDialog({
        activePermission: perm,
        stage: 'priming',
        statusMap: permissionDialog.statusMap,
      });
      callBridge('CHECK_PERMISSION', { permission: perm }, 'Permissions');
    },
    [callBridge, permissionDialog.statusMap]
  );

  const confirmPermissionStage1 = useCallback(() => {
    setPermissionDialog((prev) => ({
      ...prev,
      stage: 'system_prompt',
    }));
  }, []);

  const respondPermissionSystemPrompt = useCallback(
    (status: PermissionStatus) => {
      const perm = permissionDialog.activePermission;
      if (!perm) return;

      setPermissionDialog((prev) => ({
        activePermission: null,
        stage: 'idle',
        statusMap: {
          ...prev.statusMap,
          [perm]: status,
        },
      }));

      callBridge('REQUEST_PERMISSION', { permission: perm, userResponse: status }, 'Permissions');
    },
    [callBridge, permissionDialog.activePermission]
  );

  const openExternalLinkFlow = useCallback(
    (url: string) => {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const host = urlObj.hostname;
        const isBypassed = externalLinkDialog.sessionAllowedHosts.includes(host);

        setExternalLinkDialog((prev) => ({
          ...prev,
          isOpen: !isBypassed,
          url,
          destinationHost: host,
          status: isBypassed ? 'opened' : 'warning',
        }));

        callBridge('OPEN_EXTERNAL_LINK', { url, destinationHost: host, bypassed: isBypassed }, 'Security');
      } catch (e) {
        console.error('Invalid URL:', e);
      }
    },
    [callBridge, externalLinkDialog.sessionAllowedHosts]
  );

  const confirmExternalLinkOpen = useCallback(() => {
    const host = externalLinkDialog.destinationHost;
    if (externalLinkDialog.dontAskAgainChecked && host) {
      setExternalLinkDialog((prev) => ({
        ...prev,
        isOpen: false,
        status: 'opened',
        sessionAllowedHosts: Array.from(new Set([...prev.sessionAllowedHosts, host])),
      }));
    } else {
      setExternalLinkDialog((prev) => ({
        ...prev,
        isOpen: false,
        status: 'opened',
      }));
    }
  }, [externalLinkDialog.destinationHost, externalLinkDialog.dontAskAgainChecked]);

  const cancelExternalLink = useCallback(() => {
    setExternalLinkDialog((prev) => ({
      ...prev,
      isOpen: false,
      status: 'cancelled',
    }));
  }, []);

  const clearExternalLinkAllowlist = useCallback(() => {
    setExternalLinkDialog((prev) => ({
      ...prev,
      sessionAllowedHosts: [],
    }));
    callBridge('CLEAR_EXTERNAL_LINK_OPT_OUTS', {}, 'Security');
  }, [callBridge]);

  return (
    <SimulatorContext.Provider
      value={{
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
        traces,
        callBridge,
        clearTraces,
        triggerHaptic,
        triggerBiometrics,
        requestPermissionFlow,
        confirmPermissionStage1,
        respondPermissionSystemPrompt,
        openExternalLinkFlow,
        confirmExternalLinkOpen,
        cancelExternalLink,
        clearExternalLinkAllowlist,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};

export function useSimulator(): SimulatorContextType {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
}
