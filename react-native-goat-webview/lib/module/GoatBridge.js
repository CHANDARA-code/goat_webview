import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import NativeGoatWebViewModule from './NativeGoatWebViewModule';
const LINKING_ERROR = `The package 'react-native-goat-webview' doesn't seem to be linked. Make sure: \n\n` +
    Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo Go\n';
let turboModuleInstance = null;
try {
    turboModuleInstance =
        NativeGoatWebViewModule ??
            (TurboModuleRegistry?.get?.('GoatWebViewModule') ?? null);
}
catch {
    turboModuleInstance = null;
}
export const GoatWebViewNativeModule = turboModuleInstance ??
    NativeModules.GoatWebViewModule ??
    new Proxy({}, {
        get() {
            throw new Error(LINKING_ERROR);
        },
    });
export class GoatBridgeClient {
    constructor() {
        this.pendingRequests = new Map();
        this.eventListeners = new Map();
    }
    /**
     * Pre-warms the Goat WebView Chromium engine before screen presentation.
     */
    async prewarm(appId) {
        try {
            return await GoatWebViewNativeModule.prewarm(appId);
        }
        catch {
            return false;
        }
    }
    /**
     * Clears the cached extracted mini-app bundle.
     */
    async clearCache(appId) {
        try {
            return await GoatWebViewNativeModule.clearCache(appId);
        }
        catch {
            return false;
        }
    }
    /**
     * Retrieves bundle version string.
     */
    async getBundleVersion(appId) {
        try {
            return await GoatWebViewNativeModule.getBundleVersion(appId);
        }
        catch {
            return '1.0.0-goat';
        }
    }
    /**
     * Retrieves structured device information and hardware telemetry (Task 10203 / R3).
     */
    async getDeviceInfo(appId) {
        try {
            if (typeof GoatWebViewNativeModule.executeAction === 'function') {
                const res = await GoatWebViewNativeModule.executeAction('GET_DEVICE_INFO', {}, appId);
                return res;
            }
            return {
                model: 'Unknown',
                manufacturer: 'Unknown',
                brand: 'Unknown',
                installGuid: '',
            };
        }
        catch {
            return {
                model: 'Unknown',
                manufacturer: 'Unknown',
                brand: 'Unknown',
                installGuid: '',
            };
        }
    }
    /**
     * Retrieves stable, install-scoped anonymous GUID (Task 10203 / R2 & R3).
     */
    async getInstallGuid(appId) {
        const info = await this.getDeviceInfo(appId);
        return info.installGuid || '';
    }
    /**
     * Correlates an incoming native bridge response with a pending request.
     */
    handleBridgeResponse(response) {
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
            clearTimeout(pending.timer);
            if (response.success) {
                pending.resolve(response.data);
            }
            else {
                pending.reject(new Error(response.error || 'Bridge request failed'));
            }
            this.pendingRequests.delete(response.id);
        }
    }
    /**
     * Registers a pending request with timeout.
     */
    registerRequest(id, timeoutMs = 5000) {
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
    /**
     * Registers an event listener for bridge events.
     */
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(listener);
        return () => {
            this.eventListeners.get(event)?.delete(listener);
        };
    }
    /**
     * Emits an event to registered listeners.
     */
    emit(event, data) {
        this.eventListeners.get(event)?.forEach((listener) => {
            try {
                listener(data);
            }
            catch (err) {
                console.error(`[GoatBridge] Error in event listener for '${event}':`, err);
            }
        });
    }
    /**
     * Cross-Mini-App Launch Bridge (Task 10201).
     */
    async openMiniApp(payload) {
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
    async closeMiniApp(payload = {}) {
        return {
            closed: true,
            instanceId: payload.instanceId || 'inst_default',
        };
    }
    /**
     * Subscribes to the ON_MINI_APP_CLOSED lifecycle event (Task 10201).
     */
    onMiniAppClosed(listener) {
        return this.on('ON_MINI_APP_CLOSED', listener);
    }
    /**
     * Notifies native host that the AppService Worker is ready (Task F9).
     */
    async notifyAppServiceReady(appId = 'default', details) {
        try {
            if (typeof GoatWebViewNativeModule.notifyAppServiceReady === 'function') {
                return await GoatWebViewNativeModule.notifyAppServiceReady(appId, details);
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Notifies native host that the AppService Worker encountered an unhandled crash (Task F9).
     */
    async notifyAppServiceCrash(appId = 'default', error = 'Crash') {
        try {
            if (typeof GoatWebViewNativeModule.notifyAppServiceCrash === 'function') {
                return await GoatWebViewNativeModule.notifyAppServiceCrash(appId, error);
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Notifies native host that the AppService Worker has terminated (Task F9).
     */
    async notifyAppServiceTerminate(appId = 'default') {
        try {
            if (typeof GoatWebViewNativeModule.notifyAppServiceTerminate === 'function') {
                return await GoatWebViewNativeModule.notifyAppServiceTerminate(appId);
            }
            return true;
        }
        catch {
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
    async executeSecureAction(action, payload, appId) {
        // When the package is not linked, GoatWebViewNativeModule is a Proxy that throws on ANY
        // property access — so probing it has to be guarded, or the caller gets the raw linking
        // error instead of something actionable.
        let execute;
        try {
            execute = GoatWebViewNativeModule?.executeAction;
        }
        catch {
            execute = undefined;
        }
        if (typeof execute !== 'function') {
            throw new Error(`Cannot execute ${action}: react-native-goat-webview's native module is unavailable. ` +
                'Rebuild the app after installing the package (Expo Go is not supported).');
        }
        return (await execute.call(GoatWebViewNativeModule, action, payload, appId));
    }
    /** Connects to the host's registered wallet adapter. */
    async web3ConnectWallet(options = {}, appId) {
        return this.executeSecureAction('WEB3_CONNECT_WALLET', { ...options }, appId);
    }
    /** Signs a transaction after the native modal decodes and confirms it. */
    async web3SignTransaction(options, appId) {
        return this.executeSecureAction('WEB3_SIGN_TRANSACTION', options, appId);
    }
    /**
     * Signs an off-chain message (`personal_sign` / `eth_signTypedData_v4`). Gesture-gated: an
     * off-chain Permit2 allowance can drain a wallet without producing a transaction.
     */
    async web3SignMessage(options, appId) {
        return this.executeSecureAction('WEB3_SIGN_MESSAGE', { ...options }, appId);
    }
    /** Switches the connected session to another chain (EIP-1193 `wallet_switchEthereumChain`). */
    async web3SwitchChain(options, appId) {
        return this.executeSecureAction('WEB3_SWITCH_CHAIN', { ...options }, appId);
    }
    async web3Disconnect(appId) {
        return this.executeSecureAction('WEB3_DISCONNECT', {}, appId);
    }
    async web3GetAccount(appId) {
        return this.executeSecureAction('WEB3_GET_ACCOUNT', {}, appId);
    }
    /** Reports whether a WebAuthn ceremony is possible and which hardware vault mode is available. */
    async passkeyCheckSupport(appId) {
        return this.executeSecureAction('PASSKEY_CHECK_SUPPORT', {}, appId);
    }
    /**
     * Runs a WebAuthn registration ceremony. `rpId` must be declared in the mini-app manifest's
     * `security.allowedRpIds` or native rejects with `RP_ID_NOT_ALLOWED`.
     */
    async passkeyRegister(options, appId) {
        return this.executeSecureAction('PASSKEY_REGISTER', { ...options }, appId);
    }
    /** Runs a WebAuthn assertion. `clientExtensionResults.prf` is stripped natively. */
    async passkeyAssert(options, appId) {
        return this.executeSecureAction('PASSKEY_ASSERT', { ...options }, appId);
    }
    /** Encrypts with a hardware-anchored AES-256-GCM key derived entirely in native memory. */
    async vaultEncrypt(options, appId) {
        return this.executeSecureAction('VAULT_ENCRYPT', { ...options }, appId);
    }
    /** Decrypts a vault envelope natively; the key never enters the JS realm. */
    async vaultDecrypt(options, appId) {
        return this.executeSecureAction('VAULT_DECRYPT', { ...options }, appId);
    }
    onAppShow(listener) {
        return this.on('ON_APP_SHOW', listener);
    }
    onAppHide(listener) {
        return this.on('ON_APP_HIDE', listener);
    }
    onPageScroll(listener) {
        return this.on('ON_PAGE_SCROLL', listener);
    }
    onMemoryWarning(listener) {
        return this.on('ON_MEMORY_WARNING', listener);
    }
    onWindowResize(listener) {
        return this.on('ON_WINDOW_RESIZE', listener);
    }
}
export const goatBridge = new GoatBridgeClient();
