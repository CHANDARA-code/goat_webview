import type { TurboGoatWebViewSpec, DeviceInfo } from './types';
export declare const GoatWebViewNativeModule: TurboGoatWebViewSpec;
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
export declare class GoatBridgeClient {
    private pendingRequests;
    /**
     * Pre-warms the Goat WebView Chromium engine before screen presentation.
     */
    prewarm(appId?: string): Promise<boolean>;
    /**
     * Clears the cached extracted mini-app bundle.
     */
    clearCache(appId?: string): Promise<boolean>;
    /**
     * Retrieves bundle version string.
     */
    getBundleVersion(appId?: string): Promise<string>;
    /**
     * Retrieves structured device information and hardware telemetry (Task 10203 / R3).
     */
    getDeviceInfo(appId?: string): Promise<DeviceInfo>;
    /**
     * Retrieves stable, install-scoped anonymous GUID (Task 10203 / R2 & R3).
     */
    getInstallGuid(appId?: string): Promise<string>;
    /**
     * Correlates an incoming native bridge response with a pending request.
     */
    handleBridgeResponse(response: {
        id: string;
        success: boolean;
        data?: any;
        error?: string;
    }): void;
    /**
     * Registers a pending request with timeout.
     */
    registerRequest<T = any>(id: string, timeoutMs?: number): Promise<T>;
    private eventListeners;
    /**
     * Registers an event listener for bridge events.
     */
    on(event: string, listener: (data: any) => void): () => void;
    /**
     * Emits an event to registered listeners.
     */
    emit(event: string, data: any): void;
    /**
     * Cross-Mini-App Launch Bridge (Task 10201).
     */
    openMiniApp(payload: import('./types').OpenMiniAppPayload): Promise<import('./types').OpenMiniAppResult>;
    /**
     * Closes a child mini-app session (Task 10201).
     */
    closeMiniApp(payload?: import('./types').CloseMiniAppPayload): Promise<import('./types').CloseMiniAppResult>;
    /**
     * Subscribes to the ON_MINI_APP_CLOSED lifecycle event (Task 10201).
     */
    onMiniAppClosed(listener: (data: import('./types').MiniAppClosedEventData) => void): () => void;
    /**
     * Notifies native host that the AppService Worker is ready (Task F9).
     */
    notifyAppServiceReady(appId?: string, details?: Record<string, any>): Promise<boolean>;
    /**
     * Notifies native host that the AppService Worker encountered an unhandled crash (Task F9).
     */
    notifyAppServiceCrash(appId?: string, error?: string): Promise<boolean>;
    /**
     * Notifies native host that the AppService Worker has terminated (Task F9).
     */
    notifyAppServiceTerminate(appId?: string): Promise<boolean>;
    /**
     * Dispatches a wallet, passkey or vault action to the native engine.
     *
     * Deliberately has no catch-all fallback. Several sibling methods here degrade to a default on
     * failure, which is tolerable for device metadata and an auth bypass for anything security
     * relevant — before 2026-09-06 the React Native companions returned `{ authenticated: true }`
     * and a faked payment success while the native gate was never reached. A signing or credential
     * call must surface the native error verbatim so a caller cannot mistake failure for consent.
     */
    private executeSecureAction;
    /** Connects to the host's registered wallet adapter. */
    web3ConnectWallet(options?: {
        network?: string;
        chainFamily?: string;
        chains?: string[];
        manifestUrl?: string;
    }, appId?: string): Promise<Record<string, unknown>>;
    /** Signs a transaction after the native modal decodes and confirms it. */
    web3SignTransaction(options: Record<string, unknown>, appId?: string): Promise<Record<string, unknown>>;
    /**
     * Signs an off-chain message (`personal_sign` / `eth_signTypedData_v4`). Gesture-gated: an
     * off-chain Permit2 allowance can drain a wallet without producing a transaction.
     */
    web3SignMessage(options: {
        message: string;
        messageType?: string;
        chainFamily?: string;
        network?: string;
    }, appId?: string): Promise<Record<string, unknown>>;
    /** Switches the connected session to another chain (EIP-1193 `wallet_switchEthereumChain`). */
    web3SwitchChain(options: {
        chainId: string;
        chainFamily?: string;
        addChainParams?: Record<string, unknown>;
    }, appId?: string): Promise<{
        switched: boolean;
        chainId: string;
    }>;
    web3Disconnect(appId?: string): Promise<{
        disconnected: boolean;
    }>;
    web3GetAccount(appId?: string): Promise<Record<string, unknown>>;
    /** Reports whether a WebAuthn ceremony is possible and which hardware vault mode is available. */
    passkeyCheckSupport(appId?: string): Promise<Record<string, unknown>>;
    /**
     * Runs a WebAuthn registration ceremony. `rpId` must be declared in the mini-app manifest's
     * `security.allowedRpIds` or native rejects with `RP_ID_NOT_ALLOWED`.
     */
    passkeyRegister(options: {
        optionsJson: string;
        rpId?: string;
    }, appId?: string): Promise<Record<string, unknown>>;
    /** Runs a WebAuthn assertion. `clientExtensionResults.prf` is stripped natively. */
    passkeyAssert(options: {
        optionsJson: string;
        rpId?: string;
    }, appId?: string): Promise<Record<string, unknown>>;
    /** Encrypts with a hardware-anchored AES-256-GCM key derived entirely in native memory. */
    vaultEncrypt(options: {
        vaultId: string;
        plaintext: string;
    }, appId?: string): Promise<GoatVaultEnvelope>;
    /** Decrypts a vault envelope natively; the key never enters the JS realm. */
    vaultDecrypt(options: {
        vaultId: string;
        envelope: GoatVaultEnvelope | Record<string, unknown>;
    }, appId?: string): Promise<{
        plaintext: string;
        migratedEnvelope?: GoatVaultEnvelope;
    }>;
    onAppShow(listener: (data: import('./types').LaunchOptions) => void): () => void;
    onAppHide(listener: (data: {
        timestamp: number;
    }) => void): () => void;
    onPageScroll(listener: (data: import('./types').PageScrollEventData) => void): () => void;
    onMemoryWarning(listener: (data: import('./types').MemoryWarningEventData) => void): () => void;
    onWindowResize(listener: (data: import('./types').WindowResizeEventData) => void): () => void;
}
export declare const goatBridge: GoatBridgeClient;
