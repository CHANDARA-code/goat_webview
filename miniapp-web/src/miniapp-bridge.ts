import {
  BridgeRequest,
  BridgeResponse,
  DeviceInfo,
  HapticType,
  StorageSetPayload,
  StorageGetPayload,
  StorageRemovePayload,
  SecureStorageSetPayload,
  SecureStorageGetPayload,
  SecureStorageRemovePayload,
  SecureStorageClearPayload,
  ApiRequestPayload,
  ApiResponseData,
  BridgeLogEntry,
  ShowToastPayload,
  ShowToastResult,
  ShowModalPayload,
  ShowModalResult,
  ShowActionSheetPayload,
  ShowActionSheetResult,
  ShowLoadingPayload,
  LoadingResult,
  CanIUseResult,
  BrightnessResult,
  KeepScreenOnResult,
  MakePhoneCallPayload,
  SendSmsPayload,
  TelephonyResult,
  StartSensorPayload,
  GetLocationPayload,
  LocationData,
  ChooseLocationResult,
  OpenLocationPayload,
  OpenLocationResult,
  BiometricSupportResult,
  BiometricAuthPayload,
  BiometricAuthResult,
  ScanCodePayload,
  ScanCodeResult,
  GetNetworkTypeResult,
  UploadFilePayload,
  UploadFileResult,
  ShareSheetPayload,
  ShareSheetResult,
  ShareToStoryPayload,
  ChooseMediaPayload,
  ChooseMediaResult,
  PreviewImagePayload,
  AudioPlayPayload,
  AudioSeekPayload,
  AudioStateResult,
  ApmMetricsPayload,
  ApmSummaryResult,
  PushTokenResult,
  PushPermissionResult,
  PushNotificationPayload,
  BleScanResult,
  NfcTagResult,
  ContactResult,
  GeofencePayload,
  GeofenceRegionResult,
  GeofenceTransitionResult,
  Web3WalletAccountResult,
  Web3SignTransactionPayload,
  Web3SignedTransactionResult,
  InvoicePayload,
  InvoicePaymentResult,
  IapProductItem,
  BinaryPortPacketResult,
  BinaryPortReadResult,
  SslPinAuditResult,
  PermissionResult,
  AuthSettingResult,
  KeyboardInsetsResult,
  PredictiveBackProgressPayload,
  PredictiveBackResult,
  WasmSupportResult,
  SandboxHeadersAuditResult,
  BytecodePrecompileResult,
  BytecodeCacheStatsResult,
  FileChooserResult,
  BackNavigationResult,
  RenderLayerConfigResult,
  GestureScrollStateResult,
  PageStackResult,
  SubpackageLoadResult,
  NativeComponentDescriptorResult,
  ApiCapabilityResult,
  ProcessSandboxStatusResult,
  StartupBenchmarkReportResult,
  type GoatBridgeErrorDetails,
  type SetNavBarTitlePayload,
  type NavBarTitleResult,
  type SetNavBarColorPayload,
  type NavBarColorResult,
  type SetNavBarButtonsPayload,
  type NavBarButtonsResult,
  type SetNavBarProgressPayload,
  type NavBarProgressResult,
  type NavBarConfigPayload,
  type SetSheetSnapPointsPayload,
  type BottomSheetSnapPointsResult,
  type BottomSheetResult,
  type ImpactStyle,
  type NotificationHapticType,
  type HapticPreset,
  type HapticPayload,
  type HapticFeedbackResult,
  type SafeAreaInsetsResult,
  type CookieItem,
  type SetCookiePayload,
  type OpenExternalLinkPayload,
  type OpenExternalLinkResult,
  type ExternalLinkWarningEvent,
  type TabHandle,
  type TabOpenPayload,
  type TabOpenResult,
  type TabCloseResult,
  type TabSwitchResult,
  type TabListResult,
  type TabCloseAllResult,
  type RequestPermissionOptions,
  type OpenMiniAppPayload,
  type OpenMiniAppResult,
  type CloseMiniAppPayload,
  type CloseMiniAppResult,
  type MiniAppClosedEventData,
  type RequestPaymentPayload,
  type RequestPaymentResult,
  type QueryPaymentStatusPayload,
  type QueryPaymentStatusResult,
  type CancelPaymentPayload,
  type CancelPaymentResult,
  type DeviceMotionData,
  type StartDeviceMotionPayload,
  type FsWriteFilePayload,
  type FsWriteFileResult,
  type FsReadFilePayload,
  type FsReadFileResult,
  type FsListDirPayload,
  type FsListDirResult,
  type FsStatPayload,
  type FsStatResult,
  type FsDeleteFilePayload,
  type FsDeleteFileResult,
  type FsMkdirPayload,
  type FsMkdirResult
} from './types';

declare global {
  interface Window {
    GoatBridge?: GoatBridge;
    goatBridge?: GoatBridge;
    nativeBridge?: {
      postMessage: (message: string) => void;
      addEventListener?: (type: string, listener: (event: MessageEvent) => void) => void;
      removeEventListener?: (type: string, listener: (event: MessageEvent) => void) => void;
    };
  }
}

/**
 * Structured error class representing bridge failures, timeouts, and native exceptions.
 */
export class GoatBridgeError extends Error {
  public readonly code: string;
  public readonly details?: GoatBridgeErrorDetails;

  constructor(code: string, message: string, details?: GoatBridgeErrorDetails) {
    super(message);
    this.name = 'GoatBridgeError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, GoatBridgeError.prototype);
  }

  public toJSON(): { name: string; code: string; message: string; details?: GoatBridgeErrorDetails; stack?: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack
    };
  }
}

export class GoatBridge {
  private pendingRequests = new Map<
    string,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      timer: ReturnType<typeof setTimeout>;
      action: string;
      payload?: any;
    }
  >();

  private logListeners: Array<(entry: BridgeLogEntry) => void> = [];
  private memoryStorage = new Map<string, string>();
  private memorySecureStorage = new Map<string, string>();
  private memoryFs = new Map<string, { data: string; sizeBytes: number; isDirectory: boolean; lastModified: number }>();
  private motionTimer: any = null;
  private eventListeners = new Map<string, Set<(payload: any) => void>>();
  private readonly mockNative: boolean;
  private nativeBridgeMessageListenerAttached = false;
  private bridgeAttachWatcher: ReturnType<typeof setInterval> | null = null;
  private readonly pendingBridgeQueue: Array<{
    id: string;
    request: BridgeRequest;
  }> = [];

  constructor(options: { mockNative?: boolean } = {}) {
    this.mockNative = options.mockNative === true || typeof window === 'undefined';
    this.initNativeListener();
    if (typeof window !== 'undefined') {
      (window as any).GoatBridge = this;
      (window as any).goatBridge = this;
    }
  }

  public on(event: string, handler: (payload: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  public emit(event: string, payload: any): void {
    this.eventListeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    });
  }

  private initNativeListener(): void {
    if (typeof window === 'undefined') return;

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('native_call', (event: any) => {
        try {
          const detail = event?.detail || {};
          if (detail.action) {
            this.emit(detail.action, detail.payload || {});
            this.emit('message', detail);
          }
        } catch (err: any) {
          console.error('[GoatBridge] Failed to dispatch native_call event:', err);
        }
      });
    }

    // WebViewCompat.addWebMessageListener injects a native object into window
    const bridgeObj = (window as any).nativeBridge;
    if (bridgeObj && typeof bridgeObj.addEventListener === 'function') {
      this.attachNativeBridgeListener(bridgeObj);
    } else if (this.mockNative) {
      console.info('[GoatBridge] Native bridge not detected (mock fallback mode active)');
    } else {
      console.info('[GoatBridge] Native bridge not detected (buffering requests until it attaches)');
    }
  }

  private attachNativeBridgeListener(bridgeObj: {
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  }): void {
    if (this.nativeBridgeMessageListenerAttached) return;
    this.nativeBridgeMessageListenerAttached = true;
    bridgeObj.addEventListener('message', (event: MessageEvent) => {
      try {
        const rawData = event.data;
        const response: BridgeResponse = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        this.emitLog({
          id: response.id,
          timestamp: new Date().toLocaleTimeString(),
          type: response.success ? 'res' : 'error',
          action: 'REPLY',
          details: response
        });

        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          if (response.success) {
            pending.resolve(response.data);
          } else {
            pending.reject(
              new GoatBridgeError(
                'NATIVE_EXECUTION_ERROR',
                response.error || 'Native bridge call failed',
                { action: pending.action, payload: pending.payload, originalError: response.error }
              )
            );
          }
          this.pendingRequests.delete(response.id);
        }
      } catch (err: any) {
        console.error('[GoatBridge] Failed to parse bridge reply message:', err);
      }
    });
  }

  private ensureBridgeAttachWatcher(): void {
    if (this.bridgeAttachWatcher) return;
    this.bridgeAttachWatcher = setInterval(() => {
      this.flushPendingBridgeQueue();
    }, 50);
  }

  private stopBridgeAttachWatcher(): void {
    if (this.bridgeAttachWatcher) {
      clearInterval(this.bridgeAttachWatcher);
      this.bridgeAttachWatcher = null;
    }
  }

  private flushPendingBridgeQueue(): void {
    const bridgeObj = typeof window !== 'undefined' ? (window as any).nativeBridge : undefined;
    if (!bridgeObj || typeof bridgeObj.postMessage !== 'function') {
      if (this.pendingBridgeQueue.length === 0) {
        this.stopBridgeAttachWatcher();
      }
      return;
    }

    this.attachNativeBridgeListener(bridgeObj);

    const queued = this.pendingBridgeQueue.splice(0, this.pendingBridgeQueue.length);
    for (const entry of queued) {
      if (!this.pendingRequests.has(entry.id)) continue;
      try {
        bridgeObj.postMessage(JSON.stringify(entry.request));
      } catch (err: any) {
        console.error('[GoatBridge] Failed to flush buffered bridge request:', err);
      }
    }
    this.stopBridgeAttachWatcher();
  }

  public isNative(): boolean {
    return typeof window !== 'undefined' && !!(window as any).nativeBridge;
  }

  public onLog(listener: (entry: BridgeLogEntry) => void): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  private emitLog(entry: BridgeLogEntry) {
    this.logListeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (e) {
        console.error('Log listener error:', e);
      }
    });
  }

  public callNative<T = unknown>(
    action: string,
    payload: Record<string, any> = {},
    timeoutMs: number = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          const queuedIndex = this.pendingBridgeQueue.findIndex((entry) => entry.id === id);
          if (queuedIndex !== -1) {
            this.pendingBridgeQueue.splice(queuedIndex, 1);
          }
          if (this.pendingBridgeQueue.length === 0) {
            this.stopBridgeAttachWatcher();
          }
          const timeoutErr = new GoatBridgeError(
            'TIMEOUT',
            `Native bridge call timeout for action '${action}' (${timeoutMs}ms)`,
            { action, payload }
          );
          this.emitLog({
            id,
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            action,
            details: { error: timeoutErr.message, code: timeoutErr.code }
          });
          reject(timeoutErr);
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer, action, payload });

      const request: BridgeRequest = { id, action, payload };
      const payloadString = JSON.stringify(request);

      this.emitLog({
        id,
        timestamp: new Date().toLocaleTimeString(),
        type: 'req',
        action,
        details: payload
      });

      const bridgeObj = typeof window !== 'undefined' ? (window as any).nativeBridge : undefined;
      if (bridgeObj && typeof bridgeObj.postMessage === 'function') {
        bridgeObj.postMessage(payloadString);
      } else if (this.mockNative) {
        // Fallback for local web browser development & unit testing
        this.mockNativeResponse(request);
      } else {
        this.pendingBridgeQueue.push({ id, request });
        this.ensureBridgeAttachWatcher();
      }
    });
  }

  private mockNativeResponse(request: BridgeRequest): void {
    setTimeout(() => {
      const pending = this.pendingRequests.get(request.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(request.id);

      let mockData: any = {};
      switch (request.action) {
        case 'GET_DEVICE_INFO':
          mockData = {
            model: 'Pixel 9 Pro (Simulated Goat)',
            manufacturer: 'Google',
            brand: 'google',
            platform: 'Android',
            androidVersion: '15 (VanillaIceCream)',
            sdkInt: 35,
            screenWidthDp: typeof window !== 'undefined' ? window.innerWidth : 390,
            screenHeightDp: typeof window !== 'undefined' ? window.innerHeight : 844,
            density: typeof window !== 'undefined' ? window.devicePixelRatio : 3.0,
            batteryLevel: 98,
            isCharging: true,
            isAlgorithmicDarkening: true,
            appVersion: '1.0.0-goat',
            installGuid: 'guid-mock-uuidv4-miniapp-web'
          };
          break;
        case 'HAPTIC_FEEDBACK': {
          const type = typeof request.payload === 'string' ? request.payload : (request.payload?.type || 'impact');
          const style = request.payload?.style || 'medium';
          const notificationType = request.payload?.notificationType;
          mockData = { status: 'vibrated', triggered: true, type, style, notificationType };
          break;
        }
        case 'SET_NAV_BAR_TITLE':
          mockData = {
            title: request.payload?.title || '',
            subtitle: request.payload?.subtitle || ''
          };
          break;
        case 'SET_NAV_BAR_COLOR':
          mockData = {
            backgroundColor: request.payload?.backgroundColor || '#0F172A',
            textColor: request.payload?.textColor || '#FFFFFF',
            isDark: !!request.payload?.isDark
          };
          break;
        case 'SET_NAV_BAR_BUTTONS':
          mockData = {
            left: request.payload?.left,
            right: request.payload?.right || []
          };
          break;
        case 'SET_NAV_BAR_PROGRESS':
          mockData = {
            visible: request.payload?.visible ?? true,
            progress: request.payload?.progress ?? 0
          };
          break;
        case 'EXPAND_BOTTOM_SHEET':
          mockData = {
            currentSnap: request.payload?.snapPoint ?? 0.9,
            sheetValue: 'EXPANDED',
            isDismissible: true,
            isExpanded: true,
            isCollapsed: false,
            isDismissed: false
          };
          break;
        case 'COLLAPSE_BOTTOM_SHEET':
          mockData = {
            currentSnap: 0.25,
            sheetValue: 'COLLAPSED',
            isDismissible: true,
            isExpanded: false,
            isCollapsed: true,
            isDismissed: false
          };
          break;
        case 'SET_SHEET_SNAP_POINTS':
          mockData = {
            snapPoints: request.payload?.snapPoints || [0.25, 0.5, 0.9],
            initialSnap: request.payload?.initialSnap ?? 0.5,
            isDismissible: request.payload?.isDismissible ?? true
          };
          break;
        case 'GET_SAFE_AREA_INSETS':
          mockData = {
            top: 48,
            bottom: 34,
            left: 0,
            right: 0,
            keyboardHeight: 0,
            totalBottom: 34
          };
          break;
        case 'COOKIE_SET':
          mockData = { success: true, count: 1 };
          break;
        case 'COOKIE_GET':
          mockData = { cookies: [] };
          break;
        case 'COOKIE_REMOVE':
          mockData = { success: true };
          break;
        case 'COOKIE_REMOVE_ALL':
          mockData = { success: true };
          break;
        case 'STORAGE_SET': {
          const key = `goat_${request.payload.key}`;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, request.payload.value);
          } else {
            this.memoryStorage.set(key, request.payload.value);
          }
          mockData = { saved: true, key: request.payload.key };
          break;
        }
        case 'STORAGE_GET': {
          const key = `goat_${request.payload.key}`;
          const val = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : this.memoryStorage.get(key) ?? null;
          mockData = { value: val };
          break;
        }
        case 'STORAGE_REMOVE': {
          const key = `goat_${request.payload.key}`;
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
          } else {
            this.memoryStorage.delete(key);
          }
          mockData = { removed: true };
          break;
        }
        case 'SECURE_STORAGE_SET': {
          const key = `goat_sec_${request.payload.key}`;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, request.payload.value);
          } else {
            this.memorySecureStorage.set(key, request.payload.value);
          }
          mockData = { saved: true, key: request.payload.key, appId: request.payload.appId || 'default' };
          break;
        }
        case 'SECURE_STORAGE_GET': {
          const key = `goat_sec_${request.payload.key}`;
          const secVal = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : this.memorySecureStorage.get(key) ?? null;
          mockData = { value: secVal, key: request.payload.key, appId: request.payload.appId || 'default' };
          break;
        }
        case 'SECURE_STORAGE_REMOVE': {
          const key = `goat_sec_${request.payload.key}`;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(key);
          } else {
            this.memorySecureStorage.delete(key);
          }
          mockData = { removed: true, key: request.payload.key, appId: request.payload.appId || 'default' };
          break;
        }
        case 'SECURE_STORAGE_CLEAR':
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
          } else {
            this.memorySecureStorage.clear();
          }
          mockData = { cleared: true, appId: request.payload?.appId || 'default' };
          break;
        case 'API_REQUEST':
          mockData = {
            status: 200,
            statusText: 'OK',
            durationMs: 38,
            data: { message: 'Goat Native HTTP Proxy Result', echo: request.payload }
          };
          break;
        case 'NAVIGATE_BACK':
          mockData = { handled: true };
          break;
        case 'SET_STATUS_BAR_THEME':
          mockData = { updated: true };
          break;
        case 'CLIPBOARD_SET':
          mockData = { copied: true };
          break;
        case 'DOWNLOAD_FILE':
          mockData = {
            downloadId: Math.floor(Math.random() * 10000),
            status: 'ENQUEUED',
            fileName: request.payload.fileName || 'downloaded_file'
          };
          break;
        case 'SHOW_TOAST':
          mockData = {
            shown: true,
            title: request.payload.title || 'Toast message',
            icon: request.payload.icon || 'none'
          };
          break;
        case 'HIDE_TOAST':
          mockData = { hidden: true };
          break;
        case 'SHOW_MODAL':
          mockData = {
            confirm: true,
            cancel: false,
            title: request.payload.title || '',
            content: request.payload.content || ''
          };
          break;
        case 'SHOW_ACTION_SHEET':
          mockData = {
            tapIndex: 0
          };
          break;
        case 'SHOW_LOADING':
          mockData = {
            shown: true,
            title: request.payload.title || 'Loading...'
          };
          break;
        case 'HIDE_LOADING':
          mockData = { hidden: true };
          break;
        case 'CAN_I_USE':
          mockData = {
            supported: true,
            action: request.payload.action
          };
          break;
        case 'SET_SCREEN_BRIGHTNESS':
          mockData = {
            value: Math.max(0, Math.min(1, request.payload.value ?? 0.5)),
            updated: true
          };
          break;
        case 'GET_SCREEN_BRIGHTNESS':
          mockData = {
            value: 0.8
          };
          break;
        case 'SET_KEEP_SCREEN_ON':
          mockData = {
            keepScreenOn: !!request.payload.keepScreenOn,
            updated: true
          };
          break;
        case 'MAKE_PHONE_CALL':
          mockData = {
            handled: true,
            phoneNumber: request.payload.phoneNumber
          };
          break;
        case 'SEND_SMS':
          mockData = {
            handled: true,
            phoneNumber: request.payload.phoneNumber
          };
          break;
        case 'START_ACCELEROMETER':
          mockData = {
            started: true,
            interval: request.payload.interval || 'normal'
          };
          break;
        case 'STOP_ACCELEROMETER':
          mockData = {
            stopped: true
          };
          break;
        case 'START_COMPASS':
          mockData = {
            started: true
          };
          break;
        case 'START_GYROSCOPE':
          mockData = {
            started: true
          };
          break;
        case 'START_DEVICE_MOTION': {
          if (!this.motionTimer) {
            let motionTick = 0;
            this.motionTimer = setInterval(() => {
              motionTick++;
              const alpha = (motionTick * 2) % 360;
              const beta = Math.sin(motionTick * 0.1) * 25;
              const gamma = Math.cos(motionTick * 0.1) * 20;
              const motionPayload: DeviceMotionData = {
                alpha,
                beta,
                gamma,
                acceleration: {
                  x: Number((Math.sin(motionTick * 0.2) * 1.5).toFixed(2)),
                  y: Number((Math.cos(motionTick * 0.2) * 1.2).toFixed(2)),
                  z: Number((9.81 + Math.sin(motionTick * 0.1) * 0.3).toFixed(2))
                },
                rotationRate: {
                  alpha: Number((Math.sin(motionTick * 0.1) * 5).toFixed(2)),
                  beta: Number((Math.cos(motionTick * 0.1) * 4).toFixed(2)),
                  gamma: Number((Math.sin(motionTick * 0.15) * 3).toFixed(2))
                },
                compassHeading: (360 - alpha) % 360,
                timestamp: Date.now()
              };
              this.emit('ON_DEVICE_MOTION_CHANGE', motionPayload);
              this.emit('onDeviceMotionChange', motionPayload);
            }, 100);
          }
          mockData = { started: true };
          break;
        }
        case 'STOP_DEVICE_MOTION': {
          if (this.motionTimer) {
            clearInterval(this.motionTimer);
            this.motionTimer = null;
          }
          mockData = { stopped: true };
          break;
        }
        case 'GET_LOCATION':
          mockData = {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 5.0,
            altitude: 15.2,
            speed: 0.0,
            heading: 90.0,
            verticalAccuracy: 5.0,
            horizontalAccuracy: 5.0
          };
          break;
        case 'CHOOSE_LOCATION':
          mockData = {
            name: 'San Francisco City Hall',
            address: '1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102',
            latitude: 37.7792,
            longitude: -122.4192
          };
          break;
        case 'OPEN_LOCATION':
          mockData = {
            opened: true,
            latitude: request.payload.latitude ?? 37.7749,
            longitude: request.payload.longitude ?? -122.4194
          };
          break;
        case 'CHECK_BIOMETRIC_SUPPORT':
          mockData = {
            supported: true,
            biometryType: 'fingerprint'
          };
          break;
        case 'BIOMETRIC_AUTH':
          mockData = {
            authenticated: true,
            token: 'mock_bio_token_88912'
          };
          break;
        case 'SCAN_CODE':
          mockData = {
            result: 'https://goat.io/scan/demo123',
            scanType: 'QR_CODE',
            charSet: 'UTF-8'
          };
          break;
        case 'GET_NETWORK_TYPE':
          mockData = {
            networkType: 'wifi',
            isConnected: true
          };
          break;
        case 'UPLOAD_FILE':
          mockData = {
            statusCode: 200,
            data: JSON.stringify({ url: 'https://cdn.example.com/uploaded/file_01.jpg', success: true })
          };
          break;
        case 'WEBSOCKET_CONNECT':
          mockData = { connected: true };
          break;
        case 'WEBSOCKET_SEND':
          mockData = { sent: true };
          break;
        case 'WEBSOCKET_CLOSE':
          mockData = { closed: true };
          break;
        case 'SHARE_SHEET':
          mockData = {
            shared: true,
            activityType: 'system.share'
          };
          break;
        case 'SHARE_TO_STORY':
          mockData = { shared: true };
          break;
        case 'CHOOSE_MEDIA':
          mockData = {
            tempFiles: [
              {
                tempFilePath: 'goat://fs/temp/media_photo_01.jpg',
                size: 1024 * 350,
                width: 1920,
                height: 1080,
                fileType: 'image'
              }
            ],
            type: 'image'
          };
          break;
        case 'PREVIEW_IMAGE':
          mockData = { previewed: true, count: request.payload?.urls?.length ?? 1 };
          break;
        case 'AUDIO_PLAY':
          mockData = { status: 'playing', src: request.payload?.src };
          break;
        case 'AUDIO_PAUSE':
          mockData = { status: 'paused' };
          break;
        case 'AUDIO_STOP':
          mockData = { status: 'stopped' };
          break;
        case 'AUDIO_SEEK':
          mockData = { status: 'seeked', currentTime: request.payload?.position ?? 0 };
          break;
        case 'REPORT_METRICS':
          mockData = { recorded: true, id: `mock_apm_${Date.now()}` };
          break;
        case 'GET_APM_METRICS':
          mockData = { totalReports: 12, avgFcpMs: 38.5, avgLcpMs: 420.0, avgBridgeLatencyMs: 0.9, totalSlaViolations: 0 };
          break;
        case 'PUSH_GET_TOKEN':
          mockData = { token: 'mock_fcm_token_web_preview', appId: 'miniapp-preview' };
          break;
        case 'PUSH_REQUEST_PERMISSION':
          mockData = { granted: true };
          break;
        case 'PUSH_SET_BADGE':
          mockData = { updated: true, count: request.payload?.count ?? 0 };
          break;
        case 'PUSH_SHOW_NOTIFICATION':
          mockData = { shown: true, title: request.payload?.title ?? '' };
          break;
        case 'BLE_START_SCAN':
          mockData = {
            isScanning: true,
            devices: [
              { deviceId: '00:11:22:33:44:55', name: 'Goat Beacon Demo', rssi: -55, isConnectable: true },
              { deviceId: 'AA:BB:CC:DD:EE:FF', name: 'Goat POS Terminal', rssi: -42, isConnectable: true }
            ]
          };
          break;
        case 'BLE_STOP_SCAN':
          mockData = { stopped: true };
          break;
        case 'BLE_CONNECT':
          mockData = { connected: true, deviceId: request.payload?.deviceId };
          break;
        case 'BLE_READ_CHARACTERISTIC':
          mockData = { deviceId: request.payload?.deviceId, characteristicUuid: request.payload?.characteristicUuid, value: '98%' };
          break;
        case 'BLE_WRITE_CHARACTERISTIC':
          mockData = { written: true, deviceId: request.payload?.deviceId, characteristicUuid: request.payload?.characteristicUuid };
          break;
        case 'NFC_READ_TAG':
          mockData = { type: 'text/plain', payload: 'https://goat.io/pay/demo', uri: 'https://goat.io/pay/demo' };
          break;
        case 'NFC_WRITE_TAG':
          mockData = { written: true, payload: request.payload?.payload };
          break;
        case 'CHOOSE_CONTACT':
          mockData = { name: 'Alex Johnson', phoneNumber: '+1-555-019-2834', email: 'alex.johnson@example.com' };
          break;
        case 'START_GEOFENCE':
          mockData = { started: true, geofenceId: request.payload?.geofenceId, radiusMeters: request.payload?.radiusMeters ?? 100 };
          break;
        case 'STOP_GEOFENCE':
          mockData = { stopped: true, geofenceId: request.payload?.geofenceId };
          break;
        case 'LIST_GEOFENCES':
          mockData = {
            geofences: [
              { geofenceId: 'geo_mock_1', latitude: 37.7749, longitude: -122.4194, radiusMeters: 200, transitionType: 'BOTH' }
            ]
          };
          break;
        case 'EVALUATE_GEOFENCE':
          mockData = { events: [{ geofenceId: 'geo_mock_1', transition: 'ENTER' }] };
          break;
        case 'WEB3_CONNECT_WALLET':
          mockData = {
            address: 'EQBvW8Z5huRRJ1S0-Wc03bM4WVOGp6mEIOpz3Sr4bM3_TON',
            publicKey: 'pub_secp256k1_mock',
            wallet: 'Tonkeeper',
            network: request.payload?.network ?? 'ton-mainnet',
            chainId: '-239'
          };
          break;
        case 'WEB3_SIGN_TRANSACTION':
          mockData = {
            signature: 'sig_ed25519_mock_tx_sig',
            txHash: '0xmock_tx_hash_123',
            network: 'ton-mainnet',
            from: 'EQBvW8Z5huRRJ1S0-Wc03bM4WVOGp6mEIOpz3Sr4bM3_TON'
          };
          break;
        case 'WEB3_DISCONNECT':
          mockData = { disconnected: true };
          break;
        case 'WEB3_GET_ACCOUNT':
          mockData = {
            connected: true,
            address: 'EQBvW8Z5huRRJ1S0-Wc03bM4WVOGp6mEIOpz3Sr4bM3_TON',
            wallet: 'Tonkeeper',
            network: 'ton-mainnet'
          };
          break;
        case 'OPEN_INVOICE':
          mockData = {
            status: 'PAID',
            invoiceSlug: request.payload?.invoiceSlug ?? 'inv_demo',
            transactionId: `tx_${Date.now()}`,
            amount: request.payload?.amount ?? 100,
            currency: request.payload?.currency ?? 'USD',
            signature: 'hmac_sha256_mock_sig'
          };
          break;
        case 'GET_PURCHASE_PRODUCTS':
          mockData = {
            products: [
              { productId: 'stars_100', title: '100 Stars', description: 'Credits', price: '$1.99', currency: 'USD', type: 'inapp' }
            ]
          };
          break;
        case 'REQUEST_PAYMENT': {
          const provider = request.payload?.provider || 'alipay';
          const intentId = request.payload?.intentId || `pi_goat_${Math.random().toString(36).substring(2, 10)}`;
          const amount = request.payload?.amount ?? 1500;
          const currency = request.payload?.currency || 'USD';
          const txHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
          mockData = {
            status: 'SUCCESS',
            intentId,
            transactionHandle: `txh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            txHash,
            amount,
            currency,
            provider,
            signature: `sig_ed25519_${Date.now()}`
          };
          break;
        }
        case 'QUERY_PAYMENT_STATUS': {
          const intentId = request.payload?.intentId || 'pi_goat_default';
          mockData = {
            status: 'SUCCEEDED',
            intentId,
            amount: request.payload?.amount ?? 1500,
            currency: request.payload?.currency || 'USD',
            provider: request.payload?.provider || 'alipay'
          };
          break;
        }
        case 'CANCEL_PAYMENT': {
          mockData = {
            cancelled: true,
            intentId: request.payload?.intentId || 'pi_goat_default'
          };
          break;
        }
        case 'FS_WRITE_FILE': {
          const filePath = request.payload?.filePath || '/data/file.txt';
          const data = request.payload?.data || '';
          const byteSize = typeof data === 'string' ? data.length : 0;
          this.memoryFs.set(filePath, {
            data,
            sizeBytes: byteSize,
            isDirectory: false,
            lastModified: Date.now()
          });
          mockData = {
            written: true,
            byteSize,
            filePath
          };
          break;
        }
        case 'FS_READ_FILE': {
          const filePath = request.payload?.filePath || '/data/file.txt';
          const entry = this.memoryFs.get(filePath);
          if (entry) {
            mockData = {
              data: entry.data,
              byteSize: entry.sizeBytes,
              filePath
            };
          } else {
            mockData = {
              data: `[Virtual Sandboxed Content for ${filePath}]`,
              byteSize: 36,
              filePath
            };
          }
          break;
        }
        case 'FS_LIST_DIR': {
          if (this.memoryFs.size === 0) {
            this.memoryFs.set('/vault/credentials.enc', {
              data: 'AES256:GCM:ENCRYPTED_SECRETS_BLOB',
              sizeBytes: 1024,
              isDirectory: false,
              lastModified: Date.now() - 3600000
            });
            this.memoryFs.set('/memos/field_audio_90214.wav', {
              data: 'RIFF_AUDIO_DATA_MOCK',
              sizeBytes: 24576,
              isDirectory: false,
              lastModified: Date.now() - 1800000
            });
            this.memoryFs.set('/audit/security_log.json', {
              data: '{"event": "AUTH_SUCCESS", "timestamp": ' + Date.now() + '}',
              sizeBytes: 512,
              isDirectory: false,
              lastModified: Date.now() - 600000
            });
          }

          const files: Array<{ name: string; isDirectory: boolean; sizeBytes: number; lastModified: number }> = [];
          this.memoryFs.forEach((v, k) => {
            files.push({
              name: k,
              isDirectory: v.isDirectory,
              sizeBytes: v.sizeBytes,
              lastModified: v.lastModified
            });
          });
          mockData = { files };
          break;
        }
        case 'FS_STAT': {
          const filePath = request.payload?.filePath || '/data/file.txt';
          const entry = this.memoryFs.get(filePath);
          if (entry) {
            mockData = {
              exists: true,
              sizeBytes: entry.sizeBytes,
              isDirectory: entry.isDirectory,
              lastModified: entry.lastModified
            };
          } else {
            mockData = {
              exists: true,
              sizeBytes: 1024,
              isDirectory: false,
              lastModified: Date.now()
            };
          }
          break;
        }
        case 'FS_DELETE_FILE':
        case 'FS_UNLINK': {
          const filePath = request.payload?.filePath || '';
          this.memoryFs.delete(filePath);
          mockData = { deleted: true, filePath };
          break;
        }
        case 'FS_MKDIR': {
          const dirPath = request.payload?.dirPath || '/new_dir';
          this.memoryFs.set(dirPath, {
            data: '',
            sizeBytes: 0,
            isDirectory: true,
            lastModified: Date.now()
          });
          mockData = { created: true, dirPath };
          break;
        }
        case 'CREATE_BINARY_PORT':
          mockData = { created: true, portId: request.payload?.portId };
          break;
        case 'POST_BINARY_MESSAGE':
          mockData = { posted: true, portId: request.payload?.portId, byteSize: 4, sequenceNumber: 1 };
          break;
        case 'READ_BINARY_MESSAGE':
          mockData = { portId: request.payload?.portId, dataBase64: 'AQIDBA==', byteSize: 4 };
          break;
        case 'CLOSE_BINARY_PORT':
          mockData = { closed: true, portId: request.payload?.portId };
          break;
        case 'VERIFY_SSL_PIN':
          mockData = { hostname: request.payload?.hostname, isPinned: true, isCertificateValid: true, auditStatus: 'SECURE' };
          break;
        case 'AUDIT_NETWORK_CERTIFICATE':
          mockData = { hostname: 'appassets.androidplatform.net', isPinned: true, isCertificateValid: true, auditStatus: 'SECURE' };
          break;
        case 'CHECK_PERMISSION':
          mockData = { scope: request.payload?.scope ?? 'scope.camera', granted: true };
          break;
        case 'REQUEST_PERMISSION':
          mockData = { scope: request.payload?.scope ?? 'scope.camera', granted: true, isDeclaredInManifest: true };
          break;
        case 'GET_SETTING':
        case 'OPEN_SETTING':
          mockData = {
            authSetting: {
              'scope.userInfo': true,
              'scope.userLocation': true,
              'scope.camera': true,
              'scope.record': true,
              'scope.writePhotosAlbum': true,
              'scope.bluetooth': true,
              'scope.contact': true
            }
          };
          break;
        case 'OPEN_EXTERNAL_LINK':
        case 'OPEN_URL':
        case 'OPEN_LINK':
          try {
            const urlStr = request.payload?.url || 'https://example.com';
            const parsedUrl = new URL(urlStr);
            mockData = { opened: true, destinationHost: parsedUrl.hostname };
          } catch {
            mockData = { opened: true, destinationHost: 'example.com' };
          }
          break;
        case 'TAB_OPEN':
          mockData = {
            tabId: 'mock-tab-' + Math.random().toString(36).substring(2, 9),
            appId: request.payload?.appId || 'default',
            initialRoute: request.payload?.initialRoute || '/',
            title: request.payload?.title || 'Mini-App',
            isBackgrounded: false,
            memoryTrimmed: false
          };
          break;
        case 'TAB_CLOSE':
          mockData = { closed: true, tabId: request.payload?.tabId || 'mock-tab' };
          break;
        case 'TAB_SWITCH':
          mockData = { switched: true, tabId: request.payload?.tabId || 'mock-tab' };
          break;
        case 'TAB_GET_ACTIVE':
          mockData = {
            tabId: 'mock-tab-active',
            appId: 'default',
            initialRoute: '/',
            title: 'Mini-App',
            isBackgrounded: false,
            memoryTrimmed: false
          };
          break;
        case 'TAB_LIST':
          mockData = { tabs: [] };
          break;
        case 'TAB_CLOSE_ALL':
          mockData = { closedAll: true };
          break;
        case 'OPEN_MINI_APP':
          mockData = {
            instanceId: 'inst_' + (request.payload?.targetAppId || 'default') + '_' + Math.random().toString(36).substring(2, 9),
            targetAppId: request.payload?.targetAppId || 'default',
            presentation: request.payload?.presentation || 'WINDOWED',
            status: 'OPENED'
          };
          break;
        case 'CLOSE_MINI_APP':
          mockData = {
            closed: true,
            instanceId: request.payload?.instanceId || 'inst_default'
          };
          break;
        case 'ON_MINI_APP_CLOSED':
          mockData = { registered: true };
          break;
        case 'AUTHORIZE':
          mockData = { scope: request.payload?.scope ?? 'scope.camera', granted: request.payload?.granted ?? true };
          break;
        case 'GET_KEYBOARD_INSETS':
        case 'SET_KEYBOARD_INSETS':
          mockData = {
            isVisible: (request.payload?.heightPx ?? 0) > 0,
            heightPx: request.payload?.heightPx ?? 0,
            durationMs: request.payload?.durationMs ?? 250,
            adjustedViewportBottomInset: request.payload?.heightPx ?? 0
          };
          break;
        case 'PREDICTIVE_BACK_PROGRESS':
          mockData = {
            progress: request.payload?.progress ?? 0.5,
            interpolatedScale: 0.95,
            interpolatedAlpha: 0.925,
            interpolatedTranslationX: 75.0
          };
          break;
        case 'PREDICTIVE_BACK_INVOKE':
          mockData = { action: 'COMMITTED', canGoBackInWebView: true, poppedRoute: false };
          break;
        case 'PREDICTIVE_BACK_CANCEL':
          mockData = { action: 'CANCELLED', canGoBackInWebView: true };
          break;
        case 'VALIDATE_WASM_SUPPORT':
          mockData = {
            wasmSupported: true,
            simdSupported: true,
            sharedArrayBufferSupported: true,
            threadsSupported: true,
            maxMemoryPages: 65536
          };
          break;
        case 'AUDIT_SANDBOX_HEADERS':
          mockData = {
            coopHeaderPresent: true,
            coepHeaderPresent: true,
            isIsolatedContext: true,
            status: 'CROSS_ORIGIN_ISOLATED'
          };
          break;
        case 'PRECOMPILE_BYTECODE':
          mockData = {
            appId: request.payload?.appId ?? 'default',
            isSuccess: true,
            compileDurationMs: 12,
            bytecodeSizeBytes: 24576,
            cachePath: '/data/user/0/com.goat.webview/cache/webview_code_cache/default/main.bundle.v8cache'
          };
          break;
        case 'IS_BYTECODE_WARM':
          mockData = { appId: request.payload?.appId ?? 'default', isWarm: true };
          break;
        case 'CLEAR_BYTECODE_CACHE':
          mockData = { appId: request.payload?.appId ?? 'default', cleared: true };
          break;
        case 'GET_BYTECODE_STATS':
          mockData = { totalCachedBundles: 1, totalCacheSizeBytes: 24576, isWarm: true };
          break;
        case 'CHOOSE_FILES':
          mockData = { isSuccess: true, selectedUris: request.payload?.uris ?? [], totalFiles: (request.payload?.uris ?? []).length, wasCancelled: false };
          break;
        case 'CANCEL_FILE_CHOOSER':
          mockData = { cancelled: true, isFileChooserActive: false };
          break;
        case 'CAN_GO_BACK':
          mockData = { canGoBack: true, currentRoute: '/dashboard' };
          break;
        case 'HANDLE_BACK_PRESS':
          mockData = { action: 'WEB_HISTORY_POP', canGoBack: true, currentHistoryIndex: 1, totalHistoryCount: 2, routePopped: '/dashboard' };
          break;
        case 'PUSH_HISTORY_STATE':
          mockData = { route: request.payload?.route ?? '/', historyIndex: 2, canGoBack: true };
          break;
        case 'GET_CURRENT_ROUTE':
          mockData = { currentRoute: '/' };
          break;
        case 'CONFIGURE_TRANSPARENCY':
        case 'GET_RENDER_LAYER_CONFIG':
          mockData = {
            isTransparent: request.payload?.isTransparent ?? true,
            backgroundColorHex: request.payload?.customBgHex ?? '#00000000',
            isHardwareAccelerated: true,
            isWhiteFlashPrevented: true
          };
          break;
        case 'SYNC_THEME_BACKGROUND':
          mockData = {
            isTransparent: true,
            backgroundColorHex: (request.payload?.isDark ?? false) ? '#FF121212' : '#FFFFFFFF',
            isWhiteFlashPrevented: true
          };
          break;
        case 'GESTURE_SCROLL_UPDATE':
          mockData = {
            isScrollBoundaryReached: (request.payload?.scrollY ?? 0) <= 0 || (request.payload?.scrollY ?? 0) >= (request.payload?.maxScrollY ?? 0),
            canParentIntercept: (request.payload?.scrollY ?? 0) <= 0,
            activeDirection: request.payload?.direction ?? 'VERTICAL',
            scrollOffsetPx: request.payload?.scrollY ?? 0,
            isFlingActive: false
          };
          break;
        case 'SHOULD_PARENT_INTERCEPT':
          mockData = { shouldIntercept: request.payload?.isOverscrollAllowed ?? false };
          break;
        case 'RESET_GESTURE_COORDINATOR':
          mockData = { reset: true };
          break;
        case 'NAV_PUSH':
        case 'NAV_POP':
        case 'NAV_POP_TO_ROOT':
        case 'NAV_REPLACE':
          mockData = {
            action: request.action,
            stackDepth: request.action === 'NAV_PUSH' ? 2 : 1,
            canPop: request.action === 'NAV_PUSH',
            activePage: { pageId: 'page_1', route: request.payload?.route ?? '/', title: request.payload?.title ?? '', isSuspended: false }
          };
          break;
        case 'GET_PAGE_STACK':
          mockData = {
            totalCount: 1,
            stack: [{ pageId: 'root', route: '/', title: 'Home', isSuspended: false }]
          };
          break;
        case 'LOAD_SUBPACKAGE':
          mockData = {
            appId: request.payload?.appId ?? 'default',
            subpackageName: request.payload?.subpackageName ?? 'subpkg',
            isSuccess: true,
            isCached: false,
            extractedPath: '/data/user/0/miniapp/subpackages/subpkg',
            byteSize: 2048
          };
          break;
        case 'IS_SUBPACKAGE_CACHED':
          mockData = { appId: request.payload?.appId ?? 'default', subpackageName: request.payload?.subpackageName ?? '', isCached: true };
          break;
        case 'CLEAR_SUBPACKAGE_CACHE':
          mockData = { cleared: true, appId: request.payload?.appId ?? 'default' };
          break;
        case 'GET_SUBPACKAGES':
          mockData = { appId: request.payload?.appId ?? 'default', subpackages: ['game', 'profile'] };
          break;
        case 'EMBED_NATIVE_VIEW':
          mockData = {
            componentId: request.payload?.componentId ?? 'comp_1',
            componentType: request.payload?.componentType ?? 'TEXTURE_VIEW',
            x: request.payload?.x ?? 0,
            y: request.payload?.y ?? 0,
            width: request.payload?.width ?? 360,
            height: request.payload?.height ?? 240,
            zIndex: request.payload?.zIndex ?? 0,
            isVisible: true
          };
          break;
        case 'UPDATE_NATIVE_VIEW_BOUNDS':
          mockData = { updated: true, componentId: request.payload?.componentId ?? 'comp_1' };
          break;
        case 'REMOVE_NATIVE_VIEW':
          mockData = { removed: true, componentId: request.payload?.componentId ?? 'comp_1' };
          break;
        case 'GET_ACTIVE_NATIVE_VIEWS':
          mockData = { totalActive: 1, views: [{ componentId: 'comp_1', componentType: 'TEXTURE_VIEW', zIndex: 0 }] };
          break;
        case 'GET_API_CAPABILITIES':
          mockData = {
            totalCapabilities: 10,
            capabilities: [{ actionName: 'BIOMETRIC_AUTH', category: 'SECURITY', isSupported: true }]
          };
          break;
        case 'REGISTER_CAPABILITY':
          mockData = { registered: true, actionName: request.payload?.actionName ?? '' };
          break;
        case 'GET_SANDBOX_PROCESS_STATUS':
          mockData = {
            pid: 12345,
            isAlive: true,
            isInitialized: true,
            activeAppId: 'app_test',
            isolatedProcessName: ':goat_miniapp_process'
          };
          break;
        case 'GET_STARTUP_BENCHMARK_REPORT':
          mockData = {
            coldStartTimeMs: 95,
            warmStartTimeMs: 12,
            memoryDeltaMb: 28.5,
            isColdBootWithinSla: true,
            isWarmBootWithinSla: true,
            isMemoryWithinSla: true,
            totalSamples: 1
          };
          break;
        case 'RECORD_STARTUP_BENCHMARK_SAMPLE':
          mockData = {
            recorded: true,
            coldStartTimeMs: request.payload?.coldStartTimeMs ?? 95,
            warmStartTimeMs: request.payload?.warmStartTimeMs ?? 12
          };
          break;
        default:
          mockData = { ok: true, action: request.action };
      }

      const response: BridgeResponse = {
        id: request.id,
        success: true,
        data: mockData
      };

      this.emitLog({
        id: request.id,
        timestamp: new Date().toLocaleTimeString(),
        type: 'res',
        action: request.action,
        details: response.data
      });

      pending.resolve(response.data);
    }, 30);
  }

  // --- High-Level Typed APIs ---

  public async getDeviceInfo(): Promise<DeviceInfo> {
    return this.callNative<DeviceInfo>('GET_DEVICE_INFO');
  }

  /**
   * Retrieves stable, install-scoped anonymous GUID (Task 10203 / R2 & R3).
   */
  public async getInstallGuid(): Promise<string> {
    const info = await this.getDeviceInfo();
    return info.installGuid || '';
  }


  public async triggerHaptic(options: HapticPayload | HapticType | HapticPreset): Promise<HapticFeedbackResult> {
    let payload: HapticPayload;
    if (typeof options === 'string') {
      payload = { type: options };
    } else {
      payload = options;
    }
    return this.callNative<HapticFeedbackResult>('HAPTIC_FEEDBACK', payload);
  }

  public async storageSet(key: string, value: string): Promise<boolean> {
    const res = await this.callNative<{ saved: boolean }>('STORAGE_SET', { key, value } as StorageSetPayload);
    return res?.saved ?? true;
  }

  public async setStorage(key: string, value: string): Promise<boolean> {
    return this.storageSet(key, value);
  }

  public async storageGet(key: string): Promise<string | null> {
    const res = await this.callNative<{ value: string | null }>('STORAGE_GET', { key } as StorageGetPayload);
    return res?.value ?? null;
  }

  public async getStorage(key: string): Promise<string | null> {
    return this.storageGet(key);
  }

  public async storageRemove(key: string): Promise<boolean> {
    const res = await this.callNative<{ removed: boolean }>('STORAGE_REMOVE', { key } as StorageRemovePayload);
    return res?.removed ?? true;
  }

  public async removeStorage(key: string): Promise<boolean> {
    return this.storageRemove(key);
  }

  public async getStorageInfo(): Promise<{ keys: string[]; currentSize: number }> {
    const keys: string[] = [];
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('goat_')) keys.push(k.replace('goat_', ''));
      }
    } else {
      for (const k of this.memoryStorage.keys()) {
        if (k.startsWith('goat_')) keys.push(k.replace('goat_', ''));
      }
    }
    return { keys, currentSize: keys.length };
  }

  /**
   * Persists sensitive key-value data using hardware Keystore AES-256-GCM encryption at rest (Task 10123).
   *
   * @param key - Sensitive key name.
   * @param value - Sensitive plaintext value to encrypt and store.
   * @param appId - Optional tenant appId partition.
   * @returns A promise resolving to true if encryption and write succeeded.
   */
  public async secureStorageSet(key: string, value: string, appId?: string): Promise<boolean> {
    const res = await this.callNative<{ saved: boolean }>('SECURE_STORAGE_SET', { key, value, appId } as SecureStorageSetPayload);
    return res?.saved ?? true;
  }

  /**
   * Retrieves and decrypts sensitive key-value data stored in hardware Keystore AES-256-GCM (Task 10123).
   *
   * @param key - Sensitive key name.
   * @param appId - Optional tenant appId partition.
   * @returns A promise resolving to the decrypted string value or null.
   */
  public async secureStorageGet(key: string, appId?: string): Promise<string | null> {
    const res = await this.callNative<{ value: string | null }>('SECURE_STORAGE_GET', { key, appId } as SecureStorageGetPayload);
    return res?.value ?? null;
  }

  /**
   * Removes an encrypted key-value entry from secure storage (Task 10123).
   *
   * @param key - Sensitive key name.
   * @param appId - Optional tenant appId partition.
   * @returns A promise resolving to true if removed.
   */
  public async secureStorageRemove(key: string, appId?: string): Promise<boolean> {
    const res = await this.callNative<{ removed: boolean }>('SECURE_STORAGE_REMOVE', { key, appId } as SecureStorageRemovePayload);
    return res?.removed ?? true;
  }

  /**
   * Clears all encrypted key-value entries in secure storage for the tenant (Task 10123).
   *
   * @param appId - Optional tenant appId partition.
   * @returns A promise resolving to true if cleared.
   */
  public async secureStorageClear(appId?: string): Promise<boolean> {
    const res = await this.callNative<{ cleared: boolean }>('SECURE_STORAGE_CLEAR', { appId } as SecureStorageClearPayload);
    return res?.cleared ?? true;
  }

  public async apiRequest(payload: ApiRequestPayload): Promise<ApiResponseData> {
    return this.callNative<ApiResponseData>('API_REQUEST', payload);
  }

  public async downloadFile(payload: { url: string; fileName?: string; title?: string }): Promise<{ downloadId: number; status: string; fileName: string }> {
    return this.callNative('DOWNLOAD_FILE', payload);
  }

  public async navigateBack(): Promise<boolean> {
    const res = await this.callNative<{ handled: boolean }>('NAVIGATE_BACK');
    return res?.handled ?? true;
  }

  public async setStatusBarTheme(isDark: boolean): Promise<boolean> {
    const res = await this.callNative<{ updated: boolean }>('SET_STATUS_BAR_THEME', { isDark });
    return res?.updated ?? true;
  }

  public async setClipboard(text: string): Promise<boolean> {
    const res = await this.callNative<{ copied: boolean }>('CLIPBOARD_SET', { text });
    return res?.copied ?? true;
  }

  /**
   * Displays a native HUD toast notification with optional icon and auto-dismiss duration.
   *
   * @param options - Toast display configuration options.
   * @returns A promise that resolves with the toast display status.
   *
   * @example
   * ```typescript
   * await bridge.showToast({ title: 'Profile Updated', icon: 'success', duration: 1500 });
   * ```
   */
  public async showToast(options: ShowToastPayload): Promise<ShowToastResult> {
    return this.callNative<ShowToastResult>('SHOW_TOAST', options);
  }

  /**
   * Dismisses any active native HUD toast notification.
   *
   * @returns A promise that resolves to true once dismissed.
   */
  public async hideToast(): Promise<boolean> {
    const res = await this.callNative<{ hidden: boolean }>('HIDE_TOAST');
    return res?.hidden ?? true;
  }

  /**
   * Displays a native theme-synchronized modal alert or confirmation dialog.
   *
   * @param options - Modal dialog configuration options.
   * @returns A promise resolving to user choice `{ confirm: boolean, cancel: boolean }`.
   *
   * @example
   * ```typescript
   * const result = await bridge.showModal({
   *   title: 'Delete Item?',
   *   content: 'This action cannot be undone.',
   *   showCancel: true,
   *   confirmText: 'Delete',
   *   confirmColor: '#EF4444'
   * });
   * if (result.confirm) {
   *   console.log('User confirmed deletion');
   * }
   * ```
   */
  public async showModal(options: ShowModalPayload): Promise<ShowModalResult> {
    return this.callNative<ShowModalResult>('SHOW_MODAL', options);
  }

  /**
   * Displays a native bottom action sheet with selectable items.
   *
   * @param options - Action sheet options with item labels.
   * @returns A promise resolving to `{ tapIndex: number }` indicating tapped item index.
   *
   * @example
   * ```typescript
   * const res = await bridge.showActionSheet({ itemList: ['Photo Library', 'Camera', 'Cancel'] });
   * console.log('Selected index:', res.tapIndex);
   * ```
   */
  public async showActionSheet(options: ShowActionSheetPayload): Promise<ShowActionSheetResult> {
    return this.callNative<ShowActionSheetResult>('SHOW_ACTION_SHEET', options);
  }

  /**
   * Displays a native loading HUD overlay.
   *
   * @param options - Optional loading title and touch mask configuration.
   * @returns A promise that resolves with the loading HUD status.
   */
  public async showLoading(options: ShowLoadingPayload = { title: 'Loading...' }): Promise<LoadingResult> {
    return this.callNative<LoadingResult>('SHOW_LOADING', options);
  }

  /**
   * Hides the active native loading HUD overlay.
   *
   * @returns A promise that resolves to true once hidden.
   */
  public async hideLoading(): Promise<boolean> {
    const res = await this.callNative<{ hidden: boolean }>('HIDE_LOADING');
    return res?.hidden ?? true;
  }

  /**
   * Dynamically queries whether a native bridge action capability is supported by the host.
   *
   * @param action - The UPPER_SNAKE_CASE action identifier (e.g., `SHOW_TOAST`, `STORAGE_SET`).
   * @returns A promise resolving to true if supported, false otherwise.
   *
   * @example
   * ```typescript
   * if (await bridge.canIUse('BIOMETRIC_AUTH')) {
   *   // Call biometric auth
   * }
   * ```
   */
  public async canIUse(action: string): Promise<boolean> {
    try {
      const res = await this.callNative<CanIUseResult>('CAN_I_USE', { action });
      return res?.supported ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Sets screen brightness clamped between 0.0 (dimmest) and 1.0 (brightest).
   *
   * @param value - Target screen brightness float (0.0 - 1.0).
   * @returns A promise resolving to the updated brightness result.
   *
   * @example
   * ```typescript
   * await bridge.setScreenBrightness(0.85);
   * ```
   */
  public async setScreenBrightness(value: number): Promise<BrightnessResult> {
    return this.callNative<BrightnessResult>('SET_SCREEN_BRIGHTNESS', { value });
  }

  /**
   * Retrieves the current screen brightness level (0.0 - 1.0).
   *
   * @returns A promise resolving to the screen brightness value.
   */
  public async getScreenBrightness(): Promise<number> {
    const res = await this.callNative<BrightnessResult>('GET_SCREEN_BRIGHTNESS');
    return res?.value ?? 0.8;
  }

  /**
   * Toggles whether the device screen remains permanently awake while this mini-app is active.
   *
   * @param keepScreenOn - Boolean flag to keep screen on.
   * @returns A promise resolving to true if applied.
   */
  public async setKeepScreenOn(keepScreenOn: boolean): Promise<boolean> {
    const res = await this.callNative<KeepScreenOnResult>('SET_KEEP_SCREEN_ON', { keepScreenOn });
    return res?.updated ?? true;
  }

  /**
   * Triggers the native system dialer with pre-filled phone number for user confirmation.
   *
   * @param options - Destination phone number string or MakePhoneCallPayload.
   * @returns A promise resolving to the telephony status.
   *
   * @example
   * ```typescript
   * await bridge.makePhoneCall('18005550199');
   * ```
   */
  public async makePhoneCall(options: string | MakePhoneCallPayload): Promise<TelephonyResult> {
    const payload = typeof options === 'string' ? { phoneNumber: options } : options;
    return this.callNative<TelephonyResult>('MAKE_PHONE_CALL', payload);
  }

  /**
   * Launches native SMS messaging composer with pre-filled phone number and optional message body.
   *
   * @param options - Recipient phone number string or SendSmsPayload.
   * @param body - Optional pre-filled text body (when options is string).
   * @returns A promise resolving to the telephony status.
   */
  public async sendSms(options: string | SendSmsPayload, body: string = ''): Promise<TelephonyResult> {
    const payload = typeof options === 'string' ? { phoneNumber: options, body } : options;
    return this.callNative<TelephonyResult>('SEND_SMS', payload);
  }

  /**
   * Subscribes to hardware Accelerometer sensor stream with 20Hz rate limiting (Pillar 3).
   *
   * @param options - Sensor interval configuration ('game' | 'ui' | 'normal').
   * @returns A promise resolving to true when started.
   */
  public async startAccelerometer(options: StartSensorPayload = { interval: 'normal' }): Promise<boolean> {
    const res = await this.callNative<{ started: boolean }>('START_ACCELEROMETER', options);
    return res?.started ?? true;
  }

  /**
   * Unsubscribes from hardware Accelerometer sensor stream.
   *
   * @returns A promise resolving to true when stopped.
   */
  public async stopAccelerometer(): Promise<boolean> {
    const res = await this.callNative<{ stopped: boolean }>('STOP_ACCELEROMETER');
    return res?.stopped ?? true;
  }

  /**
   * Starts hardware Compass sensor stream with 20Hz rate limiting.
   */
  public async startCompass(): Promise<boolean> {
    const res = await this.callNative<{ started: boolean }>('START_COMPASS');
    return res?.started ?? true;
  }

  /**
   * Starts hardware Gyroscope sensor stream with 20Hz rate limiting.
   */
  public async startGyroscope(): Promise<boolean> {
    const res = await this.callNative<{ started: boolean }>('START_GYROSCOPE');
    return res?.started ?? true;
  }

  /**
   * Obtains high-precision device geographic coordinates via GPS/Fused Location Provider.
   *
   * @param options - Coordinate system ('wgs84' | 'gcj02') and high-accuracy options.
   * @returns A promise resolving to precise LocationData.
   *
   * @example
   * ```typescript
   * const loc = await bridge.getLocation({ type: 'gcj02', highAccuracy: true });
   * console.log(`Lat: ${loc.latitude}, Lng: ${loc.longitude}, Accuracy: ${loc.accuracy}m`);
   * ```
   */
  public async getLocation(options: GetLocationPayload = { type: 'wgs84', highAccuracy: true }): Promise<LocationData> {
    return this.callNative<LocationData>('GET_LOCATION', options);
  }

  /**
   * Opens an interactive native map location picker UI for the user to search and choose a destination.
   *
   * @returns A promise resolving to the selected place name, address, and coordinates.
   */
  public async chooseLocation(): Promise<ChooseLocationResult> {
    return this.callNative<ChooseLocationResult>('CHOOSE_LOCATION');
  }

  /**
   * Opens native maps (Google Maps, Apple Maps) for turn-by-turn navigation or point of interest viewing.
   *
   * @param options - Target coordinate point and descriptive location name.
   * @returns A promise resolving to true once map application is launched.
   *
   * @example
   * ```typescript
   * await bridge.openLocation({
   *   latitude: 37.7749,
   *   longitude: -122.4194,
   *   name: 'Headquarters',
   *   address: 'Market St, San Francisco'
   * });
   * ```
   */
  public async openLocation(options: OpenLocationPayload): Promise<OpenLocationResult> {
    return this.callNative<OpenLocationResult>('OPEN_LOCATION', options);
  }

  /**
   * Checks if biometric hardware (Fingerprint, FaceID) is supported and enrolled on the device (Task 10103).
   *
   * @returns A promise resolving to BiometricSupportResult.
   */
  public async checkBiometricSupport(): Promise<BiometricSupportResult> {
    return this.callNative<BiometricSupportResult>('CHECK_BIOMETRIC_SUPPORT');
  }

  /**
   * Prompts user with native Biometric Authentication prompt (Task 10103).
   *
   * @param options - Optional custom title, subtitle, and negative button label.
   * @returns A promise resolving to BiometricAuthResult.
   *
   * @example
   * ```typescript
   * const auth = await bridge.authenticateBiometric({ title: 'Confirm Payment', subtitle: '$29.99' });
   * if (auth.authenticated) {
   *   console.log('Biometric confirmed!');
   * }
   * ```
   */
  public async authenticateBiometric(options: BiometricAuthPayload = {}): Promise<BiometricAuthResult> {
    return this.callNative<BiometricAuthResult>('BIOMETRIC_AUTH', options);
  }

  /**
   * Launches native camera code scanner (QR Code, Barcode, Data Matrix) (Task 10103).
   *
   * @param options - Optional scan types filter.
   * @returns A promise resolving to ScanCodeResult containing decoded string.
   *
   * @example
   * ```typescript
   * const scan = await bridge.scanCode({ scanType: ['QR_CODE'] });
   * console.log('Scanned payload:', scan.result);
   * ```
   */
  public async scanCode(options: ScanCodePayload = {}): Promise<ScanCodeResult> {
    return this.callNative<ScanCodeResult>('SCAN_CODE', options);
  }

  /**
   * Retrieves active network connection telemetry (WiFi, 5G, 4G, 3G, 2G, None) (Task 10110).
   *
   * @returns A promise resolving to GetNetworkTypeResult.
   */
  public async getNetworkType(): Promise<GetNetworkTypeResult> {
    return this.callNative<GetNetworkTypeResult>('GET_NETWORK_TYPE');
  }

  /**
   * Uploads local file via background multipart streaming (Task 10110).
   *
   * @param options - Target server URL, file path, and optional form data.
   * @returns A promise resolving to server response statusCode and data string.
   */
  public async uploadFile(options: UploadFilePayload): Promise<UploadFileResult> {
    return this.callNative<UploadFileResult>('UPLOAD_FILE', options);
  }

  /**
   * Launches system native share sheet for links, text, and media (Task 10128).
   *
   * @param options - Title, text, url, or local media path to share.
   * @returns A promise resolving to ShareSheetResult.
   *
   * @example
   * ```typescript
   * await bridge.shareSheet({ title: 'Goat WebView', url: 'https://goat.io', text: 'Ultra Fast Mini-Apps' });
   * ```
   */
  public async shareSheet(options: ShareSheetPayload): Promise<ShareSheetResult> {
    return this.callNative<ShareSheetResult>('SHARE_SHEET', options);
  }

  /**
   * Shares image or video directly to social stories (Instagram, Telegram, WhatsApp) (Task 10128).
   *
   * @param options - Media path and story background gradient colors.
   * @returns A promise resolving to true once story intent is dispatched.
   */
  public async shareToStory(options: ShareToStoryPayload): Promise<boolean> {
    const res = await this.callNative<{ shared: boolean }>('SHARE_TO_STORY', options);
    return res?.shared ?? true;
  }

  /**
   * Opens native camera/album photo & video picker with compression (Task 10106).
   *
   * @param options - Media selection constraints (count, mediaType, sourceType, maxDuration).
   * @returns A promise resolving to ChooseMediaResult containing local virtual URIs and metadata.
   *
   * @example
   * ```typescript
   * const media = await bridge.chooseMedia({ count: 1, mediaType: ['image'] });
   * console.log('Picked media:', media.tempFiles[0].tempFilePath);
   * ```
   */
  public async chooseMedia(options: ChooseMediaPayload = {}): Promise<ChooseMediaResult> {
    return this.callNative<ChooseMediaResult>('CHOOSE_MEDIA', options);
  }

  /**
   * Launches native gesture-zoomable fullscreen image previewer (Task 10106).
   *
   * @param options - List of HTTP/local image URLs and initial active index.
   * @returns A promise resolving to true once previewer is launched.
   */
  public async previewImage(options: PreviewImagePayload): Promise<boolean> {
    const res = await this.callNative<{ previewed: boolean }>('PREVIEW_IMAGE', options);
    return res?.previewed ?? true;
  }

  /**
   * Starts background audio playback with system media notification controls (Task 10106).
   *
   * @param options - Audio track URL and metadata (title, singer, coverImgUrl).
   * @returns A promise resolving to AudioStateResult.
   */
  public async playAudio(options: AudioPlayPayload): Promise<AudioStateResult> {
    return this.callNative<AudioStateResult>('AUDIO_PLAY', options);
  }

  /**
   * Pauses active background audio playback (Task 10106).
   */
  public async pauseAudio(): Promise<AudioStateResult> {
    return this.callNative<AudioStateResult>('AUDIO_PAUSE');
  }

  /**
   * Stops active background audio playback (Task 10106).
   */
  public async stopAudio(): Promise<AudioStateResult> {
    return this.callNative<AudioStateResult>('AUDIO_STOP');
  }

  /**
   * Seeks audio track to specific time offset in seconds (Task 10106).
   */
  public async seekAudio(options: AudioSeekPayload): Promise<AudioStateResult> {
    return this.callNative<AudioStateResult>('AUDIO_SEEK', options);
  }

  /**
   * Ingests Core Web Vitals and bridge latency telemetry (Task 10124).
   */
  public async reportMetrics(metrics: ApmMetricsPayload): Promise<{ recorded: boolean; id: string }> {
    return this.callNative<{ recorded: boolean; id: string }>('REPORT_METRICS', metrics);
  }

  /**
   * Retrieves aggregated APM summary statistics (Task 10124).
   */
  public async getApmMetrics(): Promise<ApmSummaryResult> {
    return this.callNative<ApmSummaryResult>('GET_APM_METRICS');
  }

  /**
   * Retrieves device push notification token (Task 10127).
   */
  public async getPushToken(): Promise<PushTokenResult> {
    return this.callNative<PushTokenResult>('PUSH_GET_TOKEN');
  }

  /**
   * Requests runtime permission for push notifications (Task 10127).
   */
  public async requestPushPermission(): Promise<PushPermissionResult> {
    return this.callNative<PushPermissionResult>('PUSH_REQUEST_PERMISSION');
  }

  /**
   * Updates application icon badge count (Task 10127).
   */
  public async setPushBadge(count: number): Promise<boolean> {
    const res = await this.callNative<{ updated: boolean }>('PUSH_SET_BADGE', { count });
    return res?.updated ?? true;
  }

  /**
   * Displays local push notification banner (Task 10127).
   */
  public async showPushNotification(options: PushNotificationPayload): Promise<boolean> {
    const res = await this.callNative<{ shown: boolean }>('PUSH_SHOW_NOTIFICATION', options);
    return res?.shown ?? true;
  }

  /**
   * Starts Bluetooth Low Energy peripheral discovery (Task 10108).
   */
  public async startBleScan(timeoutMs: number = 10000): Promise<BleScanResult> {
    return this.callNative<BleScanResult>('BLE_START_SCAN', { timeoutMs });
  }

  /**
   * Stops Bluetooth Low Energy peripheral scanning (Task 10108).
   */
  public async stopBleScan(): Promise<boolean> {
    const res = await this.callNative<{ stopped: boolean }>('BLE_STOP_SCAN');
    return res?.stopped ?? true;
  }

  /**
   * Connects to a remote BLE GATT peripheral (Task 10108).
   */
  public async connectBle(deviceId: string): Promise<boolean> {
    const res = await this.callNative<{ connected: boolean }>('BLE_CONNECT', { deviceId });
    return res?.connected ?? true;
  }

  /**
   * Reads a BLE GATT characteristic (Task 10108).
   */
  public async readBleCharacteristic(deviceId: string, characteristicUuid: string): Promise<string | null> {
    const res = await this.callNative<{ value: string | null }>('BLE_READ_CHARACTERISTIC', { deviceId, characteristicUuid });
    return res?.value ?? null;
  }

  /**
   * Writes a BLE GATT characteristic (Task 10108).
   */
  public async writeBleCharacteristic(deviceId: string, characteristicUuid: string, value: string): Promise<boolean> {
    const res = await this.callNative<{ written: boolean }>('BLE_WRITE_CHARACTERISTIC', { deviceId, characteristicUuid, value });
    return res?.written ?? true;
  }

  /**
   * Reads an NFC NDEF tag message (Task 10108).
   */
  public async readNfcTag(): Promise<NfcTagResult> {
    return this.callNative<NfcTagResult>('NFC_READ_TAG');
  }

  /**
   * Writes an NDEF record to an NFC tag (Task 10108).
   */
  public async writeNfcTag(payload: string): Promise<boolean> {
    const res = await this.callNative<{ written: boolean }>('NFC_WRITE_TAG', { payload });
    return res?.written ?? true;
  }

  /**
   * Securely picks a contact from address book (Task 10129).
   */
  public async chooseContact(): Promise<ContactResult> {
    return this.callNative<ContactResult>('CHOOSE_CONTACT');
  }

  /**
   * Starts a background geofence (Task 10129).
   */
  public async startGeofence(options: GeofencePayload): Promise<boolean> {
    const res = await this.callNative<{ started: boolean }>('START_GEOFENCE', options as unknown as Record<string, unknown>);
    return res?.started ?? true;
  }

  /**
   * Stops an active geofence (Task 10129).
   */
  public async stopGeofence(geofenceId: string): Promise<boolean> {
    const res = await this.callNative<{ stopped: boolean }>('STOP_GEOFENCE', { geofenceId });
    return res?.stopped ?? true;
  }

  /**
   * Lists all active geofences (Task 10129).
   */
  public async listGeofences(): Promise<GeofenceRegionResult[]> {
    const res = await this.callNative<{ geofences: GeofenceRegionResult[] }>('LIST_GEOFENCES');
    return res?.geofences ?? [];
  }

  /**
   * Evaluates a coordinate against active geofences (Task 10129).
   */
  public async evaluateGeofence(latitude: number, longitude: number): Promise<GeofenceTransitionResult> {
    return this.callNative<GeofenceTransitionResult>('EVALUATE_GEOFENCE', { latitude, longitude });
  }

  /**
   * Connects to a Web3 wallet via TON Connect or EVM (Task 10120).
   */
  public async connectWeb3Wallet(network: string = 'ton-mainnet', manifestUrl?: string): Promise<Web3WalletAccountResult> {
    return this.callNative<Web3WalletAccountResult>('WEB3_CONNECT_WALLET', { network, manifestUrl });
  }

  /**
   * Signs a Web3 transaction (Task 10120).
   */
  public async signWeb3Transaction(options: Web3SignTransactionPayload): Promise<Web3SignedTransactionResult> {
    return this.callNative<Web3SignedTransactionResult>('WEB3_SIGN_TRANSACTION', options as unknown as Record<string, unknown>);
  }

  /**
   * Disconnects active Web3 wallet session (Task 10120).
   */
  public async disconnectWeb3Wallet(): Promise<boolean> {
    const res = await this.callNative<{ disconnected: boolean }>('WEB3_DISCONNECT');
    return res?.disconnected ?? true;
  }

  /**
   * Retrieves active Web3 account (Task 10120).
   */
  public async getWeb3Account(): Promise<Web3WalletAccountResult | null> {
    return this.callNative<Web3WalletAccountResult | null>('WEB3_GET_ACCOUNT');
  }

  /**
   * Opens in-app digital checkout invoice sheet (Task 10121).
   */
  public async openInvoice(options: InvoicePayload): Promise<InvoicePaymentResult> {
    return this.callNative<InvoicePaymentResult>('OPEN_INVOICE', options as unknown as Record<string, unknown>);
  }

  /**
   * Retrieves in-app purchase product catalog (Task 10121).
   */
  public async getPurchaseProducts(productIds?: string[]): Promise<IapProductItem[]> {
    const res = await this.callNative<{ products: IapProductItem[] }>('GET_PURCHASE_PRODUCTS', { productIds });
    return res?.products ?? [];
  }

  /**
   * Restores active in-app purchases (Task 10121).
   */
  public async restorePurchases(): Promise<InvoicePaymentResult[]> {
    const res = await this.callNative<{ purchases: InvoicePaymentResult[] }>('RESTORE_PURCHASES');
    return res?.purchases ?? [];
  }

  /**
   * Creates a direct binary port channel (Task 10130).
   */
  public async createBinaryPort(portId: string): Promise<boolean> {
    const res = await this.callNative<{ created: boolean }>('CREATE_BINARY_PORT', { portId });
    return res?.created ?? true;
  }

  /**
   * Posts a binary message packet (Task 10130).
   */
  public async postBinaryMessage(portId: string, dataBase64: string): Promise<BinaryPortPacketResult> {
    return this.callNative<BinaryPortPacketResult>('POST_BINARY_MESSAGE', { portId, dataBase64 });
  }

  /**
   * Reads a binary message packet (Task 10130).
   */
  public async readBinaryMessage(portId: string): Promise<BinaryPortReadResult> {
    return this.callNative<BinaryPortReadResult>('READ_BINARY_MESSAGE', { portId });
  }

  /**
   * Closes a binary port channel (Task 10130).
   */
  public async closeBinaryPort(portId: string): Promise<boolean> {
    const res = await this.callNative<{ closed: boolean }>('CLOSE_BINARY_PORT', { portId });
    return res?.closed ?? true;
  }

  /**
   * Verifies an SSL public key SHA-256 pin (Task 10131).
   */
  public async verifySslPin(hostname: string, pinSha256: string): Promise<SslPinAuditResult> {
    return this.callNative<SslPinAuditResult>('VERIFY_SSL_PIN', { hostname, pinSha256 });
  }

  /**
   * Audits network certificate for security compliance (Task 10131).
   */
  public async auditNetworkCertificate(url: string): Promise<SslPinAuditResult> {
    return this.callNative<SslPinAuditResult>('AUDIT_NETWORK_CERTIFICATE', { url });
  }

  /**
   * Checks if a permission scope is granted (Task 10101).
   */
  public async checkPermission(scope: string, appId: string = 'default'): Promise<PermissionResult> {
    return this.callNative<PermissionResult>('CHECK_PERMISSION', { scope, appId });
  }

  /**
   * Requests authorization for a permission scope with two-stage rationale priming (Tasks 10101 & 10198).
   */
  public async requestPermission(
    scope: string,
    optionsOrAppId?: string | RequestPermissionOptions
  ): Promise<PermissionResult> {
    let payload: Record<string, any> = { scope };
    if (typeof optionsOrAppId === 'string') {
      payload.appId = optionsOrAppId;
    } else if (optionsOrAppId && typeof optionsOrAppId === 'object') {
      payload.appId = optionsOrAppId.appId || 'default';
      if (optionsOrAppId.rationale) {
        payload.rationale = optionsOrAppId.rationale;
      }
    } else {
      payload.appId = 'default';
    }
    return this.callNative<PermissionResult>('REQUEST_PERMISSION', payload);
  }

  /**
   * Retrieves all authorization settings for a mini-app (Task 10101).
   */
  public async getSetting(appId: string = 'default'): Promise<AuthSettingResult> {
    return this.callNative<AuthSettingResult>('GET_SETTING', { appId });
  }

  /**
   * Opens authorization settings modal (Task 10101).
   */
  public async openSetting(appId: string = 'default'): Promise<AuthSettingResult> {
    return this.callNative<AuthSettingResult>('OPEN_SETTING', { appId });
  }

  /**
   * Directly sets authorization status for a scope (Task 10101).
   */
  public async authorize(scope: string, granted: boolean = true, appId: string = 'default'): Promise<PermissionResult> {
    return this.callNative<PermissionResult>('AUTHORIZE', { scope, granted, appId });
  }

  /**
   * Gets current software keyboard insets state (Task 10068).
   */
  public async getKeyboardInsets(): Promise<KeyboardInsetsResult> {
    return this.callNative<KeyboardInsetsResult>('GET_KEYBOARD_INSETS');
  }

  /**
   * Updates or sets software keyboard insets (Task 10068).
   */
  public async setKeyboardInsets(heightPx: number, durationMs: number = 250): Promise<KeyboardInsetsResult> {
    return this.callNative<KeyboardInsetsResult>('SET_KEYBOARD_INSETS', { heightPx, durationMs });
  }

  /**
   * Updates predictive back gesture tracking progress (Task 10126).
   */
  public async predictiveBackProgress(options: PredictiveBackProgressPayload): Promise<PredictiveBackResult> {
    return this.callNative<PredictiveBackResult>('PREDICTIVE_BACK_PROGRESS', options as unknown as Record<string, unknown>);
  }

  /**
   * Commits predictive back navigation (Task 10126).
   */
  public async predictiveBackInvoke(): Promise<PredictiveBackResult> {
    return this.callNative<PredictiveBackResult>('PREDICTIVE_BACK_INVOKE');
  }

  /**
   * Cancels predictive back navigation (Task 10126).
   */
  public async predictiveBackCancel(): Promise<PredictiveBackResult> {
    return this.callNative<PredictiveBackResult>('PREDICTIVE_BACK_CANCEL');
  }

  /**
   * Validates WebAssembly SIMD and WebWorker capabilities (Task 10132).
   */
  public async validateWasmSupport(): Promise<WasmSupportResult> {
    return this.callNative<WasmSupportResult>('VALIDATE_WASM_SUPPORT');
  }

  /**
   * Audits sandbox isolation response headers (Task 10132).
   */
  public async auditSandboxHeaders(headers: Record<string, string>): Promise<SandboxHeadersAuditResult> {
    return this.callNative<SandboxHeadersAuditResult>('AUDIT_SANDBOX_HEADERS', { headers });
  }

  /**
   * Precompiles JavaScript bundle into V8 bytecode cache (Task 10084).
   */
  public async precompileBytecode(bundlePath: string, appId: string = 'default'): Promise<BytecodePrecompileResult> {
    return this.callNative<BytecodePrecompileResult>('PRECOMPILE_BYTECODE', { bundlePath, appId });
  }

  /**
   * Checks if V8 bytecode cache is warm (Task 10084).
   */
  public async isBytecodeWarm(appId: string = 'default'): Promise<{ appId: string; isWarm: boolean }> {
    return this.callNative<{ appId: string; isWarm: boolean }>('IS_BYTECODE_WARM', { appId });
  }

  /**
   * Clears persistent V8 bytecode cache (Task 10084).
   */
  public async clearBytecodeCache(appId: string = 'default'): Promise<{ appId: string; cleared: boolean }> {
    return this.callNative<{ appId: string; cleared: boolean }>('CLEAR_BYTECODE_CACHE', { appId });
  }

  /**
   * Retrieves global V8 bytecode cache statistics (Task 10084).
   */
  public async getBytecodeStats(): Promise<BytecodeCacheStatsResult> {
    return this.callNative<BytecodeCacheStatsResult>('GET_BYTECODE_STATS');
  }

  /**
   * Resolves active file chooser with selected URIs (Task 10076).
   */
  public async chooseFiles(uris: string[]): Promise<FileChooserResult> {
    return this.callNative<FileChooserResult>('CHOOSE_FILES', { uris });
  }

  /**
   * Cancels active file chooser interaction (Task 10076).
   */
  public async cancelFileChooser(): Promise<{ cancelled: boolean; isFileChooserActive: boolean }> {
    return this.callNative<{ cancelled: boolean; isFileChooserActive: boolean }>('CANCEL_FILE_CHOOSER');
  }

  /**
   * Checks if web history can rewind (Task 10094).
   */
  public async canGoBack(): Promise<{ canGoBack: boolean; currentRoute: string }> {
    return this.callNative<{ canGoBack: boolean; currentRoute: string }>('CAN_GO_BACK');
  }

  /**
   * Handles hardware back press or gesture pop (Task 10094).
   */
  public async handleBackPress(): Promise<BackNavigationResult> {
    return this.callNative<BackNavigationResult>('HANDLE_BACK_PRESS');
  }

  /**
   * Pushes a virtual route to history stack (Task 10094).
   */
  public async pushHistoryState(route: string): Promise<{ route: string; historyIndex: number; canGoBack: boolean }> {
    return this.callNative<{ route: string; historyIndex: number; canGoBack: boolean }>('PUSH_HISTORY_STATE', { route });
  }

  /**
   * Returns the current active route (Task 10094).
   */
  public async getCurrentRoute(): Promise<{ currentRoute: string }> {
    return this.callNative<{ currentRoute: string }>('GET_CURRENT_ROUTE');
  }

  /**
   * Configures canvas transparency and background color (Task 10113).
   */
  public async configureTransparency(isTransparent: boolean, customBgHex?: string): Promise<RenderLayerConfigResult> {
    return this.callNative<RenderLayerConfigResult>('CONFIGURE_TRANSPARENCY', { isTransparent, customBgHex });
  }

  /**
   * Synchronizes theme background to eliminate white flash (Task 10113).
   */
  public async syncThemeBackground(isDark: boolean): Promise<RenderLayerConfigResult> {
    return this.callNative<RenderLayerConfigResult>('SYNC_THEME_BACKGROUND', { isDark });
  }

  /**
   * Retrieves current render layer configuration (Task 10113).
   */
  public async getRenderLayerConfig(): Promise<RenderLayerConfigResult> {
    return this.callNative<RenderLayerConfigResult>('GET_RENDER_LAYER_CONFIG');
  }

  /**
   * Updates scroll boundary state (Task 10079).
   */
  public async updateGestureScroll(scrollY: number, maxScrollY: number, direction: string = 'VERTICAL'): Promise<GestureScrollStateResult> {
    return this.callNative<GestureScrollStateResult>('GESTURE_SCROLL_UPDATE', { scrollY, maxScrollY, direction });
  }

  /**
   * Checks if parent container can intercept touch (Task 10079).
   */
  public async shouldParentIntercept(deltaY: number, isOverscrollAllowed: boolean = false): Promise<{ shouldIntercept: boolean }> {
    return this.callNative<{ shouldIntercept: boolean }>('SHOULD_PARENT_INTERCEPT', { deltaY, isOverscrollAllowed });
  }

  /**
   * Resets gesture scroll coordinator (Task 10079).
   */
  public async resetGestureCoordinator(): Promise<{ reset: boolean }> {
    return this.callNative<{ reset: boolean }>('RESET_GESTURE_COORDINATOR');
  }

  /**
   * Pushes a page onto the multi-WebView stack (Task 10091).
   */
  public async navPush(route: string, title: string = ''): Promise<PageStackResult> {
    return this.callNative<PageStackResult>('NAV_PUSH', { route, title });
  }

  /**
   * Pops top page from stack (Task 10091).
   */
  public async navPop(): Promise<PageStackResult> {
    return this.callNative<PageStackResult>('NAV_POP');
  }

  /**
   * Pops all pages to root (Task 10091).
   */
  public async navPopToRoot(): Promise<PageStackResult> {
    return this.callNative<PageStackResult>('NAV_POP_TO_ROOT');
  }

  /**
   * Replaces top page on stack (Task 10091).
   */
  public async navReplace(route: string, title: string = ''): Promise<PageStackResult> {
    return this.callNative<PageStackResult>('NAV_REPLACE', { route, title });
  }

  /**
   * Retrieves full page stack (Task 10091).
   */
  public async getPageStack(): Promise<PageStackResult> {
    return this.callNative<PageStackResult>('GET_PAGE_STACK');
  }

  /**
   * Dynamically loads a subpackage module (Task 10092).
   */
  public async loadSubpackage(subpackageName: string, appId: string = 'default'): Promise<SubpackageLoadResult> {
    return this.callNative<SubpackageLoadResult>('LOAD_SUBPACKAGE', { subpackageName, appId });
  }

  /**
   * Checks if subpackage is cached (Task 10092).
   */
  public async isSubpackageCached(subpackageName: string, appId: string = 'default'): Promise<{ appId: string; subpackageName: string; isCached: boolean }> {
    return this.callNative<{ appId: string; subpackageName: string; isCached: boolean }>('IS_SUBPACKAGE_CACHED', { subpackageName, appId });
  }

  /**
   * Clears subpackage cache (Task 10092).
   */
  public async clearSubpackageCache(subpackageName?: string, appId: string = 'default'): Promise<{ cleared: boolean; appId: string }> {
    return this.callNative<{ cleared: boolean; appId: string }>('CLEAR_SUBPACKAGE_CACHE', { subpackageName, appId });
  }

  /**
   * Returns subpackages loaded for an application (Task 10092).
   */
  public async getSubpackages(appId: string = 'default'): Promise<{ appId: string; subpackages: string[] }> {
    return this.callNative<{ appId: string; subpackages: string[] }>('GET_SUBPACKAGES', { appId });
  }

  /**
   * Embeds a same-layer native component (Task 10100).
   */
  public async embedNativeView(
    componentId: string,
    componentType: string,
    options?: { x?: number; y?: number; width?: number; height?: number; zIndex?: number }
  ): Promise<NativeComponentDescriptorResult> {
    return this.callNative<NativeComponentDescriptorResult>('EMBED_NATIVE_VIEW', {
      componentId,
      componentType,
      x: options?.x ?? 0,
      y: options?.y ?? 0,
      width: options?.width ?? 360,
      height: options?.height ?? 240,
      zIndex: options?.zIndex ?? 0
    });
  }

  /**
   * Updates same-layer native component bounds (Task 10100).
   */
  public async updateNativeViewBounds(
    componentId: string,
    options: { x?: number; y?: number; width?: number; height?: number; zIndex?: number; isVisible?: boolean }
  ): Promise<{ updated: boolean; componentId: string }> {
    return this.callNative<{ updated: boolean; componentId: string }>('UPDATE_NATIVE_VIEW_BOUNDS', {
      componentId,
      ...options
    });
  }

  /**
   * Removes an embedded native component (Task 10100).
   */
  public async removeNativeView(componentId: string): Promise<{ removed: boolean; componentId: string }> {
    return this.callNative<{ removed: boolean; componentId: string }>('REMOVE_NATIVE_VIEW', { componentId });
  }

  /**
   * Returns all active native components (Task 10100).
   */
  public async getActiveNativeViews(): Promise<{ totalActive: number; views: NativeComponentDescriptorResult[] }> {
    return this.callNative<{ totalActive: number; views: NativeComponentDescriptorResult[] }>('GET_ACTIVE_NATIVE_VIEWS');
  }

  /**
   * Retrieves API capabilities (Task 10102).
   */
  public async getApiCapabilities(category?: string): Promise<{ totalCapabilities: number; capabilities: ApiCapabilityResult[] }> {
    return this.callNative<{ totalCapabilities: number; capabilities: ApiCapabilityResult[] }>('GET_API_CAPABILITIES', { category });
  }

  /**
   * Dynamically registers capability (Task 10102).
   */
  public async registerCapability(actionName: string, category: string = 'CUSTOM', isSupported: boolean = true): Promise<{ registered: boolean; actionName: string }> {
    return this.callNative<{ registered: boolean; actionName: string }>('REGISTER_CAPABILITY', { actionName, category, isSupported });
  }

  /**
   * Retrieves isolated sub-process sandbox status (Task 10090).
   */
  public async getSandboxProcessStatus(): Promise<ProcessSandboxStatusResult> {
    return this.callNative<ProcessSandboxStatusResult>('GET_SANDBOX_PROCESS_STATUS');
  }

  /**
   * Retrieves startup Macrobenchmark SLA compliance report (Task 10085).
   */
  public async getStartupBenchmarkReport(): Promise<StartupBenchmarkReportResult> {
    return this.callNative<StartupBenchmarkReportResult>('GET_STARTUP_BENCHMARK_REPORT');
  }

  // === Milestone 3 SuperApp M1/M2 Bridge Methods ===

  /**
   * Sets the native navigation bar title and subtitle.
   */
  public async setNavBarTitle(options: SetNavBarTitlePayload | string, subtitle?: string): Promise<NavBarTitleResult> {
    const payload: SetNavBarTitlePayload = typeof options === 'string' ? { title: options, subtitle } : options;
    return this.callNative<NavBarTitleResult>('SET_NAV_BAR_TITLE', payload);
  }

  /**
   * Sets the native navigation bar background and text colors.
   */
  public async setNavBarColor(options: SetNavBarColorPayload): Promise<NavBarColorResult> {
    return this.callNative<NavBarColorResult>('SET_NAV_BAR_COLOR', options);
  }

  /**
   * Sets the native navigation bar buttons.
   */
  public async setNavBarButtons(options: SetNavBarButtonsPayload): Promise<NavBarButtonsResult> {
    return this.callNative<NavBarButtonsResult>('SET_NAV_BAR_BUTTONS', options);
  }

  /**
   * Sets the native navigation bar indeterminate progress indicator.
   */
  public async setNavBarProgress(options: SetNavBarProgressPayload | boolean, progress?: number): Promise<NavBarProgressResult> {
    const payload: SetNavBarProgressPayload = typeof options === 'boolean' ? { visible: options, progress } : options;
    return this.callNative<NavBarProgressResult>('SET_NAV_BAR_PROGRESS', payload);
  }

  /**
   * Comprehensive navigation bar updater.
   */
  public async setNavBar(options: NavBarConfigPayload): Promise<boolean> {
    if (options.title !== undefined) {
      await this.setNavBarTitle({ title: options.title, subtitle: options.subtitle });
    }
    if (options.backgroundColor !== undefined) {
      await this.setNavBarColor({
        backgroundColor: options.backgroundColor,
        textColor: options.textColor,
        isDark: options.isDark
      });
    }
    if (options.leftButton !== undefined || options.rightButtons !== undefined) {
      await this.setNavBarButtons({
        left: options.leftButton,
        right: options.rightButtons
      });
    }
    if (options.isProgressVisible !== undefined || options.progress !== undefined) {
      await this.setNavBarProgress({
        visible: options.isProgressVisible ?? true,
        progress: options.progress
      });
    }
    return true;
  }

  /**
   * Expands the native bottom sheet container.
   */
  public async expandBottomSheet(snapPoint?: number): Promise<BottomSheetResult> {
    return this.callNative<BottomSheetResult>('EXPAND_BOTTOM_SHEET', { snapPoint });
  }

  /**
   * Collapses the native bottom sheet container.
   */
  public async collapseBottomSheet(): Promise<BottomSheetResult> {
    return this.callNative<BottomSheetResult>('COLLAPSE_BOTTOM_SHEET', {});
  }

  /**
   * Sets the snap points and configuration for the native bottom sheet.
   */
  public async setSheetSnapPoints(options: SetSheetSnapPointsPayload): Promise<BottomSheetSnapPointsResult> {
    return this.callNative<BottomSheetSnapPointsResult>('SET_SHEET_SNAP_POINTS', options);
  }

  /**
   * Triggers an impact haptic waveform.
   */
  public async triggerImpact(style: ImpactStyle = 'medium'): Promise<HapticFeedbackResult> {
    return this.callNative<HapticFeedbackResult>('HAPTIC_FEEDBACK', { type: 'impact', style });
  }

  /**
   * Triggers a notification haptic waveform.
   */
  public async triggerNotification(notificationType: NotificationHapticType = 'success'): Promise<HapticFeedbackResult> {
    return this.callNative<HapticFeedbackResult>('HAPTIC_FEEDBACK', { type: 'notification', notificationType });
  }

  /**
   * Triggers a selection click haptic waveform.
   */
  public async triggerSelection(): Promise<HapticFeedbackResult> {
    return this.callNative<HapticFeedbackResult>('HAPTIC_FEEDBACK', { type: 'selection' });
  }

  /**
   * Retrieves safe area insets and keyboard height.
   */
  public async getSafeAreaInsets(): Promise<SafeAreaInsetsResult> {
    return this.callNative<SafeAreaInsetsResult>('GET_SAFE_AREA_INSETS');
  }

  /**
   * Sets a cookie in the partitioned cookie jar.
   */
  public async setCookie(options: SetCookiePayload): Promise<boolean> {
    const res = await this.callNative<{ success: boolean }>('COOKIE_SET', options);
    return res?.success ?? true;
  }

  /**
   * Retrieves cookies for a URL from the partitioned cookie jar.
   */
  public async getCookies(url: string, appId?: string): Promise<CookieItem[] | string> {
    const res = await this.callNative<{ cookies: CookieItem[] | string }>('COOKIE_GET', { url, appId });
    return res?.cookies ?? [];
  }

  /**
   * Removes a cookie from the partitioned cookie jar.
   */
  public async removeCookie(url: string, name: string, domain?: string, path?: string, appId?: string): Promise<boolean> {
    const res = await this.callNative<{ success: boolean }>('COOKIE_REMOVE', { url, name, domain, path, appId });
    return res?.success ?? true;
  }

  /**
   * Clears all cookies for a mini-app tenant.
   */
  public async clearCookies(appId?: string): Promise<boolean> {
    const res = await this.callNative<{ success: boolean }>('COOKIE_REMOVE_ALL', { appId });
    return res?.success ?? true;
  }

  /**
   * Executes a headless action in the background.
   */
  public async executeHeadlessAction<T = unknown>(action: string, payload: Record<string, any> = {}): Promise<T> {
    return this.callNative<T>(action, { ...payload, isHeadless: true });
  }

  /**
   * Opens an external link with native warning interstitial (Task 10192).
   */
  public async openExternalLink(options: OpenExternalLinkPayload): Promise<OpenExternalLinkResult> {
    return this.callNative<OpenExternalLinkResult>('OPEN_EXTERNAL_LINK', options);
  }

  /**
   * Subscribes to the external link warning shown event (Task 10192).
   */
  public onExternalLinkWarningShown(callback: (event: ExternalLinkWarningEvent) => void): () => void {
    const unsub1 = this.on('ON_EXTERNAL_LINK_WARNING_SHOWN', callback);
    const unsub2 = this.on('onExternalLinkWarningShown', callback);
    return () => {
      unsub1();
      unsub2();
    };
  }

  /**
   * Opens a new tab in the bottom sheet overlay stack (Task 10194).
   */
  public async openTab(payload: TabOpenPayload = {}): Promise<TabOpenResult> {
    return this.callNative<TabOpenResult>('TAB_OPEN', payload);
  }

  /**
   * Closes a tab in the bottom sheet overlay stack (Task 10194).
   */
  public async closeTab(tabId: string): Promise<TabCloseResult> {
    return this.callNative<TabCloseResult>('TAB_CLOSE', { tabId });
  }

  /**
   * Switches the active foreground tab with zero full reload (Task 10194).
   */
  public async switchToTab(tabId: string): Promise<TabSwitchResult> {
    return this.callNative<TabSwitchResult>('TAB_SWITCH', { tabId });
  }

  /**
   * Retrieves the active tab handle (Task 10194).
   */
  public async getActiveTab(): Promise<TabHandle | null> {
    return this.callNative<TabHandle | null>('TAB_GET_ACTIVE');
  }

  /**
   * Retrieves all open tab handles in the overlay stack (Task 10194).
   */
  public async getTabs(): Promise<TabListResult> {
    return this.callNative<TabListResult>('TAB_LIST');
  }

  /**
   * Closes all active tabs in the overlay stack (Task 10194).
   */
  public async closeAllTabs(): Promise<TabCloseAllResult> {
    return this.callNative<TabCloseAllResult>('TAB_CLOSE_ALL');
  }

  /**
   * Cross-Mini-App Launch Bridge (Task 10201).
   * Launches another sandboxed mini-app with WINDOWED, MODAL, or FULLSCREEN presentation
   * and optional JSAPI aliasing table.
   */
  public async openMiniApp(payload: OpenMiniAppPayload): Promise<OpenMiniAppResult> {
    return this.callNative<OpenMiniAppResult>('OPEN_MINI_APP', payload);
  }

  /**
   * Closes a child mini-app session and returns completion result to caller (Task 10201).
   */
  public async closeMiniApp(payload: CloseMiniAppPayload = {}): Promise<CloseMiniAppResult> {
    return this.callNative<CloseMiniAppResult>('CLOSE_MINI_APP', payload);
  }

  /**
   * Subscribes to the ON_MINI_APP_CLOSED lifecycle event fired when a child mini-app closes (Task 10201).
   */
  public onMiniAppClosed(callback: (data: MiniAppClosedEventData) => void): () => void {
    return this.on('ON_MINI_APP_CLOSED', (event: any) => {
      const data = event?.detail || event?.data || event || {};
      callback(data);
    });
  }

  // === Enterprise Domain Mini-Apps Bridge Methods ===

  /**
   * Dispatches a multi-rail payment request (Alipay, Bakong KHQR, PayPay, Stripe, Apple/Google Pay).
   */
  public async requestPayment(options: RequestPaymentPayload): Promise<RequestPaymentResult> {
    return this.callNative<RequestPaymentResult>('REQUEST_PAYMENT', options as unknown as Record<string, unknown>);
  }

  /**
   * Queries the status of an in-flight or completed payment intent.
   */
  public async queryPaymentStatus(options: QueryPaymentStatusPayload): Promise<QueryPaymentStatusResult> {
    return this.callNative<QueryPaymentStatusResult>('QUERY_PAYMENT_STATUS', options as unknown as Record<string, unknown>);
  }

  /**
   * Cancels a pending payment intent.
   */
  public async cancelPayment(options: CancelPaymentPayload): Promise<CancelPaymentResult> {
    return this.callNative<CancelPaymentResult>('CANCEL_PAYMENT', options as unknown as Record<string, unknown>);
  }

  /**
   * Starts device motion and 3D orientation tracking.
   */
  public async startDeviceMotion(options?: StartDeviceMotionPayload): Promise<boolean> {
    const res = await this.callNative<{ started: boolean }>('START_DEVICE_MOTION', (options || {}) as unknown as Record<string, unknown>);
    return res?.started ?? true;
  }

  /**
   * Stops device motion and 3D orientation tracking.
   */
  public async stopDeviceMotion(): Promise<boolean> {
    const res = await this.callNative<{ stopped: boolean }>('STOP_DEVICE_MOTION');
    return res?.stopped ?? true;
  }

  /**
   * Subscribes to device motion orientation changes (alpha, beta, gamma, accelerometer, compass).
   */
  public onDeviceMotionChange(callback: (data: DeviceMotionData) => void): () => void {
    const unsub1 = this.on('ON_DEVICE_MOTION_CHANGE', callback);
    const unsub2 = this.on('onDeviceMotionChange', callback);
    return () => {
      unsub1();
      unsub2();
    };
  }

  /**
   * Writes data to the sandboxed filesystem.
   */
  public async fsWriteFile(options: FsWriteFilePayload): Promise<FsWriteFileResult> {
    return this.callNative<FsWriteFileResult>('FS_WRITE_FILE', options as unknown as Record<string, unknown>);
  }

  /**
   * Reads data from the sandboxed filesystem.
   */
  public async fsReadFile(options: FsReadFilePayload): Promise<FsReadFileResult> {
    return this.callNative<FsReadFileResult>('FS_READ_FILE', options as unknown as Record<string, unknown>);
  }

  /**
   * Lists files in a sandboxed directory.
   */
  public async fsListDir(options: FsListDirPayload = {}): Promise<FsListDirResult> {
    return this.callNative<FsListDirResult>('FS_LIST_DIR', options as unknown as Record<string, unknown>);
  }

  /**
   * Retrieves file metadata statistics in the sandbox.
   */
  public async fsStat(options: FsStatPayload): Promise<FsStatResult> {
    return this.callNative<FsStatResult>('FS_STAT', options as unknown as Record<string, unknown>);
  }

  /**
   * Deletes a file in the sandboxed filesystem.
   */
  public async fsDeleteFile(options: FsDeleteFilePayload): Promise<FsDeleteFileResult> {
    return this.callNative<FsDeleteFileResult>('FS_DELETE_FILE', options as unknown as Record<string, unknown>);
  }

  /**
   * Creates a directory in the sandboxed filesystem.
   */
  public async fsMkdir(options: FsMkdirPayload): Promise<FsMkdirResult> {
    return this.callNative<FsMkdirResult>('FS_MKDIR', options as unknown as Record<string, unknown>);
  }
}

// Aliases and Singleton exports
export const MiniAppBridge = GoatBridge;
export const bridge = new GoatBridge();
export const goatBridge = bridge;

if (typeof window !== 'undefined') {
  (window as any).GoatBridge = bridge;
  (window as any).goatBridge = bridge;
}

