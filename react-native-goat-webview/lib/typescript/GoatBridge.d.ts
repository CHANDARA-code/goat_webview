import type { TurboGoatWebViewSpec, DeviceInfo } from './types';
export declare const GoatWebViewNativeModule: TurboGoatWebViewSpec;
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
}
export declare const goatBridge: GoatBridgeClient;
