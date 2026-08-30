/**
 * Goat WebView Device Simulator & Bridge Types
 */

export type PlatformType = 'ios' | 'android';
export type ThemeType = 'light' | 'dark';
export type NetworkType = 'wifi' | '5g' | '4g' | '3g' | 'offline';
export type BiometricType = 'face' | 'touch' | 'biometric_prompt' | 'none';
export type BiometricMockResult = 'success' | 'fail' | 'locked';

export interface GpsLocation {
  name?: string;
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
}

export interface BatteryState {
  level: number; // 0 - 100
  charging: boolean;
  isLow: boolean;
}

export interface MockHardwareState {
  platform: PlatformType;
  theme: ThemeType;
  battery: BatteryState;
  network: {
    type: NetworkType;
    latencyMs: number;
  };
  gps: GpsLocation;
  biometrics: {
    biometryType: BiometricType;
    mockResult: BiometricMockResult;
    attempts: number;
  };
}

export type ThreadLaneType =
  | 'all'
  | 'appservice_to_appview'
  | 'appview_to_native'
  | 'native_to_appview'
  | 'appview_to_appservice'
  | string;

export interface BridgeTrace {
  id: string;
  timestamp: number;
  domain: string;
  action: string;
  payload: Record<string, any>;
  response: Record<string, any> | null;
  latencyMs: number;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  threadLane?: ThreadLaneType;
  seqId?: number;
  batchId?: string;
  workerIpcLatencyMs?: number;
  nativeExecutionLatencyMs?: number;
  domRenderLatencyMs?: number;
  parentCallId?: string;
}

export interface NavButton {
  id: string;
  text: string;
  icon?: string;
  enabled: boolean;
}

export interface NavBarState {
  title: string;
  subtitle: string;
  backgroundColor: string;
  textColor: string;
  isDark: boolean;
  progress: {
    visible: boolean;
    percent: number;
  };
  leftButton: NavButton | null;
  rightButtons: NavButton[];
}

export interface BottomSheetState {
  isOpen: boolean;
  currentSnapIndex: number;
  snapPoints: number[];
  heightPreset: 'compact' | 'half' | 'expanded' | 'custom';
  customHeight: number;
  isDismissible: boolean;
  activeTab: string;
  tabs: Array<{ id: string; title: string; content: string }>;
}

export type PermissionType = 'camera' | 'location' | 'notifications' | 'contacts' | 'bluetooth';
export type PermissionStatus = 'granted' | 'denied' | 'permanently_denied' | 'not_determined';
export type PermissionStage = 'priming' | 'system_prompt' | 'permanently_denied_dialog' | 'idle';

export interface PermissionDialogState {
  activePermission: PermissionType | null;
  stage: PermissionStage;
  statusMap: Record<PermissionType, PermissionStatus>;
}

export interface ExternalLinkDialogState {
  isOpen: boolean;
  url: string;
  destinationHost: string;
  sessionAllowedHosts: string[];
  dontAskAgainChecked: boolean;
  status: 'idle' | 'warning' | 'opened' | 'cancelled';
}

export interface HapticEvent {
  type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'selection' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface BiometricsModalState {
  isOpen: boolean;
  reason: string;
  state: 'idle' | 'scanning' | 'matched' | 'failed' | 'locked';
  authResult: Record<string, any> | null;
}
