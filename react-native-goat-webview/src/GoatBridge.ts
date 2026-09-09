import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import NativeGoatWebViewModule from './NativeGoatWebViewModule';
import type { TurboGoatWebViewSpec, DeviceInfo } from './types';

const LINKING_ERROR =
  `The package 'react-native-goat-webview' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

let turboModuleInstance: TurboGoatWebViewSpec | null = null;
try {
  turboModuleInstance =
    NativeGoatWebViewModule ??
    (TurboModuleRegistry?.get?.<TurboGoatWebViewSpec>('GoatWebViewModule') ?? null);
} catch {
  turboModuleInstance = null;
}

export const GoatWebViewNativeModule: TurboGoatWebViewSpec =
  turboModuleInstance ??
  NativeModules.GoatWebViewModule ??
  new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    }
  );

/** Ciphertext envelope returned by VAULT_ENCRYPT. Carries no key material by construction. */
export interface GoatVaultEnvelope {
  version: number;
  vaultMode: string;
  appId: string;
  vaultId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export class GoatBridgeClient {
  private pendingRequests = new Map<
    string,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      timer: any;
    }
  >();

  /**
   * Pre-warms the Goat WebView Chromium engine before screen presentation.
   */
  public async prewarm(appId?: string): Promise<boolean> {
    try {
      return await GoatWebViewNativeModule.prewarm(appId);
    } catch {
      return false;
    }
  }

  /**
   * Clears the cached extracted mini-app bundle.
   */
  public async clearCache(appId?: string): Promise<boolean> {
    try {
      return await GoatWebViewNativeModule.clearCache(appId);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves bundle version string.
   */
  public async getBundleVersion(appId?: string): Promise<string> {
    try {
      return await GoatWebViewNativeModule.getBundleVersion(appId);
    } catch {
      return '1.0.0-goat';
    }
  }

  /**
   * Retrieves structured device information and hardware telemetry (Task 10203 / R3).
   */
  public async getDeviceInfo(appId?: string): Promise<DeviceInfo> {
    try {
      if (typeof GoatWebViewNativeModule.executeAction === 'function') {
        const res = await GoatWebViewNativeModule.executeAction('GET_DEVICE_INFO', {}, appId);
        return res as DeviceInfo;
      }
      return {
        model: 'Unknown',
        manufacturer: 'Unknown',
        brand: 'Unknown',
        installGuid: '',
      } as DeviceInfo;
    } catch {
      return {
        model: 'Unknown',
        manufacturer: 'Unknown',
        brand: 'Unknown',
        installGuid: '',
      } as DeviceInfo;
    }
  }

  /**
   * Retrieves stable, install-scoped anonymous GUID (Task 10203 / R2 & R3).
   */
  public async getInstallGuid(appId?: string): Promise<string> {
    const info = await this.getDeviceInfo(appId);
    return info.installGuid || '';
  }


  /**
   * Correlates an incoming native bridge response with a pending request.
   */
  public handleBridgeResponse(response: { id: string; success: boolean; data?: any; error?: string }) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      if (response.success) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error || 'Bridge request failed'));
      }
      this.pendingRequests.delete(response.id);
    }
  }

  /**
   * Registers a pending request with timeout.
   */
  public registerRequest<T = any>(id: string, timeoutMs: number = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`GoatBridge request timed out (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  private eventListeners = new Map<string, Set<(data: any) => void>>();

  /**
   * Registers an event listener for bridge events.
   */
  public on(event: string, listener: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  /**
   * Emits an event to registered listeners.
   */
  public emit(event: string, data: any) {
    this.eventListeners.get(event)?.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error(`[GoatBridge] Error in event listener for '${event}':`, err);
      }
    });
  }

  /**
   * Cross-Mini-App Launch Bridge (Task 10201).
   */
  public async openMiniApp(payload: import('./types').OpenMiniAppPayload): Promise<import('./types').OpenMiniAppResult> {
    const instanceId = `inst_${payload.targetAppId}_${Date.now()}`;
    return {
      instanceId,
      targetAppId: payload.targetAppId,
      presentation: payload.presentation || 'WINDOWED',
      status: 'OPENED',
    };
  }

  /**
   * Closes a child mini-app session (Task 10201).
   */
  public async closeMiniApp(payload: import('./types').CloseMiniAppPayload = {}): Promise<import('./types').CloseMiniAppResult> {
    return {
      closed: true,
      instanceId: payload.instanceId || 'inst_default',
    };
  }

  /**
   * Subscribes to the ON_MINI_APP_CLOSED lifecycle event (Task 10201).
   */
  public onMiniAppClosed(listener: (data: import('./types').MiniAppClosedEventData) => void): () => void {
    return this.on('ON_MINI_APP_CLOSED', listener);
  }

  /**
   * Notifies native host that the AppService Worker is ready (Task F9).
   */
  public async notifyAppServiceReady(appId: string = 'default', details?: Record<string, any>): Promise<boolean> {
    try {
      if (typeof GoatWebViewNativeModule.notifyAppServiceReady === 'function') {
        return await GoatWebViewNativeModule.notifyAppServiceReady(appId, details);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Notifies native host that the AppService Worker encountered an unhandled crash (Task F9).
   */
  public async notifyAppServiceCrash(appId: string = 'default', error: string = 'Crash'): Promise<boolean> {
    try {
      if (typeof GoatWebViewNativeModule.notifyAppServiceCrash === 'function') {
        return await GoatWebViewNativeModule.notifyAppServiceCrash(appId, error);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Notifies native host that the AppService Worker has terminated (Task F9).
   */
  public async notifyAppServiceTerminate(appId: string = 'default'): Promise<boolean> {
    try {
      if (typeof GoatWebViewNativeModule.notifyAppServiceTerminate === 'function') {
        return await GoatWebViewNativeModule.notifyAppServiceTerminate(appId);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches a wallet, passkey or vault action to the native engine.
   *
   * Deliberately has no catch-all fallback. Several sibling methods here degrade to a default on
   * failure, which is tolerable for device metadata and an auth bypass for anything security
   * relevant — before 2026-09-06 the React Native companions returned `{ authenticated: true }`
   * and a faked payment success while the native gate was never reached. A signing or credential
   * call must surface the native error verbatim so a caller cannot mistake failure for consent.
   */
  private async executeSecureAction<T>(
    action: string,
    payload: Record<string, unknown>,
    appId?: string
  ): Promise<T> {
    // When the package is not linked, GoatWebViewNativeModule is a Proxy that throws on ANY
    // property access — so probing it has to be guarded, or the caller gets the raw linking
    // error instead of something actionable.
    let execute: TurboGoatWebViewSpec['executeAction'] | undefined;
    try {
      execute = GoatWebViewNativeModule?.executeAction;
    } catch {
      execute = undefined;
    }
    if (typeof execute !== 'function') {
      throw new Error(
        `Cannot execute ${action}: react-native-goat-webview's native module is unavailable. ` +
          'Rebuild the app after installing the package (Expo Go is not supported).'
      );
    }
    return (await execute.call(GoatWebViewNativeModule, action, payload, appId)) as T;
  }

  /** Connects to the host's registered wallet adapter. */
  public async web3ConnectWallet(
    options: { network?: string; chainFamily?: string; chains?: string[]; manifestUrl?: string } = {},
    appId?: string
  ): Promise<Record<string, unknown>> {
    return this.executeSecureAction('WEB3_CONNECT_WALLET', { ...options }, appId);
  }

  /** Signs a transaction after the native modal decodes and confirms it. */
  public async web3SignTransaction(
    options: Record<string, unknown>,
    appId?: string
  ): Promise<Record<string, unknown>> {
    return this.executeSecureAction('WEB3_SIGN_TRANSACTION', options, appId);
  }

  /**
   * Signs an off-chain message (`personal_sign` / `eth_signTypedData_v4`). Gesture-gated: an
   * off-chain Permit2 allowance can drain a wallet without producing a transaction.
   */
  public async web3SignMessage(
    options: { message: string; messageType?: string; chainFamily?: string; network?: string },
    appId?: string
  ): Promise<Record<string, unknown>> {
    return this.executeSecureAction('WEB3_SIGN_MESSAGE', { ...options }, appId);
  }

  /** Switches the connected session to another chain (EIP-1193 `wallet_switchEthereumChain`). */
  public async web3SwitchChain(
    options: { chainId: string; chainFamily?: string; addChainParams?: Record<string, unknown> },
    appId?: string
  ): Promise<{ switched: boolean; chainId: string }> {
    return this.executeSecureAction('WEB3_SWITCH_CHAIN', { ...options }, appId);
  }

  public async web3Disconnect(appId?: string): Promise<{ disconnected: boolean }> {
    return this.executeSecureAction('WEB3_DISCONNECT', {}, appId);
  }

  public async web3GetAccount(appId?: string): Promise<Record<string, unknown>> {
    return this.executeSecureAction('WEB3_GET_ACCOUNT', {}, appId);
  }

  /** Reports whether a WebAuthn ceremony is possible and which hardware vault mode is available. */
  public async passkeyCheckSupport(appId?: string): Promise<Record<string, unknown>> {
    return this.executeSecureAction('PASSKEY_CHECK_SUPPORT', {}, appId);
  }

  /**
   * Runs a WebAuthn registration ceremony. `rpId` must be declared in the mini-app manifest's
   * `security.allowedRpIds` or native rejects with `RP_ID_NOT_ALLOWED`.
   */
  public async passkeyRegister(
    options: { optionsJson: string; rpId?: string },
    appId?: string
  ): Promise<Record<string, unknown>> {
    return this.executeSecureAction('PASSKEY_REGISTER', { ...options }, appId);
  }

  /** Runs a WebAuthn assertion. `clientExtensionResults.prf` is stripped natively. */
  public async passkeyAssert(
    options: { optionsJson: string; rpId?: string },
    appId?: string
  ): Promise<Record<string, unknown>> {
    return this.executeSecureAction('PASSKEY_ASSERT', { ...options }, appId);
  }

  /** Encrypts with a hardware-anchored AES-256-GCM key derived entirely in native memory. */
  public async vaultEncrypt(
    options: { vaultId: string; plaintext: string },
    appId?: string
  ): Promise<GoatVaultEnvelope> {
    return this.executeSecureAction<GoatVaultEnvelope>('VAULT_ENCRYPT', { ...options }, appId);
  }

  /** Decrypts a vault envelope natively; the key never enters the JS realm. */
  public async vaultDecrypt(
    options: { vaultId: string; envelope: GoatVaultEnvelope | Record<string, unknown> },
    appId?: string
  ): Promise<{ plaintext: string; migratedEnvelope?: GoatVaultEnvelope }> {
    return this.executeSecureAction('VAULT_DECRYPT', { ...options }, appId);
  }

  public onAppShow(listener: (data: import('./types').LaunchOptions) => void): () => void {
    return this.on('ON_APP_SHOW', listener);
  }

  public onAppHide(listener: (data: { timestamp: number }) => void): () => void {
    return this.on('ON_APP_HIDE', listener);
  }

  public onPageScroll(listener: (data: import('./types').PageScrollEventData) => void): () => void {
    return this.on('ON_PAGE_SCROLL', listener);
  }

  public onMemoryWarning(listener: (data: import('./types').MemoryWarningEventData) => void): () => void {
    return this.on('ON_MEMORY_WARNING', listener);
  }

  public onWindowResize(listener: (data: import('./types').WindowResizeEventData) => void): () => void {
    return this.on('ON_WINDOW_RESIZE', listener);
  }
}

export const goatBridge = new GoatBridgeClient();
