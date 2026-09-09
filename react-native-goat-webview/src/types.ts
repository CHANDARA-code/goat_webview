import type React from 'react';

export interface GoatBridgeRequest<T = any> {
  id: string;
  action: string;
  payload: T;
}

export interface GoatBridgeResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface AppServiceReadyEventData {
  appId: string;
  timestamp?: number;
  details?: Record<string, any>;
}

export interface AppServiceCrashEventData {
  appId: string;
  error: string;
  timestamp?: number;
}

export interface AppServiceTerminateEventData {
  appId: string;
  timestamp?: number;
}

export interface LaunchOptions {
  entryRoute?: string;
  queryParams?: Record<string, string>;
  referrerInfo?: Record<string, any>;
  scene?: number;
  timestamp?: number;
}

export interface PageScrollEventData {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
}

export interface MemoryWarningEventData {
  level: number | string;
  memoryPressure?: string;
}

export interface WindowResizeEventData {
  width: number;
  height: number;
  windowWidth: number;
  windowHeight: number;
  orientation: string;
}

// --- Task 10183: Popup Window & Target _Blank Routing Policy ---
export type PopupRoutingPolicy = 'auto' | 'systemBrowser' | 'modal' | 'sameFrame' | 'block';

export interface GoatWindowFeaturesMap {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  menuBar?: boolean;
  statusBar?: boolean;
  toolbars?: boolean;
  resizable?: boolean;
  scrollbars?: boolean;
}

export interface PopupRequestEvent {
  url: string;
  target?: string;
  policy?: PopupRoutingPolicy | string;
  isUserGesture?: boolean;
  isDialog?: boolean;
  windowFeatures?: GoatWindowFeaturesMap | string;
  windowFeaturesJson?: string;
}

export interface GoatWebViewProps {
  assetBundleName?: string;
  appId?: string;
  initialUrl?: string;
  initialUserScripts?: readonly string[];

  /**
   * Origins this mini-app may load subresources from and reach through `API_REQUEST`.
   *
   * Overrides the bundle manifest's `security.allowedDomains`. A packaged mini-app declaring that
   * field is already filtered without this; leaving it unset keeps the long-standing unfiltered
   * behaviour rather than silently blocking requests.
   *
   * Required for URL-mode mini-apps (`initialUrl`), which have no bundle and so no manifest.
   *
   * Entries are host patterns, not URLs: `api.example.com`, or `*.cdn.example.com` for a domain
   * and its subdomains.
   */
  hostDomainAllowlist?: readonly string[];
  style?: any;
  popupRoutingPolicy?: PopupRoutingPolicy;
  incognito?: boolean;
  compatExternalSchemeResolver?: boolean;
  originWhitelist?: readonly string[];
  hasOnScroll?: boolean;
  hasOnHttpError?: boolean;
  onBridgeMessage?: (event: { nativeEvent: { action: string; payload: any } }) => void;
  onPageLoaded?: (event: { nativeEvent: { url: string } }) => void;
  onError?: (event: { nativeEvent: { description: string } }) => void;
  onAppServiceReady?: (event: { nativeEvent: AppServiceReadyEventData }) => void;
  onAppServiceCrash?: (event: { nativeEvent: AppServiceCrashEventData }) => void;
  onAppServiceTerminate?: (event: { nativeEvent: AppServiceTerminateEventData }) => void;
  onPopupRequest?: (event: { nativeEvent: PopupRequestEvent }) => void;
  onHttpError?: (event: { nativeEvent: { url: string; statusCode: number; description: string } }) => void;
  onRenderProcessGone?: (event: { nativeEvent: { didCrash: boolean } }) => void;
  onContentProcessDidTerminate?: (event: { nativeEvent: Record<string, never> }) => void;
  onScroll?: (event: { nativeEvent: { x: number; y: number } }) => void;
  onExternalNavigation?: (event: { nativeEvent: { url: string } }) => void;
  testID?: string;
  children?: React.ReactNode;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  brand: string;
  platform?: string;
  androidVersion?: string;
  systemVersion?: string;
  osVersion?: string;
  sdkVersion?: string;
  sdkInt?: number;
  screenWidthDp?: number;
  screenHeightDp?: number;
  density?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  isAlgorithmicDarkening?: boolean;
  appVersion?: string;
  appId?: string;
  installGuid: string;
}

export interface TurboGoatWebViewSpec {
  prewarm(appId?: string): Promise<boolean>;
  clearCache(appId?: string): Promise<boolean>;
  getBundleVersion(appId?: string): Promise<string>;
  runHeadlessScript?(script: string, appId?: string): Promise<string>;
  executeAction?(action: string, payload: Object, appId?: string): Promise<Object>;
  triggerHaptic?(type?: string, style?: string, notificationType?: string): Promise<Object>;
  setNavBarState?(state: Object, appId?: string): Promise<boolean>;
  setBottomSheetState?(state: Object, appId?: string): Promise<boolean>;
  notifyAppServiceReady?(appId: string, details?: Record<string, any>): Promise<boolean>;
  notifyAppServiceCrash?(appId: string, error: string): Promise<boolean>;
  notifyAppServiceTerminate?(appId: string): Promise<boolean>;
}

// --- Task 10201: Cross-Mini-App Launch & Windowed Presentation Bridge ---
export interface WindowConfig {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  draggable?: boolean;
  resizable?: boolean;
  showCloseButton?: boolean;
  dimBackground?: boolean;
  cornerRadius?: number;
  elevation?: number;
  title?: string;
}

export interface OpenMiniAppPayload {
  targetAppId: string;
  presentation?: 'WINDOWED' | 'MODAL' | 'FULLSCREEN';
  params?: Record<string, any>;
  windowConfig?: WindowConfig;
  jsApiAlias?: Record<string, string>;
}

export interface OpenMiniAppResult {
  instanceId: string;
  targetAppId: string;
  presentation: string;
  status: string;
}

export interface CloseMiniAppPayload {
  instanceId?: string;
  result?: Record<string, any>;
}

export interface CloseMiniAppResult {
  closed: boolean;
  instanceId: string;
}

export interface MiniAppClosedEventData {
  instanceId: string;
  targetAppId: string;
  dismissedByUser: boolean;
  result: Record<string, any>;
}
