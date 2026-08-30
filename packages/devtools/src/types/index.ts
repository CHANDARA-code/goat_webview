/**
 * @goat/devtools - Unified Type Definitions
 */

export * from "./workspace.ts";
export * from "./bridge.ts";
export * from "./simulator.ts";
export * from "./sensor.ts";
export * from "./debugger.ts";
export * from "./packaging.ts";

// Aliases for compatibility
export type ThemeMode = "dark" | "light";
export type DeviceSkinType =
  | "iphone16pro"
  | "pixel9pro"
  | "ipadpro"
  | "foldable"
  | "iphone-16-pro"
  | "pixel-9-pro"
  | "ipad-pro-11"
  | "foldable-dual";
export type Orientation = "portrait" | "landscape";
export type ThreadType = "AppService" | "AppView" | "GoatHost" | "System";
export type NetworkPreset =
  | "online"
  | "offline"
  | "2g"
  | "3g"
  | "4g"
  | "5g"
  | "high-latency"
  | "high_latency"
  | "packet-loss"
  | "packet_loss"
  | "custom";
export type BiometricType = "faceId" | "touchId" | "fingerprint" | "none";

export interface EditorTab {
  id: string;
  filePath: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
  language?: string;
}

export interface FileItem {
  name: string;
  path: string;
  content: string;
  language: string;
  isReadonly?: boolean;
}

export interface ConsoleLogEntry {
  id?: string;
  thread?: ThreadType;
  source?: ThreadType;
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  timestamp?: number;
  data?: any;
}

export interface BridgeTraceEntry {
  id?: string;
  callId?: string;
  action: string;
  domain?: string;
  threadLane?: "AppService" | "AppView" | "GoatHost";
  direction?: "worker-to-host" | "host-to-worker" | "bridge";
  payload?: any;
  response?: any;
  reply?: any;
  durationMs?: number;
  status?: "pending" | "success" | "error";
  timestamp?: number;
}

export interface BlePeripheral {
  id: string;
  name: string;
  rssi: number;
  serviceUuids?: string[];
  services?: any[];
  isConnected?: boolean;
}

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string;
}

export interface SubpackageConfig {
  root: string;
  name?: string;
  pages: string[];
  independent?: boolean;
  sizeBytes?: number;
  preloadRule?: { network: "all" | "wifi" };
}

export interface BundleSizeStats {
  mainPackageBytes?: number;
  mainPackageSize?: number;
  mainSizeBytes?: number;
  subpackagesBytes?: Record<string, number>;
  subpackages?: any[];
  totalBytes?: number;
  totalSizeBytes?: number;
  maxRecommendedSizeBytes?: number;
  isWithinQuota?: boolean;
  warnings?: string[];
}

export interface V8BytecodeStats {
  enabled: boolean;
  originalSizeBytes?: number;
  rawJsSizeBytes?: number;
  bytecodeSizeBytes?: number;
  compilationTimeMs?: number;
  compressionRatio?: number;
  estimatedColdBootMs?: number;
  cachedBootMs?: number;
  integrityHash?: string;
  cacheHit?: boolean;
  status?: string;
}

export interface QrPairingState {
  pairingCode?: string;
  token?: string;
  wsUrl?: string;
  url?: string;
  qrSvg?: string;
  isConnected?: boolean;
  status?: "pending" | "connected" | "expired";
  clientDevice?: {
    name?: string;
    platform?: string;
    model?: string;
    version?: string;
    ipAddress?: string;
  };
}

export interface WorkspaceSlice {
  theme: ThemeMode;
  isLeftSidebarOpen: boolean;
  isBottomDebuggerOpen: boolean;
  isRightSimulatorOpen: boolean;
  leftSidebarWidth?: number;
  rightSimulatorWidth?: number;
  simulatorWidth?: number;
  bottomDebuggerHeight?: number;
  debuggerHeight?: number;
  activeSidebarTab: string;
  activeSidebarView: any;
  activeLeftTab?: string;
  activeBottomTab: string;
  activeDebuggerTab: string;
  panelSizes?: any;
  collapsedPanels?: any;
  files: Record<string, string>;
  fileTree?: any;
  activeFilePath: string | null;
  openTabs: EditorTab[] | any[];
  activeTabId: string | null;
  activeTemplate: string;
  activeTemplateId: string;
  isTemplateModalOpen: boolean;
  validationMarkers?: any[];
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setBottomDebuggerOpen: (open: boolean) => void;
  setRightSimulatorOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleBottomDebugger: () => void;
  toggleRightSimulator: () => void;
  togglePanelCollapse?: (panel: any) => void;
  setPanelSizes?: (sizes: any) => void;
  setActiveSidebarTab: (tab: string) => void;
  setActiveLeftTab?: (tab: string) => void;
  setActiveSidebarView: (view: any) => void;
  setActiveBottomTab: (tab: string) => void;
  setActiveDebuggerTab: (tab: string) => void;
  openFile: (path: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  createFile: (path: string, content?: string) => void;
  createFolder?: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  deleteNode?: (path: string) => void;
  deleteFileOrFolder?: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  renameNode?: (oldPath: string, newPath: string) => void;
  renameFileOrFolder?: (oldPath: string, newPath: string) => void;
  markTabDirty?: (tabId: string, isDirty: boolean) => void;
  loadTemplate: (templateId: string) => void;
  openTemplateModal: () => void;
  closeTemplateModal: () => void;
  setTemplateModalOpen?: (open: boolean) => void;
  resetWorkspace?: () => void;
  setValidationMarkers?: (markers: any[]) => void;
  setFiles?: (files: Record<string, string>) => void;
}

export interface SimulatorSlice {
  activeSkinId: any;
  activeDeviceSkin: DeviceSkinType;
  viewportScale: number;
  scale: number;
  orientation: Orientation;
  simulatorTheme: ThemeMode;
  runtimeMode: string;
  isRunning: boolean;
  isLoading: boolean;
  lastError: string | null;
  safeAreaInsets: { top: number; bottom: number; left: number; right: number };
  frameBatchingEnabled: boolean;
  fps: number;
  metrics: {
    fps: number;
    frameTimeMs: number;
    droppedFrames: number;
    vdomPatchCount: number;
    lastUpdated: number;
  };
  setActiveDeviceSkin: (skin: DeviceSkinType | string) => void;
  setDeviceSkin: (skin: any) => void;
  setViewportScale: (scale: number) => void;
  setScale: (scale: any) => void;
  setOrientation: (orientation: Orientation | any) => void;
  toggleOrientation: () => void;
  setSimulatorTheme: (theme: ThemeMode) => void;
  toggleSimulatorTheme: () => void;
  setRuntimeMode: (mode: any) => void;
  startSimulator: () => void;
  stopSimulator: () => void;
  setIsRunning: (running: boolean) => void;
  restartSimulator: () => void;
  setSimulatorError: (err: string | null) => void;
  updateMetrics: (metrics: any) => void;
  setSafeAreaInsets: (insets: any) => void;
  setFrameBatchingEnabled: (enabled: boolean) => void;
  setFps: (fps: number) => void;
}

export interface SensorsSlice {
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
  compass: { direction: number; accuracy: number };
  deviceMotion: { alpha: number; beta: number; gamma: number };
  location: {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    speed: number;
  };
  gpxRoute: {
    points: GpxPoint[];
    isPlaying: boolean;
    speedMultiplier: number;
    currentIndex: number;
  };
  networkThrottling: {
    preset: any;
    latencyMs: number;
    downloadKbps: number;
    uploadKbps: number;
    packetLossRate: number;
    isOffline: boolean;
  };
  battery: {
    level: number;
    isCharging: boolean;
    chargingTime: number;
    dischargingTime: number;
  };
  screenBrightness: number;
  blePeripherals: BlePeripheral[];
  nfcTag: { id: string; techList: string[]; ndefMessage?: string };
  biometrics: {
    type: any;
    isEnrolled: boolean;
    shouldSucceed: boolean;
    isModalOpen: boolean;
  };
  activeMotionPreset?: string;
  networkProfileId?: string;
  setAccelerometer: (acc: any) => void;
  setGyroscope: (gyro: any) => void;
  setCompass: (comp: any) => void;
  setDeviceMotion: (motion: any) => void;
  setLocation: (loc: any) => void;
  setGpxRoute: (points: GpxPoint[]) => void;
  setGpxRoutePoints: (points: GpxPoint[]) => void;
  setGpxPlaying: (playing: boolean) => void;
  setGpxSpeed: (mult: number) => void;
  setGpxSpeedMultiplier: (mult: number) => void;
  setGpxIndex: (idx: number) => void;
  setGpxCurrentIndex: (idx: number) => void;
  setNetworkPreset: (preset: any) => void;
  setNetworkCustom: (config: any) => void;
  setCustomNetworkThrottling: (config: any) => void;
  setNetworkProfile?: (profile: any) => void;
  setMotionPreset?: (preset: any) => void;
  setBattery: (bat: any) => void;
  setScreenBrightness: (brightness: number) => void;
  addBlePeripheral: (dev: BlePeripheral) => void;
  removeBlePeripheral: (id: string) => void;
  setBleConnected: (id: string, connected: boolean) => void;
  setNfcTag: (tag: any) => void;
  setBiometrics: (bio: any) => void;
}

export interface DebuggerSlice {
  consoleLogs: ConsoleLogEntry[];
  logs?: any[];
  bridgeTraces: BridgeTraceEntry[];
  waterfallSpans?: any[];
  selectedTraceId: string | null;
  domTree: any;
  vdomTree?: any;
  selectedDomNodeId: string | null;
  selectedNodeId?: string | null;
  hoveredDomNodeId?: string | null;
  hoveredNodeId?: string | null;
  domElements: {
    vdomTree: any;
    domTree: any;
    selectedNodeId: string | null;
    hoveredNodeId: string | null;
    computedStyles: Record<string, string>;
  };
  storageData: {
    kvStore: Record<string, any>;
    sqliteTables: Record<string, any[]>;
    fsTree: Record<string, any>;
  };
  storageItems?: any[];
  sqliteTables?: any[];
  addConsoleLog: (log: any) => void;
  addLog?: (log: any) => void;
  clearConsoleLogs: () => void;
  clearLogs?: () => void;
  addBridgeTrace: (trace: any) => void;
  addWaterfallSpan?: (span: any) => void;
  updateBridgeTrace: (id: string, updates: any) => void;
  updateWaterfallSpan?: (id: string, updates: any) => void;
  clearBridgeTraces: () => void;
  clearWaterfall?: () => void;
  setSelectedTraceId: (id: string | null) => void;
  setDomTree: (tree: any) => void;
  setVdomTree: (tree: any) => void;
  setSelectedDomNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredDomNodeId?: (id: string | null) => void;
  setHoveredNodeId?: (id: string | null) => void;
  setComputedStyles: (styles: Record<string, string>) => void;
  setStorageKv: (key: string, value: any) => void;
  deleteStorageKv: (key: string) => void;
  clearStorageKv: () => void;
  setStorageItems?: (items: any[]) => void;
  setStorageItem?: (key: string, value: string, type?: any) => void;
  removeStorageItem?: (key: string) => void;
  clearStorage?: () => void;
  setSqliteTables?: (tables: any) => void;
  setSqliteTableData: (table: string, rows: any[]) => void;
  setFsTree?: (fsTree: Record<string, any>) => void;
  setFsItem?: (dirPath: string, file: any) => void;
  deleteFsItem?: (dirPath: string, fileName: string) => void;
}

export interface PackagingSlice {
  subpackages: SubpackageConfig[];
  bundleStats: BundleSizeStats | any;
  bundleSizeStats: BundleSizeStats | any;
  v8BytecodeStats: V8BytecodeStats | any;
  bytecodeEstimate?: any;
  qrPairing: QrPairingState | any;
  qrSession?: any;
  isBuilding?: boolean;
  setSubpackages: (subs: SubpackageConfig[] | any[]) => void;
  addSubpackage: (sub: SubpackageConfig | any) => void;
  removeSubpackage: (root: string) => void;
  updateBundleStats: (stats: Partial<BundleSizeStats> | any) => void;
  setBundleStats?: (stats: any) => void;
  setBundleSizeStats?: (stats: any) => void;
  setV8BytecodeStats: (stats: Partial<V8BytecodeStats> | any) => void;
  setBytecodeEstimate?: (estimate: any) => void;
  setQrPairing: (qr: Partial<QrPairingState> | any) => void;
  setQrSession?: (session: any) => void;
  setIsBuilding?: (building: boolean) => void;
}

export interface DevToolsStore
  extends
    WorkspaceSlice,
    SimulatorSlice,
    SensorsSlice,
    DebuggerSlice,
    PackagingSlice {}
