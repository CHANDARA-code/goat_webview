/**
 * @goat/bridge-mock - In-Memory Mock State Store
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
import { BiometricConfig, ScannerConfig, Web3Config, MockStateSnapshot } from './types.js';

export class MockStateManager {
  public defaultAppId: string = 'mock-miniapp-1001';

  // 1. Device & System
  public deviceInfo: DeviceInfo;
  public battery: { level: number; isCharging: boolean };
  public network: GetNetworkTypeResult;
  public brightness: number;
  public keepScreenOn: boolean;
  public statusBarDark: boolean;
  public clipboard: string;

  // 2. Storage & Sandboxing
  public storage: Map<string, Map<string, string>> = new Map();
  public secureStorage: Map<string, Map<string, string>> = new Map();
  public cookies: Map<string, CookieItem[]> = new Map();
  public httpAuthCreds: Map<string, { username: string; password: string }> = new Map();

  // 3. FileSystem
  public fs: Map<string, Map<string, { data: string; isDir: boolean; lastModified: number; isFile: boolean }>> = new Map();

  // 4. Permissions
  public permissions: Map<string, boolean> = new Map();

  // 5. Location & Geofencing
  public location: LocationData;
  public geofences: Map<string, GeofenceRegionResult> = new Map();

  // 6. Biometrics & Scanner
  public biometrics: BiometricConfig;
  public scanner: ScannerConfig;

  // 7. Media & Audio
  public media: MediaFile[] = [];
  public audio: AudioStateResult;

  // 8. Contacts & Social
  public contacts: ContactResult[] = [];

  // 9. UI & Navigation Bar & Insets
  public navBar: NavBarConfigPayload;
  public bottomSheet: BottomSheetResult;
  public safeAreaInsets: SafeAreaInsetsResult;
  public keyboardInsets: KeyboardInsetsResult;

  // 10. Multi-Tab & Multi-App
  public tabs: TabHandle[] = [];
  public activeTabId: string | null = null;
  public miniAppInstances: Map<string, OpenMiniAppResult> = new Map();

  // 11. BLE & NFC
  public bleDevices: BleDevice[] = [];
  public bleScanning: boolean = false;
  public connectedBleDevices: Set<string> = new Set();
  public bleCharacteristics: Map<string, string> = new Map();
  public nfcEnabled: boolean = true;
  public nfcDiscovering: boolean = false;
  public nfcTag: NfcTagResult;

  // 12. Web3 & Payments
  public web3: Web3Config;
  public iapProducts: IapProductItem[] = [];
  public iapPurchases: Array<{ invoiceSlug: string; status: string; transactionId: string; amount: number }> = [];

  // 13. Binary IPC Ports
  public binaryPorts: Map<string, { queue: Array<{ dataBase64: string; seq: number }>; closed: boolean; currentSeq: number }> = new Map();

  // 14. Navigation Page Stack
  public pageStack: PageStackEntryPayload[] = [];

  // 15. Subpackages & Bytecode Cache
  public subpackages: Map<string, { isCached: boolean; byteSize: number; extractedPath: string }> = new Map();
  public bytecodeCache: Map<string, { bytecodeSizeBytes: number; cachePath: string; isWarm: boolean }> = new Map();

  // 16. Render & Native Views
  public activeNativeViews: Map<string, NativeComponentDescriptorResult> = new Map();
  public isTransparentWindow: boolean = false;
  public windowBgHex: string = '#FFFFFF';

  // 17. APM & Capability Discovery
  public dynamicCapabilities: Map<string, ApiCapabilityResult> = new Map();
  public apmMetrics: ApmMetricsPayload[] = [];
  public startupBenchmark: StartupBenchmarkReportResult;
  public bridgeTimings: Array<{ action: string; durationMs: number; id: string }> = [];
  public traces: TraceEnvelope[] = [];
  public activeSpans: Map<string, { spanId: string; traceId: string; opName: string; startMs: number; traceparent: string }> = new Map();
  public completedSpans: Array<{ spanId: string; traceId: string; opName: string; durationMs: number }> = [];

  // 18. Push Notifications
  public pushToken: string = 'fcm_sim_token_' + Math.random().toString(36).substring(2, 10);
  public badgeCount: number = 0;
  public pushTopics: Set<string> = new Set();
  public pendingNotifications: Array<{ title: string; content: string; channelId?: string; data?: any }> = [];

  // Guardrail Trackers
  public lastUserGestureTimestamp: number = Date.now();
  public lastDialogTimestamp: number = 0;
  public enforceGestureFreshness: boolean = false; // Enabled for testing gesture gates
  public enforceDialogCooldown: boolean = false;   // Enabled for testing cooldown gates

  constructor() {
    this.deviceInfo = this.getDefaultDeviceInfo();
    this.battery = { level: 95, isCharging: false };
    this.network = { networkType: 'wifi', isConnected: true };
    this.brightness = 0.85;
    this.keepScreenOn = false;
    this.statusBarDark = false;
    this.clipboard = 'Welcome to Goat Mini-App!';

    this.location = {
      latitude: 37.774929,
      longitude: -122.419416,
      speed: 0.0,
      accuracy: 5.0,
      altitude: 15.0,
      verticalAccuracy: 3.0,
      horizontalAccuracy: 5.0,
      heading: 90.0,
    };

    this.biometrics = {
      supported: true,
      biometryType: 'face',
      autoAuthSuccess: true,
      maxAttempts: 3,
      failedAttempts: 0,
      isLockedOut: false,
    };

    this.scanner = {
      mockScanResult: 'https://goat.dev/pay?inv=99281',
      mockScanType: 'QR_CODE',
      scanDelayMs: 200,
      autoScan: true,
    };

    this.audio = {
      status: 'stopped',
      currentTime: 0,
      duration: 180,
    };

    this.navBar = {
      title: 'Goat MiniApp',
      subtitle: 'Simulated Environment',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      isDark: false,
      leftButton: 'BACK',
      rightButtons: ['MORE', 'CLOSE'],
      isProgressVisible: false,
      progress: 0,
      isVisible: true,
    };

    this.bottomSheet = {
      currentSnap: 0,
      sheetValue: 'COLLAPSED',
      isDismissible: true,
      isExpanded: false,
      isCollapsed: true,
      isDismissed: false,
    };

    this.safeAreaInsets = {
      top: 47,
      bottom: 34,
      left: 0,
      right: 0,
      keyboardHeight: 0,
      totalBottom: 34,
    };

    this.keyboardInsets = {
      isVisible: false,
      heightPx: 0,
      adjustedViewportBottomInset: 0,
    };

    this.nfcTag = {
      type: 'NDEF_TEXT',
      payload: 'https://goat.dev/nfc/tap-to-open',
      uri: 'https://goat.dev/nfc/tap-to-open',
    };

    this.web3 = {
      connected: true,
      address: '0x71C80e1A9128221882d338E7EFEF65D6b2b73D96',
      publicKey: '0x0489...34fe',
      wallet: 'GoatVault',
      network: 'Ethereum Mainnet',
      chainId: '1',
      privateKeyMock: '0x88921...simulated_key',
    };

    this.startupBenchmark = {
      coldStartTimeMs: 142.5,
      warmStartTimeMs: 28.1,
      memoryDeltaMb: 4.2,
      isColdBootWithinSla: true,
      isWarmBootWithinSla: true,
      isMemoryWithinSla: true,
      totalSamples: 12,
    };

    this.initSeedData();
  }

  public initSeedData(): void {
    // Permissions seed
    this.permissions.set('LOCATION', true);
    this.permissions.set('CAMERA', true);
    this.permissions.set('BIOMETRIC', true);
    this.permissions.set('CONTACTS', true);
    this.permissions.set('BLUETOOTH', true);
    this.permissions.set('NOTIFICATION', true);

    // Seed contacts
    this.contacts = [
      { name: 'Alice Chen', phoneNumber: '+1 (555) 234-5678', email: 'alice@example.com' },
      { name: 'Bob Smith', phoneNumber: '+1 (555) 876-5432', email: 'bob@example.com' },
      { name: 'Charlie Kim', phoneNumber: '+1 (555) 345-6789', email: 'charlie@example.com' },
    ];

    // Seed media
    this.media = [
      {
        tempFilePath: 'goat://cache/photos/IMG_20260826_001.jpg',
        size: 1024 * 1024 * 2.4,
        fileType: 'image',
        width: 1920,
        height: 1080,
      },
      {
        tempFilePath: 'goat://cache/videos/VID_20260826_002.mp4',
        size: 1024 * 1024 * 15.2,
        fileType: 'video',
        duration: 24.5,
        width: 1920,
        height: 1080,
      },
    ];

    // Seed BLE devices
    this.bleDevices = [
      { deviceId: 'BLE:FA:23:4B:99:01', name: 'Goat POS Terminal 1', rssi: -54, isConnectable: true },
      { deviceId: 'BLE:EE:11:88:AA:02', name: 'Goat Beacon Alpha', rssi: -72, isConnectable: true },
      { deviceId: 'BLE:00:1A:7D:DA:71', name: 'Smart Smartband Pro', rssi: -85, isConnectable: false },
    ];
    this.bleCharacteristics.set('BLE:FA:23:4B:99:01:00002a00-0000-1000-8000-00805f9b34fb', 'Goat POS Terminal');
    this.bleCharacteristics.set('BLE:FA:23:4B:99:01:00002a19-0000-1000-8000-00805f9b34fb', '98'); // Battery Level 98%

    // Seed IAP products
    this.iapProducts = [
      { productId: 'com.goat.pro.monthly', title: 'Goat Pro Monthly', description: 'Unlock all mini-app features', price: '$4.99', currency: 'USD', type: 'subscription' },
      { productId: 'com.goat.gems.100', title: '100 Gems', description: 'In-app currency pack', price: '$0.99', currency: 'USD', type: 'consumable' },
      { productId: 'com.goat.pass.season1', title: 'Season 1 Pass', description: 'Lifetime access to Season 1 badges', price: '$9.99', currency: 'USD', type: 'non_consumable' },
    ];

    // Seed page stack
    this.pageStack = [
      { pageId: 'page_root', route: '/pages/index/index', title: 'Home', isSuspended: false },
    ];

    // Seed subpackages
    this.subpackages.set('subpkg_checkout', { isCached: true, byteSize: 245000, extractedPath: '/sandbox/subpackages/subpkg_checkout' });
    this.subpackages.set('subpkg_profile', { isCached: false, byteSize: 189000, extractedPath: '/sandbox/subpackages/subpkg_profile' });

    // Seed bytecode cache
    this.bytecodeCache.set('/bundle/main.js', { bytecodeSizeBytes: 520000, cachePath: '/sandbox/bytecode/main.js.bin', isWarm: true });

    // Seed storage
    this.getAppStorage(this.defaultAppId).set('theme', 'dark');
    this.getAppStorage(this.defaultAppId).set('has_onboarded', 'true');
    this.getAppSecureStorage(this.defaultAppId).set('session_token', 'sec_tok_991823abf8921');

    // Seed FileSystem
    const appFs = this.getAppFs(this.defaultAppId);
    appFs.set('/', { data: '', isDir: true, isFile: false, lastModified: Date.now() });
    appFs.set('/documents', { data: '', isDir: true, isFile: false, lastModified: Date.now() });
    appFs.set('/documents/manifest.json', {
      data: JSON.stringify({ appId: this.defaultAppId, name: 'Sample MiniApp', version: '1.0.0' }),
      isDir: false,
      isFile: true,
      lastModified: Date.now(),
    });
  }

  private getDefaultDeviceInfo(): DeviceInfo {
    return {
      model: 'Pixel 9 Pro (Simulated)',
      manufacturer: 'Google',
      brand: 'Goat',
      platform: 'mock-browser',
      androidVersion: '15.0',
      sdkInt: 35,
      screenWidthDp: 412,
      screenHeightDp: 915,
      density: 2.625,
      batteryLevel: 95,
      isCharging: false,
      isAlgorithmicDarkening: false,
      appVersion: '1.4.0',
      installGuid: 'guid-sim-99120-f8a923-goat',
    };
  }

  // --- Helper getters for tenant maps ---
  public getAppStorage(appId: string = this.defaultAppId): Map<string, string> {
    if (!this.storage.has(appId)) {
      this.storage.set(appId, new Map());
    }
    return this.storage.get(appId)!;
  }

  public getAppSecureStorage(appId: string = this.defaultAppId): Map<string, string> {
    if (!this.secureStorage.has(appId)) {
      this.secureStorage.set(appId, new Map());
    }
    return this.secureStorage.get(appId)!;
  }

  public getAppFs(appId: string = this.defaultAppId): Map<string, { data: string; isDir: boolean; lastModified: number; isFile: boolean }> {
    if (!this.fs.has(appId)) {
      const map = new Map();
      map.set('/', { data: '', isDir: true, isFile: false, lastModified: Date.now() });
      this.fs.set(appId, map);
    }
    return this.fs.get(appId)!;
  }

  // --- User Gesture Gate Simulation ---
  public recordUserGesture(): void {
    this.lastUserGestureTimestamp = Date.now();
  }

  public isUserGestureFresh(maxAgeMs: number = 10000): boolean {
    if (!this.enforceGestureFreshness) return true;
    return Date.now() - this.lastUserGestureTimestamp <= maxAgeMs;
  }

  // --- Dialog Cooldown Throttle ---
  public checkAndRecordDialog(cooldownMs: number = 500): boolean {
    if (!this.enforceDialogCooldown) return true;
    const now = Date.now();
    if (now - this.lastDialogTimestamp < cooldownMs) {
      return false;
    }
    this.lastDialogTimestamp = now;
    return true;
  }

  // --- Snapshot & Restore ---
  public snapshot(): MockStateSnapshot {
    const storageObj: Record<string, Record<string, string>> = {};
    for (const [appId, map] of this.storage.entries()) {
      storageObj[appId] = Object.fromEntries(map.entries());
    }

    const secureStorageObj: Record<string, Record<string, string>> = {};
    for (const [appId, map] of this.secureStorage.entries()) {
      secureStorageObj[appId] = Object.fromEntries(map.entries());
    }

    const cookiesObj: Record<string, CookieItem[]> = {};
    for (const [appId, list] of this.cookies.entries()) {
      cookiesObj[appId] = structuredClone(list);
    }

    const httpAuthCredsObj: Record<string, { username: string; password: string }> = {};
    for (const [host, creds] of this.httpAuthCreds.entries()) {
      httpAuthCredsObj[host] = { ...creds };
    }

    const fsObj: Record<string, Record<string, { data: string; isDir: boolean; lastModified: number; isFile: boolean }>> = {};
    for (const [appId, map] of this.fs.entries()) {
      fsObj[appId] = structuredClone(Object.fromEntries(map.entries()));
    }

    const binaryPortsObj: Record<string, { queue: Array<{ dataBase64: string; seq: number }>; closed: boolean; currentSeq: number }> = {};
    for (const [portId, portData] of this.binaryPorts.entries()) {
      binaryPortsObj[portId] = structuredClone(portData);
    }

    const activeSpansObj: Record<string, { spanId: string; traceId: string; opName: string; startMs: number; traceparent: string }> = {};
    for (const [id, span] of this.activeSpans.entries()) {
      activeSpansObj[id] = { ...span };
    }

    return {
      deviceInfo: structuredClone(this.deviceInfo),
      battery: structuredClone(this.battery),
      network: structuredClone(this.network),
      brightness: this.brightness,
      keepScreenOn: this.keepScreenOn,
      statusBarDark: this.statusBarDark,
      clipboard: this.clipboard,
      storage: storageObj,
      secureStorage: secureStorageObj,
      cookies: cookiesObj,
      httpAuthCreds: httpAuthCredsObj,
      fs: fsObj,
      permissions: structuredClone(Object.fromEntries(this.permissions.entries())),
      location: structuredClone(this.location),
      geofences: structuredClone(Object.fromEntries(this.geofences.entries())),
      biometrics: structuredClone(this.biometrics),
      scanner: structuredClone(this.scanner),
      media: structuredClone(this.media),
      audio: structuredClone(this.audio),
      contacts: structuredClone(this.contacts),
      navBar: structuredClone(this.navBar),
      bottomSheet: structuredClone(this.bottomSheet),
      safeAreaInsets: structuredClone(this.safeAreaInsets),
      keyboardInsets: structuredClone(this.keyboardInsets),
      tabs: structuredClone(this.tabs),
      activeTabId: this.activeTabId,
      miniAppInstances: structuredClone(Object.fromEntries(this.miniAppInstances.entries())),
      bleDevices: structuredClone(this.bleDevices),
      bleScanning: this.bleScanning,
      connectedBleDevices: Array.from(this.connectedBleDevices),
      bleCharacteristics: Object.fromEntries(this.bleCharacteristics.entries()),
      nfcEnabled: this.nfcEnabled,
      nfcDiscovering: this.nfcDiscovering,
      nfcTag: structuredClone(this.nfcTag),
      web3: structuredClone(this.web3),
      iapProducts: structuredClone(this.iapProducts),
      iapPurchases: structuredClone(this.iapPurchases),
      binaryPorts: binaryPortsObj,
      pageStack: structuredClone(this.pageStack),
      subpackages: structuredClone(Object.fromEntries(this.subpackages.entries())),
      bytecodeCache: structuredClone(Object.fromEntries(this.bytecodeCache.entries())),
      activeNativeViews: structuredClone(Object.fromEntries(this.activeNativeViews.entries())),
      isTransparentWindow: this.isTransparentWindow,
      windowBgHex: this.windowBgHex,
      dynamicCapabilities: structuredClone(Object.fromEntries(this.dynamicCapabilities.entries())),
      apmMetrics: structuredClone(this.apmMetrics),
      startupBenchmark: structuredClone(this.startupBenchmark),
      bridgeTimings: structuredClone(this.bridgeTimings),
      traces: structuredClone(this.traces),
      activeSpans: activeSpansObj,
      completedSpans: structuredClone(this.completedSpans),
      pushToken: this.pushToken,
      badgeCount: this.badgeCount,
      pushTopics: Array.from(this.pushTopics),
      pendingNotifications: structuredClone(this.pendingNotifications),
      lastUserGestureTimestamp: this.lastUserGestureTimestamp,
      lastDialogTimestamp: this.lastDialogTimestamp,
      enforceGestureFreshness: this.enforceGestureFreshness,
      enforceDialogCooldown: this.enforceDialogCooldown,
    };
  }

  public restore(snapshot: MockStateSnapshot): void {
    this.deviceInfo = structuredClone(snapshot.deviceInfo);
    this.battery = structuredClone(snapshot.battery);
    this.network = structuredClone(snapshot.network);
    this.brightness = snapshot.brightness;
    this.keepScreenOn = snapshot.keepScreenOn;
    this.statusBarDark = snapshot.statusBarDark;
    this.clipboard = snapshot.clipboard;

    this.storage.clear();
    for (const [appId, obj] of Object.entries(snapshot.storage || {})) {
      this.storage.set(appId, new Map(Object.entries(obj)));
    }

    this.secureStorage.clear();
    for (const [appId, obj] of Object.entries(snapshot.secureStorage || {})) {
      this.secureStorage.set(appId, new Map(Object.entries(obj)));
    }

    this.cookies.clear();
    for (const [appId, list] of Object.entries(snapshot.cookies || {})) {
      this.cookies.set(appId, structuredClone(list));
    }

    this.httpAuthCreds.clear();
    for (const [host, creds] of Object.entries(snapshot.httpAuthCreds || {})) {
      this.httpAuthCreds.set(host, structuredClone(creds));
    }

    this.fs.clear();
    for (const [appId, obj] of Object.entries(snapshot.fs || {})) {
      this.fs.set(appId, new Map(Object.entries(structuredClone(obj))));
    }

    this.permissions = new Map(Object.entries(structuredClone(snapshot.permissions || {})));
    this.location = structuredClone(snapshot.location);
    this.geofences = new Map(Object.entries(structuredClone(snapshot.geofences || {})));
    this.biometrics = structuredClone(snapshot.biometrics);
    this.scanner = structuredClone(snapshot.scanner);
    this.media = structuredClone(snapshot.media || []);
    this.audio = snapshot.audio ? structuredClone(snapshot.audio) : { status: 'stopped', currentTime: 0, duration: 180 };
    this.contacts = structuredClone(snapshot.contacts || []);
    this.navBar = structuredClone(snapshot.navBar);
    this.bottomSheet = structuredClone(snapshot.bottomSheet);
    this.safeAreaInsets = structuredClone(snapshot.safeAreaInsets);
    this.keyboardInsets = structuredClone(snapshot.keyboardInsets);
    this.tabs = structuredClone(snapshot.tabs || []);
    this.activeTabId = snapshot.activeTabId;
    this.miniAppInstances = new Map(Object.entries(structuredClone(snapshot.miniAppInstances || {})));
    this.bleDevices = structuredClone(snapshot.bleDevices || []);
    this.bleScanning = snapshot.bleScanning;
    this.connectedBleDevices = new Set(snapshot.connectedBleDevices || []);
    this.bleCharacteristics = new Map(Object.entries(snapshot.bleCharacteristics || {}));
    this.nfcEnabled = snapshot.nfcEnabled;
    this.nfcDiscovering = snapshot.nfcDiscovering;
    this.nfcTag = structuredClone(snapshot.nfcTag);
    this.web3 = structuredClone(snapshot.web3);
    this.iapProducts = structuredClone(snapshot.iapProducts || []);
    this.iapPurchases = structuredClone(snapshot.iapPurchases || []);

    this.binaryPorts.clear();
    for (const [portId, portData] of Object.entries(snapshot.binaryPorts || {})) {
      this.binaryPorts.set(portId, structuredClone(portData));
    }

    this.pageStack = structuredClone(snapshot.pageStack || []);
    this.subpackages = new Map(Object.entries(structuredClone(snapshot.subpackages || {})));
    this.bytecodeCache = new Map(Object.entries(structuredClone(snapshot.bytecodeCache || {})));
    this.activeNativeViews = new Map(Object.entries(structuredClone(snapshot.activeNativeViews || {})));
    this.isTransparentWindow = snapshot.isTransparentWindow ?? false;
    this.windowBgHex = snapshot.windowBgHex ?? '#FFFFFF';
    this.dynamicCapabilities = new Map(Object.entries(structuredClone(snapshot.dynamicCapabilities || {})));
    this.apmMetrics = structuredClone(snapshot.apmMetrics || []);
    this.startupBenchmark = structuredClone(snapshot.startupBenchmark);
    this.bridgeTimings = structuredClone(snapshot.bridgeTimings || []);
    this.traces = structuredClone(snapshot.traces || []);

    this.activeSpans.clear();
    for (const [id, span] of Object.entries(snapshot.activeSpans || {})) {
      this.activeSpans.set(id, { ...span });
    }

    this.completedSpans = structuredClone(snapshot.completedSpans || []);
    this.pushToken = snapshot.pushToken ?? this.pushToken;
    this.badgeCount = snapshot.badgeCount ?? 0;
    this.pushTopics = new Set(snapshot.pushTopics || []);
    this.pendingNotifications = structuredClone(snapshot.pendingNotifications || []);
    this.lastUserGestureTimestamp = snapshot.lastUserGestureTimestamp;
    this.lastDialogTimestamp = snapshot.lastDialogTimestamp;
    this.enforceGestureFreshness = snapshot.enforceGestureFreshness ?? false;
    this.enforceDialogCooldown = snapshot.enforceDialogCooldown ?? false;
  }

  public reset(): void {
    this.storage.clear();
    this.secureStorage.clear();
    this.cookies.clear();
    this.httpAuthCreds.clear();
    this.fs.clear();
    this.permissions.clear();
    this.geofences.clear();
    this.binaryPorts.clear();
    this.activeNativeViews.clear();
    this.dynamicCapabilities.clear();
    this.apmMetrics = [];
    this.bridgeTimings = [];
    this.traces = [];
    this.activeSpans.clear();
    this.completedSpans = [];
    this.tabs = [];
    this.activeTabId = null;
    this.miniAppInstances.clear();
    this.pendingNotifications = [];
    this.pushTopics.clear();
    this.badgeCount = 0;
    this.connectedBleDevices.clear();
    this.bleScanning = false;
    this.enforceGestureFreshness = false;
    this.enforceDialogCooldown = false;
    this.isTransparentWindow = false;
    this.windowBgHex = '#FFFFFF';
    this.subpackages.clear();
    this.bytecodeCache.clear();
    this.bleCharacteristics.clear();

    this.deviceInfo = this.getDefaultDeviceInfo();
    this.battery = { level: 95, isCharging: false };
    this.network = { networkType: 'wifi', isConnected: true };
    this.brightness = 0.85;
    this.keepScreenOn = false;
    this.statusBarDark = false;
    this.clipboard = 'Welcome to Goat Mini-App!';

    this.location = {
      latitude: 37.774929,
      longitude: -122.419416,
      speed: 0.0,
      accuracy: 5.0,
      altitude: 15.0,
      verticalAccuracy: 3.0,
      horizontalAccuracy: 5.0,
      heading: 90.0,
    };

    this.biometrics = {
      supported: true,
      biometryType: 'face',
      autoAuthSuccess: true,
      maxAttempts: 3,
      failedAttempts: 0,
      isLockedOut: false,
    };

    this.scanner = {
      mockScanResult: 'https://goat.dev/pay?inv=99281',
      mockScanType: 'QR_CODE',
      scanDelayMs: 200,
      autoScan: true,
    };

    this.audio = {
      status: 'stopped',
      currentTime: 0,
      duration: 180,
    };

    this.navBar = {
      title: 'Goat MiniApp',
      subtitle: 'Simulated Environment',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      isDark: false,
      leftButton: 'BACK',
      rightButtons: ['MORE', 'CLOSE'],
      isProgressVisible: false,
      progress: 0,
      isVisible: true,
    };

    this.bottomSheet = {
      currentSnap: 0,
      sheetValue: 'COLLAPSED',
      isDismissible: true,
      isExpanded: false,
      isCollapsed: true,
      isDismissed: false,
    };

    this.safeAreaInsets = {
      top: 47,
      bottom: 34,
      left: 0,
      right: 0,
      keyboardHeight: 0,
      totalBottom: 34,
    };

    this.keyboardInsets = {
      isVisible: false,
      heightPx: 0,
      adjustedViewportBottomInset: 0,
    };

    this.nfcTag = {
      type: 'NDEF_TEXT',
      payload: 'https://goat.dev/nfc/tap-to-open',
      uri: 'https://goat.dev/nfc/tap-to-open',
    };

    this.web3 = {
      connected: true,
      address: '0x71C80e1A9128221882d338E7EFEF65D6b2b73D96',
      publicKey: '0x0489...34fe',
      wallet: 'GoatVault',
      network: 'Ethereum Mainnet',
      chainId: '1',
      privateKeyMock: '0x88921...simulated_key',
    };

    this.startupBenchmark = {
      coldStartTimeMs: 142.5,
      warmStartTimeMs: 28.1,
      memoryDeltaMb: 4.2,
      isColdBootWithinSla: true,
      isWarmBootWithinSla: true,
      isMemoryWithinSla: true,
      totalSamples: 12,
    };

    this.initSeedData();
  }
}

export const mockState = new MockStateManager();
