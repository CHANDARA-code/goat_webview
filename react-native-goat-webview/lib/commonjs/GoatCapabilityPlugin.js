"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goatCapabilityRegistry = exports.GoatCapabilityRegistry = void 0;
/**
 * Global registry for dynamic capability plugins and SPI discovery (Task 10202).
 */
class GoatCapabilityRegistry {
    constructor() {
        this.plugins = new Map();
        this.actionIndex = new Map();
    }
    static get instance() {
        if (!this._instance) {
            this._instance = new GoatCapabilityRegistry();
        }
        return this._instance;
    }
    /** Registers a companion capability plugin. */
    registerPlugin(plugin) {
        this.plugins.set(plugin.namespace, plugin);
        for (const action of plugin.supportedActions) {
            this.actionIndex.set(action, plugin);
        }
    }
    /** Unregisters a capability plugin by namespace. */
    unregisterPlugin(namespace) {
        const plugin = this.plugins.get(namespace);
        if (plugin) {
            this.plugins.delete(namespace);
            for (const action of plugin.supportedActions) {
                this.actionIndex.delete(action);
            }
        }
    }
    /** Checks if an action is supported by any registered capability plugin. */
    canHandle(action) {
        return this.actionIndex.has(action);
    }
    /** Dispatches an action to the registered capability plugin. */
    async dispatchAction(action, payload) {
        const plugin = this.actionIndex.get(action);
        if (!plugin)
            return null;
        return await plugin.handleAction(action, payload);
    }
    /** Lists all registered plugin namespaces. */
    get registeredNamespaces() {
        return Array.from(this.plugins.keys());
    }
    /** Lists all registered actions across all companion plugins. */
    get allSupportedActions() {
        return Array.from(this.actionIndex.keys());
    }
    /** Clears all registered plugins (for testing). */
    clear() {
        this.plugins.clear();
        this.actionIndex.clear();
    }
}
exports.GoatCapabilityRegistry = GoatCapabilityRegistry;
exports.goatCapabilityRegistry = GoatCapabilityRegistry.instance;
