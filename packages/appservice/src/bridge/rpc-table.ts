import { BridgeError } from '../types.js';
import { PendingRpcEntry } from './types.js';

export class GoatBridgeError extends Error {
  public readonly code: string | number;
  public readonly details?: unknown;

  constructor(code: string | number, message: string, details?: unknown) {
    super(message);
    this.name = 'GoatBridgeError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, GoatBridgeError.prototype);
  }
}

export class RpcPromiseTable {
  private readonly pendingMap = new Map<string, PendingRpcEntry<any>>();
  private defaultTimeoutMs: number = 15000;

  constructor(defaultTimeoutMs: number = 15000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  public register<T = unknown>(
    callId: string,
    action: string,
    resolve: (value: T) => void,
    reject: (reason: Error | BridgeError) => void,
    customTimeoutMs?: number
  ): void {
    const timeoutMs = customTimeoutMs || this.defaultTimeoutMs;
    const timer = setTimeout(() => {
      this.handleTimeout(callId);
    }, timeoutMs);

    this.pendingMap.set(callId, {
      callId,
      action,
      startTime: Date.now(),
      timeoutMs,
      timer,
      resolve,
      reject,
    });
  }

  public resolve(callId: string, data: unknown): boolean {
    const entry = this.pendingMap.get(callId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    this.pendingMap.delete(callId);
    entry.resolve(data);
    return true;
  }

  public reject(callId: string, error: BridgeError): boolean {
    const entry = this.pendingMap.get(callId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    this.pendingMap.delete(callId);
    // Reject with GoatBridgeError or structured error
    entry.reject(new GoatBridgeError(error.code, error.message, error.details));
    return true;
  }

  private handleTimeout(callId: string): void {
    const entry = this.pendingMap.get(callId);
    if (!entry) return;

    this.pendingMap.delete(callId);
    entry.reject(
      new GoatBridgeError(
        'BRIDGE_TIMEOUT',
        `GoatBridge call to action '${entry.action}' timed out after ${entry.timeoutMs}ms`,
        { callId, action: entry.action, timeoutMs: entry.timeoutMs }
      )
    );
  }

  public clearAll(reason: string = 'Bridge destroyed'): void {
    for (const [callId, entry] of this.pendingMap.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new GoatBridgeError('BRIDGE_DISPOSED', reason, { callId }));
    }
    this.pendingMap.clear();
  }

  public get pendingCount(): number {
    return this.pendingMap.size;
  }
}
