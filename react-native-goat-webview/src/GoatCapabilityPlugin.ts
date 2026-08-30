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
export class GoatCapabilityRegistry {
  private static _instance: GoatCapabilityRegistry;
  private plugins = new Map<string, GoatCapabilityPlugin>();
  private actionIndex = new Map<string, GoatCapabilityPlugin>();

  public static get instance(): GoatCapabilityRegistry {
    if (!this._instance) {
      this._instance = new GoatCapabilityRegistry();
    }
    return this._instance;
  }

  /** Registers a companion capability plugin. */
  public registerPlugin(plugin: GoatCapabilityPlugin): void {
    this.plugins.set(plugin.namespace, plugin);
    for (const action of plugin.supportedActions) {
      this.actionIndex.set(action, plugin);
    }
  }

  /** Unregisters a capability plugin by namespace. */
  public unregisterPlugin(namespace: string): void {
    const plugin = this.plugins.get(namespace);
    if (plugin) {
      this.plugins.delete(namespace);
      for (const action of plugin.supportedActions) {
        this.actionIndex.delete(action);
      }
    }
  }

  /** Checks if an action is supported by any registered capability plugin. */
  public canHandle(action: string): boolean {
    return this.actionIndex.has(action);
  }

  /** Dispatches an action to the registered capability plugin. */
  public async dispatchAction(action: string, payload: any): Promise<any> {
    const plugin = this.actionIndex.get(action);
    if (!plugin) return null;
    return await plugin.handleAction(action, payload);
  }

  /** Lists all registered plugin namespaces. */
  public get registeredNamespaces(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** Lists all registered actions across all companion plugins. */
  public get allSupportedActions(): string[] {
    return Array.from(this.actionIndex.keys());
  }

  /** Clears all registered plugins (for testing). */
  public clear(): void {
    this.plugins.clear();
    this.actionIndex.clear();
  }
}

export const goatCapabilityRegistry = GoatCapabilityRegistry.instance;
