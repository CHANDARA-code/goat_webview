/**
 * Transport shared by the injected EIP-6963, Solana Wallet Standard and TonConnect providers.
 *
 * Runs at document-start, before the mini-app's own bundle, so it cannot use the `GoatBridge`
 * class — it speaks the same wire protocol directly over `window.nativeBridge`. Request ids are
 * namespaced so the page's own GoatBridge instance and this runtime can share one message
 * listener without either resolving the other's replies.
 */

export const GOAT_WEB3_REQUEST_PREFIX = 'goat-web3-';

export interface NativeBridgeLike {
  postMessage: (message: string) => void;
  addEventListener?: (type: string, listener: (event: { data: unknown }) => void) => void;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ProviderRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProviderRpcError';
    this.code = code;
    this.data = data;
  }
}

const BRIDGE_CODE_TO_RPC: Record<string, number> = {
  USER_CANCELLED: 4001,
  USER_CANCEL: 4001,
  GESTURE_REQUIRED: 4001,
  ORIGIN_NOT_ALLOWED: 4100,
  WALLET_NOT_CONNECTED: 4100,
  NOT_SUPPORTED: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  CHAIN_UNSUPPORTED: 4902,
  NO_ADAPTER_REGISTERED: 4902,
  SIMULATION_FAILED: -32000,
  WALLET_ACTION_IN_PROGRESS: -32002,
  INVALID_PARAMETERS: -32602,
  INVALID_ARGUMENT: -32602,
  INTERNAL_ERROR: -32603,
};

/** Maps a native `CODE: detail` rejection onto the EIP-1193 error the dApp ecosystem expects. */
export function toProviderRpcError(raw: unknown): ProviderRpcError {
  const message = raw instanceof Error ? raw.message : String(raw ?? 'Unknown bridge error');
  const code = Object.keys(BRIDGE_CODE_TO_RPC).find((key) => message.includes(key));
  return new ProviderRpcError(code ? BRIDGE_CODE_TO_RPC[code] : -32603, message);
}

export class GoatWeb3Transport {
  private readonly pending = new Map<string, PendingRequest>();
  private counter = 0;
  private listenerAttached = false;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 120_000) {
    this.timeoutMs = timeoutMs;
  }

  private bridge(): NativeBridgeLike | undefined {
    if (typeof window === 'undefined') return undefined;
    const candidate = (window as any).nativeBridge;
    return candidate && typeof candidate.postMessage === 'function' ? candidate : undefined;
  }

  isAvailable(): boolean {
    return this.bridge() !== undefined;
  }

  private ensureListener(bridge: NativeBridgeLike): void {
    if (this.listenerAttached || typeof bridge.addEventListener !== 'function') return;
    this.listenerAttached = true;
    bridge.addEventListener('message', (event: { data: unknown }) => {
      let response: { id?: string; success?: boolean; data?: unknown; error?: string };
      try {
        response = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as any);
      } catch {
        return;
      }
      const id = response?.id;
      // Replies belonging to the page's own GoatBridge instance are not ours to resolve.
      if (typeof id !== 'string' || !id.startsWith(GOAT_WEB3_REQUEST_PREFIX)) return;

      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      clearTimeout(entry.timer);
      if (response.success) {
        entry.resolve(response.data ?? {});
      } else {
        entry.reject(toProviderRpcError(response.error));
      }
    });
  }

  call<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const bridge = this.bridge();
    if (!bridge) {
      return Promise.reject(new ProviderRpcError(4900, 'Goat wallet bridge unavailable'));
    }
    this.ensureListener(bridge);

    const id = `${GOAT_WEB3_REQUEST_PREFIX}${++this.counter}-${Date.now().toString(36)}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ProviderRpcError(-32603, `Bridge request '${action}' timed out`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        bridge.postMessage(JSON.stringify({ id, action, payload }));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(toProviderRpcError(err));
      }
    });
  }
}

/** Minimal EIP-1193 style event emitter, shared by all three injected providers. */
export class GoatEventEmitter {
  private readonly listeners = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, listener: (...args: any[]) => void): void {
    if (typeof listener !== 'function') return;
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    const wrapper = (...args: any[]) => {
      this.removeListener(event, wrapper);
      listener(...args);
    };
    this.on(event, wrapper);
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  removeAllListeners(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }

  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of Array.from(set)) {
      try {
        listener(...args);
      } catch {
        // A misbehaving dApp listener must not break the provider.
      }
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/** Deep-freezes provider metadata so a malicious script cannot rewrite it after announcement. */
export function deepFreeze<T>(value: T): T {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}
