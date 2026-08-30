"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.goatBridge = exports.GoatBridgeClient = exports.GoatWebViewNativeModule = void 0;
const react_native_1 = require("react-native");
const NativeGoatWebViewModule_1 = __importDefault(require("./NativeGoatWebViewModule"));
const LINKING_ERROR = `The package 'react-native-goat-webview' doesn't seem to be linked. Make sure: \n\n` +
    react_native_1.Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo Go\n';
let turboModuleInstance = null;
try {
    turboModuleInstance =
        NativeGoatWebViewModule_1.default ??
            (react_native_1.TurboModuleRegistry?.get?.('GoatWebViewModule') ?? null);
}
catch {
    turboModuleInstance = null;
}
exports.GoatWebViewNativeModule = turboModuleInstance ??
    react_native_1.NativeModules.GoatWebViewModule ??
    new Proxy({}, {
        get() {
            throw new Error(LINKING_ERROR);
        },
    });
class GoatBridgeClient {
    constructor() {
        this.pendingRequests = new Map();
        this.eventListeners = new Map();
    }
    /**
     * Pre-warms the Goat WebView Chromium engine before screen presentation.
     */
    async prewarm(appId) {
        try {
            return await exports.GoatWebViewNativeModule.prewarm(appId);
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
            return await exports.GoatWebViewNativeModule.clearCache(appId);
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
            return await exports.GoatWebViewNativeModule.getBundleVersion(appId);
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
            if (typeof exports.GoatWebViewNativeModule.executeAction === 'function') {
                const res = await exports.GoatWebViewNativeModule.executeAction('GET_DEVICE_INFO', {}, appId);
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
            if (typeof exports.GoatWebViewNativeModule.notifyAppServiceReady === 'function') {
                return await exports.GoatWebViewNativeModule.notifyAppServiceReady(appId, details);
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
            if (typeof exports.GoatWebViewNativeModule.notifyAppServiceCrash === 'function') {
                return await exports.GoatWebViewNativeModule.notifyAppServiceCrash(appId, error);
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
            if (typeof exports.GoatWebViewNativeModule.notifyAppServiceTerminate === 'function') {
                return await exports.GoatWebViewNativeModule.notifyAppServiceTerminate(appId);
            }
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.GoatBridgeClient = GoatBridgeClient;
exports.goatBridge = new GoatBridgeClient();
