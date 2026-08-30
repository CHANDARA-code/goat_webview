/**
 * Service Provider Interface (SPI) for modular Goat WebView capabilities (Task 10202).
 * Decouples heavy native dependencies from the lightweight core <150KB engine.
 */
export interface GoatCapabilityPlugin {
    /** Unique namespace for this capability plugin (e.g. 'media', 'scanner', 'location'). */
    readonly namespace: string;
    /** Array of bridge actions handled by this plugin. */
    readonly supportedActions: string[];
    /** Handles an action dispatched to this capability plugin. */
    handleAction(action: string, payload: any): Promise<any>;
}
/**
 * Global registry for dynamic capability plugins and SPI discovery (Task 10202).
 */
export declare class GoatCapabilityRegistry {
    private static _instance;
    private plugins;
    private actionIndex;
    static get instance(): GoatCapabilityRegistry;
    /** Registers a companion capability plugin. */
    registerPlugin(plugin: GoatCapabilityPlugin): void;
    /** Unregisters a capability plugin by namespace. */
    unregisterPlugin(namespace: string): void;
    /** Checks if an action is supported by any registered capability plugin. */
    canHandle(action: string): boolean;
    /** Dispatches an action to the registered capability plugin. */
    dispatchAction(action: string, payload: any): Promise<any>;
    /** Lists all registered plugin namespaces. */
    get registeredNamespaces(): string[];
    /** Lists all registered actions across all companion plugins. */
    get allSupportedActions(): string[];
    /** Clears all registered plugins (for testing). */
    clear(): void;
}
export declare const goatCapabilityRegistry: GoatCapabilityRegistry;
