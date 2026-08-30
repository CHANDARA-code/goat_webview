/**
 * @goat/bridge-mock - Bidirectional Native-Web Event Bus
 */

export type EventHandler = (payload: any) => void;

export class BridgeEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to native bridge events (e.g. 'LOCATION_CHANGE', 'BLE_DEVICE_FOUND')
   * Returns an unsubscribe function.
   */
  public on(event: string, handler: EventHandler): () => void {
    const canonicalEvent = event.toUpperCase();
    if (!this.listeners.has(canonicalEvent)) {
      this.listeners.set(canonicalEvent, new Set());
    }
    this.listeners.get(canonicalEvent)!.add(handler);

    return () => {
      this.off(canonicalEvent, handler);
    };
  }

  /**
   * Subscribe to native bridge event once.
   */
  public once(event: string, handler: EventHandler): () => void {
    const unsub = this.on(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  /**
   * Unsubscribe handler.
   */
  public off(event: string, handler: EventHandler): void {
    const canonicalEvent = event.toUpperCase();
    const set = this.listeners.get(canonicalEvent);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(canonicalEvent);
      }
    }
  }

  /**
   * Emit event to all subscribers.
   */
  public emit(event: string, payload: any): void {
    const canonicalEvent = event.toUpperCase();
    const set = this.listeners.get(canonicalEvent);
    if (set) {
      for (const handler of Array.from(set)) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[GoatBridgeEventBus] Error in handler for event "${event}":`, err);
        }
      }
    }

    // Also dispatch to DOM if in browser environment
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const customEvent = new CustomEvent(`goat:${event.toLowerCase()}`, { detail: payload });
        window.dispatchEvent(customEvent);
      } catch {
        // Ignore custom event dispatch errors in restricted environments
      }
    }
  }

  /**
   * Remove all listeners for a given event or all events.
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event.toUpperCase());
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get active listener count.
   */
  public listenerCount(event: string): number {
    return this.listeners.get(event.toUpperCase())?.size ?? 0;
  }
}

export const eventBus = new BridgeEventBus();
