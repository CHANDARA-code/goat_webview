/**
 * @goat/compiler-taro - Type Definitions
 * Complete type contracts for Taro platform plugin, config transformers,
 * runtime JSAPI bridge shims, dual/single-thread bundlers, and integrity generation.
 */

// ============================================================================
// 1. Goat Manifest & Configuration Types
// ============================================================================

export type GoatPermission =
  | 'CAMERA'
  | 'LOCATION'
  | 'RECORD_AUDIO'
  | 'STORAGE'
  | 'BIOMETRIC'
  | 'BLUETOOTH'
  | 'PAYMENT'
  | 'CONTACTS'
  | 'CLIPBOARD'
  | 'HAPTICS'
  | 'NFC';

export interface GoatWindowConfig {
  title?: string;
  backgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  navigationBarBackgroundColor?: string;
  orientation?: 'portrait' | 'landscape' | 'auto';
  enablePullDownRefresh?: boolean;
  transparentBackground?: boolean;
}

export interface GoatSubpackage {
  name?: string;
  root: string;
  pages: string[];
  independent?: boolean;
  preloadRule?: {
    network?: 'all' | 'wifi';
    packages?: string[];
  };
}

export interface GoatBridgeSettings {
  timeout?: number;
  mockMode?: boolean;
}

export interface GoatSecuritySettings {
  allowedDomains?: string[];
  enableBytecode?: boolean;
}

export interface GoatManifest {
  appId: string;
  appName: string;
  version: string;
  versionCode: number;
  entryPage: string;
  window?: GoatWindowConfig;
  permissions?: GoatPermission[];
  subpackages?: GoatSubpackage[];
  preloadRule?: Record<string, { network?: 'all' | 'wifi'; packages?: string[] }>;
  bridge?: GoatBridgeSettings;
  security?: GoatSecuritySettings;
}

export interface GoatConfig {
  name: string;
  version: string;
  appId: string;
  entryPage: string;
  target: 'dual-thread' | 'single-thread';
  compiler: 'taro';
  framework?: 'react' | 'vue3' | 'vue';
}

// ============================================================================
// 2. Taro Source Configuration Types
// ============================================================================

export interface TaroWindowConfig {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
  backgroundTextStyle?: 'dark' | 'light';
  enablePullDownRefresh?: boolean;
  onReachBottomDistance?: number;
  pageOrientation?: 'portrait' | 'landscape' | 'auto';
  navigationStyle?: 'default' | 'custom';
  transparentTitle?: 'none' | 'always' | 'auto';
  titlePenetrate?: 'YES' | 'NO';
}

export interface TaroTabBarItem {
  pagePath: string;
  text: string;
  iconPath?: string;
  selectedIconPath?: string;
}

export interface TaroTabBar {
  color?: string;
  selectedColor?: string;
  backgroundColor?: string;
  borderStyle?: 'black' | 'white';
  list: TaroTabBarItem[];
  position?: 'bottom' | 'top';
  custom?: boolean;
}

export interface TaroSubPackage {
  root: string;
  pages: string[];
  name?: string;
  independent?: boolean;
}

export interface TaroPreloadRule {
  [pageRoute: string]: {
    network?: 'all' | 'wifi';
    packages: string[];
  };
}

export interface TaroPermissionConfig {
  [scope: string]: {
    desc?: string;
  };
}

export interface TaroAppConfig {
  pages: string[];
  window?: TaroWindowConfig;
  tabBar?: TaroTabBar;
  subPackages?: TaroSubPackage[];
  subpackages?: TaroSubPackage[];
  preloadRule?: TaroPreloadRule;
  permission?: TaroPermissionConfig;
  permissions?: string[];
  entryPagePath?: string;
  networkTimeout?: {
    request?: number;
    connectSocket?: number;
    uploadFile?: number;
    downloadFile?: number;
  };
  debug?: boolean;
  [key: string]: unknown;
}

export interface TaroPageConfig {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
  enablePullDownRefresh?: boolean;
  disableScroll?: boolean;
  onReachBottomDistance?: number;
  navigationStyle?: 'default' | 'custom';
  usingComponents?: Record<string, string>;
  [key: string]: unknown;
}

// ============================================================================
// 3. Plugin Options & Context Types
// ============================================================================

export interface GoatTaroPluginOptions {
  appId?: string;
  appName?: string;
  version?: string;
  versionCode?: number;
  target?: 'dual-thread' | 'single-thread';
  allowedDomains?: string[];
  permissions?: GoatPermission[];
  subpackagesDir?: string;
  enableBytecode?: boolean;
  generateArchive?: boolean;
  bridgeTimeout?: number;
}

export interface TaroPluginContext {
  registerPlatform: (platform: {
    name: string;
    useConfigName: string;
    fn: (params: { env: string }) => Promise<void> | void;
  }) => void;
  modifyWebpackChain?: (fn: (chain: any) => void) => void;
  modifyViteConfig?: (fn: (config: any) => void) => void;
  onBuildStart?: (fn: () => Promise<void> | void) => void;
  onBuildFinish?: (fn: (params?: { stats?: any; error?: Error }) => Promise<void> | void) => void;
  paths?: {
    appPath: string;
    configPath?: string;
    sourcePath?: string;
    outputPath?: string;
    nodeModulesPath?: string;
  };
  initialConfig?: Record<string, any>;
  [key: string]: any;
}

export interface VirtualRoute {
  path: string;
  fullPath: string;
  isSubpackage: boolean;
  subpackageRoot?: string;
  subpackageName?: string;
  pageConfig?: TaroPageConfig;
}

export interface VirtualRouteTable {
  entryPage: string;
  routes: VirtualRoute[];
  tabBarRoutes: string[];
  subpackageMap: Map<string, VirtualRoute[]>;
}

// ============================================================================
// 4. Runtime Bridge & IPC Types
// ============================================================================

export interface BridgeCallPayload {
  callId: string;
  action: string;
  payload: Record<string, unknown>;
  domain?: string;
  timeoutMs?: number;
}

export interface BridgeErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface BridgeReplyPayload {
  callId: string;
  success: boolean;
  data?: unknown;
  error?: BridgeErrorPayload;
}

export interface IpcChannelLike {
  sendImmediate: (type: string, payload: unknown) => void;
  onMessage?: (type: string, handler: (payload: any) => void) => void;
}

export interface StandardCallbackOptions<T = any> {
  success?: (res: T) => void;
  fail?: (err: { errMsg: string; code?: string; details?: any }) => void;
  complete?: (res: any) => void;
}

// ============================================================================
// 5. Taro JSAPI Bridge Options & Result Types (44 Shims)
// ============================================================================

// 1. Request
export interface RequestOptions extends StandardCallbackOptions<RequestSuccessResult> {
  url: string;
  data?: string | Record<string, unknown> | ArrayBuffer;
  header?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
  dataType?: 'json' | 'text';
  responseType?: 'text' | 'arraybuffer';
  timeout?: number;
}

export interface RequestSuccessResult {
  data: any;
  statusCode: number;
  header: Record<string, string>;
  cookies?: string[];
  errMsg: string;
}

// 2-11. Storage
export interface SetStorageOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  key: string;
  data: any;
}

export interface GetStorageOptions extends StandardCallbackOptions<GetStorageSuccessResult> {
  key: string;
}

export interface GetStorageSuccessResult {
  data: any;
  errMsg: string;
}

export interface RemoveStorageOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  key: string;
}

export interface ClearStorageOptions extends StandardCallbackOptions<GeneralCallbackResult> {}

export interface GetStorageInfoOptions extends StandardCallbackOptions<GetStorageInfoSuccessResult> {}

export interface GetStorageInfoSuccessResult {
  keys: string[];
  currentSize: number;
  limitSize: number;
  errMsg: string;
}

export interface GeneralCallbackResult {
  errMsg: string;
}

// 12-17. Router
export interface NavigateToOptions extends StandardCallbackOptions<NavigateToSuccessResult> {
  url: string;
  events?: Record<string, (...args: any[]) => void>;
}

export interface NavigateToSuccessResult {
  eventChannel?: {
    emit: (event: string, ...args: any[]) => void;
    on: (event: string, fn: (...args: any[]) => void) => void;
    once: (event: string, fn: (...args: any[]) => void) => void;
    off: (event: string, fn?: (...args: any[]) => void) => void;
  };
  errMsg: string;
}

export interface RedirectToOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  url: string;
}

export interface NavigateBackOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  delta?: number;
}

export interface SwitchTabOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  url: string;
}

export interface ReLaunchOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  url: string;
}

// 18-23. UI
export interface ShowModalOptions extends StandardCallbackOptions<ShowModalSuccessResult> {
  title?: string;
  content?: string;
  showCancel?: boolean;
  cancelText?: string;
  cancelColor?: string;
  confirmText?: string;
  confirmColor?: string;
}

export interface ShowModalSuccessResult {
  confirm: boolean;
  cancel: boolean;
  content?: string;
  errMsg: string;
}

export interface ShowToastOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  title: string;
  icon?: 'success' | 'error' | 'loading' | 'none';
  image?: string;
  duration?: number;
  mask?: boolean;
}

export interface ShowLoadingOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  title?: string;
  mask?: boolean;
}

export interface ShowActionSheetOptions extends StandardCallbackOptions<ShowActionSheetSuccessResult> {
  itemList: string[];
  itemColor?: string;
}

export interface ShowActionSheetSuccessResult {
  tapIndex: number;
  errMsg: string;
}

// 24. Payment
export interface RequestPaymentOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  timeStamp?: string;
  nonceStr?: string;
  package?: string;
  signType?: 'MD5' | 'HMAC-SHA256' | 'RSA';
  paySign?: string;
  invoiceSlug?: string;
  provider?: string;
}

// 25-27. Location
export interface GetLocationOptions extends StandardCallbackOptions<GetLocationSuccessResult> {
  type?: 'wgs84' | 'gcj02';
  altitude?: boolean;
  isHighAccuracy?: boolean;
  highAccuracyExpireTime?: number;
}

export interface GetLocationSuccessResult {
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  altitude: number;
  verticalAccuracy: number;
  horizontalAccuracy: number;
  errMsg: string;
}

export interface ChooseLocationOptions extends StandardCallbackOptions<ChooseLocationSuccessResult> {
  latitude?: number;
  longitude?: number;
}

export interface ChooseLocationSuccessResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  errMsg: string;
}

export interface OpenLocationOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  latitude: number;
  longitude: number;
  scale?: number;
  name?: string;
  address?: string;
}

// 28-33. System
export interface SystemInfo {
  brand: string;
  model: string;
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  language: string;
  version: string;
  system: string;
  platform: 'goat' | 'android' | 'ios' | 'devtools';
  fontSizeSetting: number;
  SDKVersion: string;
  benchmarkLevel: number;
  albumAuthorized?: boolean;
  cameraAuthorized?: boolean;
  locationAuthorized?: boolean;
  microphoneAuthorized?: boolean;
  notificationAuthorized?: boolean;
  bluetoothEnabled?: boolean;
  locationEnabled?: boolean;
  wifiEnabled?: boolean;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  theme?: 'dark' | 'light';
  errMsg: string;
}

export interface GetSystemInfoOptions extends StandardCallbackOptions<SystemInfo> {}

export interface DeviceInfo {
  brand: string;
  model: string;
  system: string;
  platform: string;
  cpuType?: string;
  memorySize?: string;
  errMsg: string;
}

export interface WindowInfo {
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  screenTop?: number;
  errMsg: string;
}

export interface AppBaseInfo {
  SDKVersion: string;
  version: string;
  language: string;
  platform: string;
  theme: 'light' | 'dark';
  fontSizeSetting?: number;
  errMsg: string;
}

// 34-40. Media, Haptics, Clipboard, Screen
export interface VibrateShortOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  type?: 'light' | 'medium' | 'heavy';
}

export interface VibrateLongOptions extends StandardCallbackOptions<GeneralCallbackResult> {}

export interface SetClipboardDataOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  data: string;
}

export interface GetClipboardDataOptions extends StandardCallbackOptions<GetClipboardDataSuccessResult> {}

export interface GetClipboardDataSuccessResult {
  data: string;
  errMsg: string;
}

export interface SetKeepScreenOnOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  keepScreenOn: boolean;
}

export interface SetScreenBrightnessOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  value: number; // 0.0 to 1.0
}

export interface GetScreenBrightnessOptions extends StandardCallbackOptions<GetScreenBrightnessSuccessResult> {}

export interface GetScreenBrightnessSuccessResult {
  value: number;
  errMsg: string;
}

// 41. ScanCode
export interface ScanCodeOptions extends StandardCallbackOptions<ScanCodeSuccessResult> {
  onlyFromCamera?: boolean;
  scanType?: Array<'barCode' | 'qrCode' | 'datamatrix' | 'pdf417'>;
}

export interface ScanCodeSuccessResult {
  result: string;
  scanType: string;
  charSet: string;
  path?: string;
  rawData?: string;
  errMsg: string;
}

// 42. DownloadFile
export interface DownloadFileOptions extends StandardCallbackOptions<DownloadFileSuccessResult> {
  url: string;
  header?: Record<string, string>;
  filePath?: string;
  fileName?: string;
  timeout?: number;
}

export interface DownloadFileSuccessResult {
  tempFilePath: string;
  statusCode: number;
  errMsg: string;
}

// 43. UploadFile
export interface UploadFileOptions extends StandardCallbackOptions<UploadFileSuccessResult> {
  url: string;
  filePath: string;
  name: string;
  header?: Record<string, string>;
  formData?: Record<string, any>;
  timeout?: number;
}

export interface UploadFileSuccessResult {
  data: string;
  statusCode: number;
  errMsg: string;
}

// 44. WebSocket
export interface ConnectSocketOptions extends StandardCallbackOptions<GeneralCallbackResult> {
  url: string;
  header?: Record<string, string>;
  protocols?: string[];
  tcpNoDelay?: boolean;
  perMessageDeflate?: boolean;
  timeout?: number;
}

export interface SocketTask {
  send: (options: { data: string | ArrayBuffer } & StandardCallbackOptions<GeneralCallbackResult>) => void;
  close: (options?: { code?: number; reason?: string } & StandardCallbackOptions<GeneralCallbackResult>) => void;
  onOpen: (callback: (res: { header: Record<string, string> }) => void) => void;
  onClose: (callback: (res: { code: number; reason: string }) => void) => void;
  onError: (callback: (res: { errMsg: string }) => void) => void;
  onMessage: (callback: (res: { data: string | ArrayBuffer }) => void) => void;
}

// ============================================================================
// 6. Bundler & Integrity Types
// ============================================================================

export interface IntegrityFileInfo {
  sha256: string;
  sizeBytes: number;
}

export interface IntegrityManifest {
  version: string;
  appId: string;
  target: 'dual-thread' | 'single-thread';
  timestamp: number;
  files: Record<string, string>;
  metadata?: {
    totalFiles: number;
    totalSizeBytes: number;
    fileSizes: Record<string, number>;
  };
}

export interface DualThreadBundleOptions {
  appConfig: TaroAppConfig;
  pageConfigs?: Record<string, TaroPageConfig>;
  pluginOptions?: GoatTaroPluginOptions;
  packageJson?: { name?: string; version?: string };
  appLogicCode?: string;
  appStyleCode?: string;
  pageCodes?: Record<string, { js?: string; css?: string }>;
  subpackageCodes?: Record<string, { workerJs?: string; viewHtml?: string; css?: string }>;
  extraAssets?: Record<string, string | Buffer>;
}

export interface SingleThreadBundleOptions {
  appConfig: TaroAppConfig;
  pageConfigs?: Record<string, TaroPageConfig>;
  pluginOptions?: GoatTaroPluginOptions;
  packageJson?: { name?: string; version?: string };
  bundleJsCode?: string;
  bundleCssCode?: string;
  subpackageChunks?: Record<string, { js?: string; css?: string }>;
  extraAssets?: Record<string, string | Buffer>;
}

export interface BundleResult {
  manifest: GoatManifest;
  goatConfig: GoatConfig;
  integrity: IntegrityManifest;
  files: Record<string, string | Buffer>;
  routeTable: VirtualRouteTable;
  warnings: string[];
}
