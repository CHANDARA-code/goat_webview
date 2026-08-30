/**
 * @goat/compiler-uniapp Master Type Definitions
 * Complete type contracts for Uni-app to Goat compilation, AST transforms, JSAPI bridges, and bundler.
 */

// ============================================================================
// 1. Uni-app Source Configuration Types (pages.json, manifest.json)
// ============================================================================

export interface PageStyleConfig {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  navigationStyle?: 'default' | 'custom';
  backgroundColor?: string;
  backgroundTextStyle?: 'dark' | 'light';
  enablePullDownRefresh?: boolean;
  onReachBottomDistance?: number;
  disableScroll?: boolean;
  transparentTitle?: 'always' | 'auto' | 'none';
  titlePenetrate?: 'YES' | 'NO';
  [key: string]: unknown;
}

export interface GlobalStyleConfig extends PageStyleConfig {
  rpxCalcMaxDeviceWidth?: number;
  rpxCalcBaseDeviceWidth?: number;
  pageOrientation?: 'portrait' | 'landscape' | 'auto';
}

export interface TabBarItem {
  pagePath: string;
  text: string;
  iconPath?: string;
  selectedIconPath?: string;
  visible?: boolean;
}

export interface TabBarConfig {
  color: string;
  selectedColor: string;
  backgroundColor: string;
  borderStyle?: 'black' | 'white';
  position?: 'bottom' | 'top';
  fontSize?: string;
  iconWidth?: string;
  spacing?: string;
  height?: string;
  list: TabBarItem[];
}

export interface SubPackagePageConfig {
  path: string;
  style?: PageStyleConfig;
  name?: string;
}

export interface SubPackageConfig {
  root: string;
  name?: string;
  independent?: boolean;
  pages: (string | SubPackagePageConfig)[];
}

export interface PreloadRuleItem {
  packages: string[];
  network?: 'all' | 'wifi';
}

export type PreloadRuleConfig = Record<string, PreloadRuleItem>;

export interface EasycomConfig {
  autoscan?: boolean;
  custom?: Record<string, string>;
}

export interface PageDeclaration {
  path: string;
  style?: PageStyleConfig;
  name?: string;
  needLogin?: boolean;
}

export interface PagesJson {
  pages: PageDeclaration[];
  globalStyle?: GlobalStyleConfig;
  tabBar?: TabBarConfig;
  subPackages?: SubPackageConfig[];
  subpackages?: SubPackageConfig[];
  preloadRule?: PreloadRuleConfig;
  easycom?: EasycomConfig;
  condition?: {
    current?: number;
    list?: Array<{
      name: string;
      path: string;
      query?: string;
    }>;
  };
  [key: string]: unknown;
}

export interface UniAppManifestJson {
  name?: string;
  appid?: string;
  description?: string;
  versionName?: string;
  versionCode?: number | string;
  'mp-weixin'?: {
    appid?: string;
    setting?: Record<string, unknown>;
    permission?: Record<string, { desc: string }>;
  };
  'quickapp'?: Record<string, unknown>;
  'app-plus'?: Record<string, unknown>;
  'h5'?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// 2. Target Goat Distribution Manifest Types (manifest.schema.json)
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

export interface GoatSubpackageManifest {
  name?: string;
  root: string;
  pages: string[];
  preloadRule?: {
    network?: 'all' | 'wifi';
  };
}

export interface GoatBridgeConfig {
  timeout?: number;
  mockMode?: boolean;
}

export interface GoatManifest {
  appId: string;
  appName: string;
  version: string;
  versionCode: number;
  entryPage: string;
  window?: GoatWindowConfig;
  permissions?: GoatPermission[];
  subpackages?: GoatSubpackageManifest[];
  bridge?: GoatBridgeConfig;
}

export interface GoatConfigJson {
  appId: string;
  appName: string;
  version: string;
  versionCode: number;
  entryPage: string;
  pages: string[];
  window: GoatWindowConfig;
  pageStyles: Record<string, PageStyleConfig>;
  tabBar?: TabBarConfig;
  subpackages?: GoatSubpackageManifest[];
  preloadRule?: PreloadRuleConfig;
  easycom?: EasycomConfig;
  targetThreadModel: 'dual-thread' | 'single-thread';
  networkTimeout?: {
    request?: number;
    uploadFile?: number;
    downloadFile?: number;
  };
}

// ============================================================================
// 3. Conditional Preprocessor Types
// ============================================================================

export type SyntaxKind = 'js' | 'ts' | 'vue-template' | 'css' | 'scss' | 'less' | 'json';

export interface PreprocessorOptions {
  targetPlatform?: string; // default: 'GOAT'
  defines?: Record<string, boolean>;
  preserveLines?: boolean; // default: true (replaces removed lines with blanks)
  compatMode?: boolean; // default: true (treats MP-WEIXIN / MP as matching in GOAT)
}

export interface PreprocessorResult {
  code: string;
  removedLineCount: number;
  modified: boolean;
}

export interface ConditionFrame {
  conditionMatched: boolean;
  isIfdef: boolean;
  negated: boolean;
}

// ============================================================================
// 4. Bundler & Integrity Types
// ============================================================================

export type ThreadModel = 'dual-thread' | 'single-thread';

export interface IntegrityFileInfo {
  sha256: string;
  size: number;
}

export interface IntegrityManifest {
  version: string;
  generatedAt: string;
  algorithm: 'sha256';
  files: Record<string, IntegrityFileInfo>;
  totalBytes: number;
}

export interface BundleFileArtifact {
  path: string;
  content: string | Buffer;
  encoding?: BufferEncoding;
}

export interface BundlerInput {
  rootDir: string;
  outDir: string;
  pagesJson: PagesJson;
  manifest: GoatManifest;
  goatConfig: GoatConfigJson;
  targetThreadModel?: ThreadModel;
  sourceFiles?: Record<string, string | Buffer>;
}

export interface BundlerOutput {
  artifacts: BundleFileArtifact[];
  integrity: IntegrityManifest;
  entryPage: string;
  threadModel: ThreadModel;
}

// ============================================================================
// 5. Plugin Configuration Types
// ============================================================================

export interface GoatUniAppPluginOptions {
  targetPlatform?: string;
  threadModel?: ThreadModel;
  pagesJsonPath?: string;
  manifestJsonPath?: string;
  outDir?: string;
  enableEasycom?: boolean;
  compatMode?: boolean;
  customBridgeTransport?: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// 6. Runtime JSAPI Bridge Shims Types
// ============================================================================

export interface UniCallbackOptions<TSuccess = unknown, TFail = UniError> {
  success?: (res: TSuccess) => void;
  fail?: (err: TFail) => void;
  complete?: (res: TSuccess | TFail) => void;
}

export interface UniError {
  errMsg: string;
  code?: string | number;
  details?: unknown;
}

// Storage API types
export interface SetStorageOptions extends UniCallbackOptions<{ errMsg: string }> {
  key: string;
  data: unknown;
}

export interface GetStorageOptions extends UniCallbackOptions<{ data: unknown; errMsg: string }> {
  key: string;
}

export interface RemoveStorageOptions extends UniCallbackOptions<{ errMsg: string }> {
  key: string;
}

export interface ClearStorageOptions extends UniCallbackOptions<{ errMsg: string }> {}

export interface StorageInfoResult {
  keys: string[];
  currentSize: number;
  limitSize: number;
  errMsg: string;
}

export interface GetStorageInfoOptions extends UniCallbackOptions<StorageInfoResult> {}

// Router API types
export interface NavigateToOptions extends UniCallbackOptions<{ errMsg: string }> {
  url: string;
  animationType?: string;
  animationDuration?: number;
}

export interface RedirectToOptions extends UniCallbackOptions<{ errMsg: string }> {
  url: string;
}

export interface NavigateBackOptions extends UniCallbackOptions<{ errMsg: string }> {
  delta?: number;
  animationType?: string;
  animationDuration?: number;
}

export interface SwitchTabOptions extends UniCallbackOptions<{ errMsg: string }> {
  url: string;
}

export interface ReLaunchOptions extends UniCallbackOptions<{ errMsg: string }> {
  url: string;
}

// UI API types
export interface ShowToastOptions extends UniCallbackOptions<{ errMsg: string }> {
  title: string;
  icon?: 'success' | 'loading' | 'error' | 'none';
  image?: string;
  duration?: number;
  mask?: boolean;
}

export interface HideToastOptions extends UniCallbackOptions<{ errMsg: string }> {}

export interface ShowLoadingOptions extends UniCallbackOptions<{ errMsg: string }> {
  title?: string;
  mask?: boolean;
}

export interface HideLoadingOptions extends UniCallbackOptions<{ errMsg: string }> {}

export interface ModalResult {
  confirm: boolean;
  cancel: boolean;
  content?: string;
  errMsg: string;
}

export interface ShowModalOptions extends UniCallbackOptions<ModalResult> {
  title?: string;
  content: string;
  showCancel?: boolean;
  cancelText?: string;
  cancelColor?: string;
  confirmText?: string;
  confirmColor?: string;
  editable?: boolean;
  placeholderText?: string;
}

export interface ActionSheetResult {
  tapIndex: number;
  errMsg: string;
}

export interface ShowActionSheetOptions extends UniCallbackOptions<ActionSheetResult> {
  itemList: string[];
  itemColor?: string;
  title?: string;
}

export interface SetNavigationBarTitleOptions extends UniCallbackOptions<{ errMsg: string }> {
  title: string;
}

export interface SetNavigationBarColorOptions extends UniCallbackOptions<{ errMsg: string }> {
  frontColor: '#ffffff' | '#000000' | string;
  backgroundColor: string;
  animation?: {
    duration?: number;
    timingFunc?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  };
}

// Network API types
export interface RequestOptions extends UniCallbackOptions<RequestSuccessResult> {
  url: string;
  data?: string | Record<string, unknown> | ArrayBuffer;
  header?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
  timeout?: number;
  dataType?: 'json' | 'text' | string;
  responseType?: 'text' | 'arraybuffer';
}

export interface RequestSuccessResult {
  data: unknown;
  statusCode: number;
  header: Record<string, string>;
  cookies: string[];
  errMsg: string;
}

export interface DownloadFileOptions extends UniCallbackOptions<DownloadFileSuccessResult> {
  url: string;
  header?: Record<string, string>;
  timeout?: number;
  filePath?: string;
}

export interface DownloadFileSuccessResult {
  tempFilePath: string;
  statusCode: number;
  errMsg: string;
}

export interface UploadFileOptions extends UniCallbackOptions<UploadFileSuccessResult> {
  url: string;
  filePath: string;
  name: string;
  header?: Record<string, string>;
  formData?: Record<string, unknown>;
  timeout?: number;
}

export interface UploadFileSuccessResult {
  data: string;
  statusCode: number;
  errMsg: string;
}

// System API types
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
  platform: 'android' | 'ios' | 'devtools' | string;
  fontSizeSetting: number;
  SDKVersion: string;
  benchmarkLevel: number;
  albumAuthorized?: boolean;
  cameraAuthorized?: boolean;
  locationAuthorized?: boolean;
  microphoneAuthorized?: boolean;
  notificationAuthorized?: boolean;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  deviceOrientation?: 'portrait' | 'landscape';
  errMsg: string;
}

export interface GetSystemInfoOptions extends UniCallbackOptions<SystemInfo> {}

export interface DeviceInfoResult {
  brand: string;
  model: string;
  system: string;
  platform: string;
  memoryLimit?: number;
  errMsg: string;
}

export interface WindowInfoResult {
  windowWidth: number;
  windowHeight: number;
  screenWidth: number;
  screenHeight: number;
  statusBarHeight: number;
  pixelRatio: number;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  errMsg: string;
}

export interface AppBaseInfoResult {
  appId: string;
  appName: string;
  appVersion: string;
  appVersionCode: number;
  language: string;
  version: string;
  SDKVersion: string;
  theme?: 'dark' | 'light';
  errMsg: string;
}

// Payment API types
export interface RequestPaymentOptions extends UniCallbackOptions<PaymentResult> {
  provider?: string;
  orderInfo?: string | Record<string, unknown>;
  timeStamp?: string;
  nonceStr?: string;
  package?: string;
  signType?: string;
  paySign?: string;
  invoiceSlug?: string;
  title?: string;
  amount?: number;
  currency?: string;
}

export interface PaymentResult {
  errMsg: string;
  transactionId?: string;
  rawResponse?: unknown;
}

// Media & Hardware API types
export interface ScanCodeOptions extends UniCallbackOptions<ScanCodeResult> {
  onlyFromCamera?: boolean;
  scanType?: Array<'barCode' | 'qrCode' | 'datamatrix' | 'pdf417'>;
  autoDecodeCharSet?: boolean;
}

export interface ScanCodeResult {
  result: string;
  scanType: string;
  charSet: string;
  path?: string;
  rawData?: string;
  errMsg: string;
}

export interface ChooseImageOptions extends UniCallbackOptions<ChooseImageResult> {
  count?: number;
  sizeType?: Array<'original' | 'compressed'>;
  sourceType?: Array<'album' | 'camera'>;
}

export interface ChooseImageResult {
  tempFilePaths: string[];
  tempFiles: Array<{ path: string; size: number }>;
  errMsg: string;
}

export interface PreviewImageOptions extends UniCallbackOptions<{ errMsg: string }> {
  current?: string | number;
  urls: string[];
  indicator?: 'number' | 'default' | 'none';
  loop?: boolean;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  altitude: number;
  verticalAccuracy: number;
  horizontalAccuracy: number;
  errMsg: string;
}

export interface GetLocationOptions extends UniCallbackOptions<LocationResult> {
  type?: 'wgs84' | 'gcj02';
  altitude?: boolean;
  isHighAccuracy?: boolean;
  highAccuracyExpireTime?: number;
}

export interface ChooseLocationOptions extends UniCallbackOptions<ChooseLocationResult> {
  latitude?: number;
  longitude?: number;
  keyword?: string;
}

export interface ChooseLocationResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  errMsg: string;
}

export interface OpenLocationOptions extends UniCallbackOptions<{ errMsg: string }> {
  latitude: number;
  longitude: number;
  scale?: number;
  name?: string;
  address?: string;
}

export interface SetClipboardDataOptions extends UniCallbackOptions<{ errMsg: string }> {
  data: string;
  showToast?: boolean;
}

export interface GetClipboardDataOptions extends UniCallbackOptions<{ data: string; errMsg: string }> {}

export interface MakePhoneCallOptions extends UniCallbackOptions<{ errMsg: string }> {
  phoneNumber: string;
}

export interface VibrateOptions extends UniCallbackOptions<{ errMsg: string }> {}
