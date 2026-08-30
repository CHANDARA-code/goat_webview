export interface BridgeRequest<T = Record<string, any>> {
  id: string;
  action: string;
  payload: T;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  brand: string;
  platform?: string;
  androidVersion: string;
  sdkInt: number;
  screenWidthDp: number;
  screenHeightDp: number;
  density: number;
  batteryLevel: number;
  isCharging: boolean;
  isAlgorithmicDarkening: boolean;
  appVersion: string;
  installGuid: string;
}

export type HapticType = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'SUCCESS' | 'ERROR';

export interface StorageSetPayload {
  key: string;
  value: string;
}

export interface StorageGetPayload {
  key: string;
}

export interface StorageRemovePayload {
  key: string;
}

export interface SecureStorageSetPayload {
  key: string;
  value: string;
  appId?: string;
}

export interface SecureStorageGetPayload {
  key: string;
  appId?: string;
}

export interface SecureStorageRemovePayload {
  key: string;
  appId?: string;
}

export interface SecureStorageClearPayload {
  appId?: string;
}

export interface ApiRequestPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export interface ApiResponseData {
  status: number;
  statusText: string;
  data: any;
  durationMs: number;
}

export interface BridgeLogEntry {
  id: string;
  timestamp: string;
  type: 'req' | 'res' | 'event' | 'error';
  action: string;
  details: any;
}

export interface DownloadFilePayload {
  url: string;
  fileName?: string;
  title?: string;
}

export interface DownloadResult {
  downloadId: number;
  status: string;
  fileName: string;
}

export type ToastIcon = 'success' | 'error' | 'loading' | 'none';

export interface ShowToastPayload {
  title: string;
  icon?: ToastIcon;
  duration?: number;
  mask?: boolean;
}

export interface ShowToastResult {
  shown: boolean;
  title: string;
}

export interface ShowModalPayload {
  title: string;
  content: string;
  showCancel?: boolean;
  cancelText?: string;
  cancelColor?: string;
  confirmText?: string;
  confirmColor?: string;
}

export interface ShowModalResult {
  confirm: boolean;
  cancel: boolean;
}

export interface ShowActionSheetPayload {
  itemList: string[];
  itemColor?: string;
}

export interface ShowActionSheetResult {
  tapIndex: number;
}

export interface ShowLoadingPayload {
  title?: string;
  mask?: boolean;
}

export interface LoadingResult {
  shown?: boolean;
  hidden?: boolean;
}

export interface CanIUsePayload {
  action: string;
}

export interface CanIUseResult {
  supported: boolean;
  action: string;
}

export interface SetScreenBrightnessPayload {
  value: number; // 0.0 to 1.0
}

export interface BrightnessResult {
  value: number;
  updated?: boolean;
}

export interface SetKeepScreenOnPayload {
  keepScreenOn: boolean;
}

export interface KeepScreenOnResult {
  keepScreenOn: boolean;
  updated: boolean;
}

export interface MakePhoneCallPayload {
  phoneNumber: string;
}

export interface SendSmsPayload {
  phoneNumber: string;
  body?: string;
}

export interface TelephonyResult {
  handled: boolean;
  phoneNumber?: string;
}

export type SensorInterval = 'game' | 'ui' | 'normal';

export interface StartSensorPayload {
  interval?: SensorInterval;
}

export interface SensorMotionData {
  x: number;
  y: number;
  z: number;
  timestamp?: number;
}

export type CoordinateType = 'wgs84' | 'gcj02';

export interface GetLocationPayload {
  type?: CoordinateType;
  altitude?: boolean;
  highAccuracy?: boolean;
  highAccuracyExpireTime?: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  altitude: number;
  verticalAccuracy?: number;
  horizontalAccuracy?: number;
  heading?: number;
}

export interface ChooseLocationResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface OpenLocationPayload {
  latitude: number;
  longitude: number;
  scale?: number;
  name?: string;
  address?: string;
}

export interface OpenLocationResult {
  opened: boolean;
  latitude: number;
  longitude: number;
}

// Task 10103: Biometrics & Code Scanner
export interface BiometricSupportResult {
  supported: boolean;
  biometryType?: 'fingerprint' | 'face' | 'none';
}

export interface BiometricAuthPayload {
  title?: string;
  subtitle?: string;
  negativeButtonText?: string;
}

export interface BiometricAuthResult {
  authenticated: boolean;
  reason?: string;
  token?: string;
}

export type ScanType = 'QR_CODE' | 'BARCODE' | 'DATA_MATRIX';

export interface ScanCodePayload {
  onlyFromCamera?: boolean;
  scanType?: ScanType[];
}

export interface ScanCodeResult {
  result: string;
  scanType: string;
  charSet?: string;
}

// Task 10110: Network Status & Upload
export type NetworkType = 'wifi' | '5g' | '4g' | '3g' | '2g' | 'unknown' | 'none';

export interface GetNetworkTypeResult {
  networkType: NetworkType;
  isConnected: boolean;
}

export interface UploadFilePayload {
  url: string;
  filePath: string;
  name?: string;
  header?: Record<string, string>;
  formData?: Record<string, string>;
}

export interface UploadFileResult {
  statusCode: number;
  data: string;
}

export interface WebSocketConnectPayload {
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
}

export interface WebSocketSendPayload {
  data: string;
}

// Task 10128: Share Sheet & Social
export interface ShareSheetPayload {
  title?: string;
  text?: string;
  url?: string;
  mediaPath?: string;
}

export interface ShareSheetResult {
  shared: boolean;
  activityType?: string;
}

export interface ShareToStoryPayload {
  mediaPath: string;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
  attributionUrl?: string;
}

// Task 10106: Media Picker & Audio Player
export type MediaType = 'image' | 'video' | 'mix';
export type SourceType = 'album' | 'camera';

export interface ChooseMediaPayload {
  count?: number;
  mediaType?: MediaType[];
  sourceType?: SourceType[];
  maxDuration?: number;
  sizeType?: ('original' | 'compressed')[];
}

export interface MediaFile {
  tempFilePath: string;
  size: number;
  duration?: number;
  height?: number;
  width?: number;
  thumbTempFilePath?: string;
  fileType: 'image' | 'video';
}

export interface ChooseMediaResult {
  tempFiles: MediaFile[];
  type: string;
}

export interface PreviewImagePayload {
  urls: string[];
  current?: string | number;
}

export interface AudioPlayPayload {
  src: string;
  title?: string;
  epname?: string;
  singer?: string;
  coverImgUrl?: string;
  startTime?: number;
}

export interface AudioSeekPayload {
  position: number;
}

export interface AudioStateResult {
  status: 'playing' | 'paused' | 'stopped' | 'seeked';
  currentTime?: number;
  duration?: number;
}

export interface ApmMetricsPayload {
  fcpMs?: number;
  lcpMs?: number;
  inpMs?: number;
  cls?: number;
  domCompleteMs?: number;
  bridgeLatencyAvgMs?: number;
}

export interface ApmSummaryResult {
  totalReports: number;
  avgFcpMs: number;
  avgLcpMs: number;
  avgBridgeLatencyMs: number;
  totalSlaViolations: number;
}

export interface PushTokenResult {
  token: string;
  appId: string;
}

export interface PushPermissionResult {
  granted: boolean;
}

export interface PushNotificationPayload {
  title: string;
  content: string;
  channelId?: string;
}

export interface BleDevice {
  deviceId: string;
  name: string;
  rssi: number;
  isConnectable: boolean;
}

export interface BleScanResult {
  isScanning: boolean;
  devices: BleDevice[];
}

export interface NfcTagResult {
  type: string;
  payload: string;
  uri?: string;
}

export interface ContactResult {
  name: string;
  phoneNumber: string;
  email?: string;
}

export interface GeofencePayload {
  geofenceId: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  transitionType?: 'ENTER' | 'EXIT' | 'BOTH';
}

export interface GeofenceRegionResult {
  geofenceId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  transitionType: string;
}

export interface GeofenceTransitionResult {
  events: Array<{
    geofenceId: string;
    transition: 'ENTER' | 'EXIT';
  }>;
}

export interface Web3WalletAccountResult {
  address: string;
  publicKey: string;
  wallet: string;
  network: string;
  chainId: string;
}

export interface Web3SignTransactionPayload {
  to: string;
  amount: string;
  payload?: string;
}

export interface Web3SignedTransactionResult {
  signature: string;
  txHash: string;
  network: string;
  from: string;
}

export interface InvoicePayload {
  invoiceSlug: string;
  title: string;
  amount: number;
  currency?: string;
}

export interface InvoicePaymentResult {
  status: 'PAID' | 'CANCELLED' | 'FAILED';
  invoiceSlug: string;
  transactionId: string;
  amount: number;
  currency: string;
  signature: string;
}

export interface IapProductItem {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  type: string;
}

export interface BinaryPortPacketResult {
  posted: boolean;
  portId: string;
  byteSize: number;
  sequenceNumber: number;
}

export interface BinaryPortReadResult {
  portId: string;
  dataBase64: string | null;
  byteSize: number;
}

export interface SslPinAuditResult {
  hostname: string;
  isPinned: boolean;
  isCertificateValid: boolean;
  auditStatus: string;
  matchedPin?: string;
}

export interface PermissionResult {
  scope: string;
  granted: boolean;
  isDeclaredInManifest?: boolean;
}

export interface AuthSettingResult {
  authSetting: Record<string, boolean>;
}

export interface KeyboardInsetsResult {
  isVisible: boolean;
  heightPx: number;
  durationMs?: number;
  adjustedViewportBottomInset: number;
}

export interface PredictiveBackProgressPayload {
  progress: number;
  touchX?: number;
  touchY?: number;
  swipeEdge?: number;
}

export interface PredictiveBackResult {
  action?: string;
  progress?: number;
  interpolatedScale?: number;
  interpolatedAlpha?: number;
  interpolatedTranslationX?: number;
  canGoBackInWebView?: boolean;
  poppedRoute?: boolean;
}

export interface WasmSupportResult {
  wasmSupported: boolean;
  simdSupported: boolean;
  sharedArrayBufferSupported: boolean;
  threadsSupported: boolean;
  maxMemoryPages: number;
}

export interface SandboxHeadersAuditResult {
  coopHeaderPresent: boolean;
  coepHeaderPresent: boolean;
  isIsolatedContext: boolean;
  status: string;
}

export interface BytecodePrecompileResult {
  appId: string;
  isSuccess: boolean;
  compileDurationMs: number;
  bytecodeSizeBytes: number;
  cachePath: string;
  errorMessage?: string;
}

export interface BytecodeCacheStatsResult {
  totalCachedBundles: number;
  totalCacheSizeBytes: number;
  isWarm: boolean;
}

export interface FileChooserResult {
  isSuccess: boolean;
  selectedUris: string[];
  totalFiles: number;
  wasCancelled: boolean;
}

export interface BackNavigationResult {
  action: string;
  canGoBack: boolean;
  currentHistoryIndex: number;
  totalHistoryCount: number;
  routePopped?: string;
}

export interface RenderLayerConfigResult {
  isTransparent: boolean;
  backgroundColorHex: string;
  isHardwareAccelerated: boolean;
  isWhiteFlashPrevented: boolean;
}

export interface GestureScrollStateResult {
  isScrollBoundaryReached: boolean;
  canParentIntercept: boolean;
  activeDirection: string;
  scrollOffsetPx: number;
  isFlingActive: boolean;
}

export interface PageStackEntryPayload {
  pageId: string;
  route: string;
  title: string;
  isSuspended: boolean;
}

export interface PageStackResult {
  action: string;
  activePage?: PageStackEntryPayload;
  stackDepth: number;
  canPop: boolean;
  totalCount?: number;
  stack?: PageStackEntryPayload[];
}

export interface SubpackageLoadResult {
  appId: string;
  subpackageName: string;
  isSuccess: boolean;
  isCached: boolean;
  extractedPath: string;
  byteSize: number;
  errorMessage?: string;
}

export interface NativeComponentDescriptorResult {
  componentId: string;
  componentType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isVisible: boolean;
}

export interface ApiCapabilityResult {
  actionName: string;
  category: string;
  isSupported: boolean;
}

export interface ProcessSandboxStatusResult {
  pid: number;
  isAlive: boolean;
  isInitialized: boolean;
  activeAppId: string;
  isolatedProcessName: string;
}

export interface StartupBenchmarkReportResult {
  coldStartTimeMs: number;
  warmStartTimeMs: number;
  memoryDeltaMb: number;
  isColdBootWithinSla: boolean;
  isWarmBootWithinSla: boolean;
  isMemoryWithinSla: boolean;
  totalSamples: number;
}

// === Milestone 3 Cross-Platform Bridge Synchronized Types ===

export interface GoatBridgeErrorDetails {
  action?: string;
  payload?: any;
  originalError?: any;
  code?: string;
  [key: string]: any;
}

export type GoatNavButtonType = 'BACK' | 'CLOSE' | 'MORE' | 'CUSTOM' | string;

export interface SetNavBarTitlePayload {
  title: string;
  subtitle?: string;
}

export interface NavBarTitleResult {
  title: string;
  subtitle?: string;
}

export interface SetNavBarColorPayload {
  backgroundColor: string;
  textColor?: string;
  isDark?: boolean;
}

export interface NavBarColorResult {
  backgroundColor: string;
  textColor: string;
  isDark: boolean;
}

export interface SetNavBarButtonsPayload {
  left?: GoatNavButtonType;
  right?: GoatNavButtonType[];
}

export interface NavBarButtonsResult {
  left?: GoatNavButtonType;
  right: GoatNavButtonType[];
}

export interface SetNavBarProgressPayload {
  visible: boolean;
  progress?: number;
}

export interface NavBarProgressResult {
  visible: boolean;
  progress: number;
}

export interface NavBarConfigPayload {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  isDark?: boolean;
  leftButton?: GoatNavButtonType;
  rightButtons?: GoatNavButtonType[];
  isProgressVisible?: boolean;
  progress?: number;
  isVisible?: boolean;
}

export type BottomSheetStateValue = 'COLLAPSED' | 'HALF' | 'EXPANDED' | 'HIDDEN' | string;

export interface SetSheetSnapPointsPayload {
  snapPoints: number[];
  initialSnap?: number;
  isDismissible?: boolean;
  showDragHandle?: boolean;
}

export interface BottomSheetSnapPointsResult {
  snapPoints: number[];
  initialSnap: number;
  isDismissible: boolean;
}

export interface BottomSheetResult {
  currentSnap: number;
  sheetValue: BottomSheetStateValue;
  isDismissible?: boolean;
  isExpanded?: boolean;
  isCollapsed?: boolean;
  isDismissed?: boolean;
}

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type NotificationHapticType = 'success' | 'warning' | 'error';
export type HapticPreset = 'selection' | 'app_error';

export interface HapticPayload {
  type?: 'impact' | 'notification' | 'selection' | HapticType | string;
  style?: ImpactStyle | string;
  notificationType?: NotificationHapticType | string;
}

export interface HapticFeedbackResult {
  triggered: boolean;
  type: string;
  style?: string;
  notificationType?: string;
}

export interface SafeAreaInsetsResult {
  top: number;
  bottom: number;
  left: number;
  right: number;
  keyboardHeight: number;
  totalBottom: number;
}

export interface KeyboardInsetsPayload {
  heightPx: number;
  durationMs?: number;
}

export interface CookieItem {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface SetCookiePayload {
  url: string;
  value: string;
  appId?: string;
}

export interface GetCookiesPayload {
  url: string;
  appId?: string;
}

export interface RemoveCookiePayload {
  url: string;
  name: string;
  domain?: string;
  path?: string;
  appId?: string;
}

export interface ClearCookiesPayload {
  appId?: string;
}

// --- Task 10192: External Link Warning Interstitial ---
export interface OpenExternalLinkPayload {
  url: string;
  skipWarningIfOptedOut?: boolean;
  appId?: string;
}

export interface OpenExternalLinkResult {
  opened: boolean;
  destinationHost: string;
}

export interface ExternalLinkWarningEvent {
  destinationHost: string;
}

// --- Task 10194: Multi-Tab Bottom Sheet WebView Stack ---
export interface TabHandle {
  tabId: string;
  appId: string;
  initialRoute: string;
  title: string;
  isBackgrounded: boolean;
  memoryTrimmed: boolean;
  createdAt?: number;
}

export interface TabOpenPayload {
  appId?: string;
  initialRoute?: string;
  title?: string;
}

export interface TabOpenResult extends TabHandle {}

export interface TabClosePayload {
  tabId: string;
}

export interface TabCloseResult {
  closed: boolean;
  tabId: string;
}

export interface TabSwitchPayload {
  tabId: string;
}

export interface TabSwitchResult {
  switched: boolean;
  tabId: string;
}

export interface TabListResult {
  tabs: TabHandle[];
}

export interface TabCloseAllResult {
  closedAll: boolean;
}

// --- Task 10198: Native Permission Priming Dialog ---
export interface RequestPermissionOptions {
  appId?: string;
  rationale?: string;
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

// === Enterprise Domain Mini-Apps Type Definitions ===

// 1. Multi-Rail Payment Gateway (Task 10121 & Enterprise Payments)
export type PaymentProvider = 'alipay' | 'bakong' | 'paypay' | 'stripe' | 'apple_pay' | 'google_pay' | 'storekit';

export interface RequestPaymentPayload {
  provider: PaymentProvider | string;
  orderId: string;
  intentId: string;
  amount: number;
  currency: string;
  nonce?: string;
  signedPayload?: string;
  metadata?: Record<string, any>;
}

export interface RequestPaymentResult {
  status: 'SUCCESS' | 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'DISMISSED' | 'FAILED';
  intentId: string;
  transactionHandle?: string;
  txHash?: string;
  amount: number;
  currency: string;
  provider?: string;
  signature?: string;
}

export interface QueryPaymentStatusPayload {
  intentId: string;
  provider?: string;
}

export interface QueryPaymentStatusResult {
  status: string;
  intentId: string;
  amount?: number;
  currency?: string;
  provider?: string;
}

export interface CancelPaymentPayload {
  intentId: string;
  reason?: string;
}

export interface CancelPaymentResult {
  cancelled: boolean;
  intentId: string;
}

// 2. IoT & Hardware: 3D Device Motion & Orientation
export interface DeviceMotionVector {
  x: number;
  y: number;
  z: number;
}

export interface DeviceRotationRate {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface DeviceMotionData {
  alpha: number; // Z-axis rotation (0-360 deg)
  beta: number;  // X-axis rotation (-180 to 180 deg)
  gamma: number; // Y-axis rotation (-90 to 90 deg)
  acceleration?: DeviceMotionVector;
  accelerationIncludingGravity?: DeviceMotionVector;
  rotationRate?: DeviceRotationRate;
  compassHeading?: number;
  timestamp?: number;
}

export interface StartDeviceMotionPayload {
  interval?: SensorInterval;
}

// 3. Sandboxed Filesystem Operations (Domain 3 / Task 10105)
export interface FsWriteFilePayload {
  filePath: string;
  data: string;
  encoding?: 'utf8' | 'base64' | 'hex' | string;
  append?: boolean;
  appId?: string;
}

export interface FsWriteFileResult {
  written: boolean;
  byteSize: number;
  filePath: string;
}

export interface FsReadFilePayload {
  filePath: string;
  encoding?: 'utf8' | 'base64' | 'hex' | string;
  appId?: string;
}

export interface FsReadFileResult {
  data: string;
  byteSize: number;
  filePath: string;
}

export interface FsListDirPayload {
  dirPath?: string;
  appId?: string;
}

export interface FsFileEntry {
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  lastModified?: number;
}

export interface FsListDirResult {
  files: FsFileEntry[];
}

export interface FsStatPayload {
  filePath: string;
  appId?: string;
}

export interface FsStatResult {
  exists: boolean;
  sizeBytes: number;
  isDirectory: boolean;
  lastModified?: number;
}

export interface FsDeleteFilePayload {
  filePath: string;
  appId?: string;
}

export interface FsDeleteFileResult {
  deleted: boolean;
  filePath: string;
}

export interface FsMkdirPayload {
  dirPath: string;
  recursive?: boolean;
  appId?: string;
}

export interface FsMkdirResult {
  created: boolean;
  dirPath: string;
}

// 4. Domain Data Models
export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  stock: number;
  tag: string;
  image: string;
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface WorkOrder {
  id: string;
  title: string;
  customer: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scheduledTime: string;
  equipmentTag?: string;
  notes?: string;
}

export interface VaultSecret {
  id: string;
  label: string;
  category: 'API_KEY' | 'SEED_PHRASE' | 'JWT_TOKEN' | 'PRIVATE_KEY' | 'CERTIFICATE';
  value: string;
  createdAt: number;
  lastAccessed?: number;
}
