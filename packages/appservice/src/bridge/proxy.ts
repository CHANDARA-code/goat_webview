import { IpcChannel } from '../ipc/channel.js';
import { RpcPromiseTable } from './rpc-table.js';
import { BridgeCallPayload, BridgeReplyPayload } from '../types.js';

export class GoatBridgeClient {
  public readonly appId: string;
  private readonly ipc: IpcChannel;
  public readonly rpcTable: RpcPromiseTable;
  private callCounter: number = 0;
  private readonly eventListeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(appId: string, ipc: IpcChannel, defaultTimeoutMs: number = 15000) {
    this.appId = appId;
    this.ipc = ipc;
    this.rpcTable = new RpcPromiseTable(defaultTimeoutMs);
  }

  public async call<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<T> {
    return this.callNative<T>(action, payload, timeoutMs);
  }

  public async callNative<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<T> {
    const callId = `call_${Date.now()}_${++this.callCounter}_${Math.random().toString(36).substring(2, 7)}`;
    const domain = action.includes('.') ? action.split('.')[0] : undefined;

    const callPayload: BridgeCallPayload = {
      callId,
      action,
      payload,
      domain,
      timeoutMs,
    };

    return new Promise<T>((resolve, reject) => {
      this.rpcTable.register<T>(callId, action, resolve, reject, timeoutMs);

      // Send BRIDGE_CALL frame immediately (bypass render batching)
      this.ipc.sendImmediate('BRIDGE_CALL', callPayload);
    });
  }

  public handleReply(reply: BridgeReplyPayload): void {
    if (reply.success) {
      this.rpcTable.resolve(reply.callId, reply.data);
    } else {
      this.rpcTable.reject(
        reply.callId,
        reply.error || { code: 'NATIVE_ERROR', message: 'Unknown native bridge error' }
      );
    }
  }

  public on(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: (payload: unknown) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  public emit(event: string, payload: unknown): void {
    this.eventListeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[GoatBridgeClient] Error in event listener for ${event}:`, err);
      }
    });
  }

  public dispose(): void {
    this.rpcTable.clearAll('GoatBridgeClient disposed');
    this.eventListeners.clear();
  }
}
