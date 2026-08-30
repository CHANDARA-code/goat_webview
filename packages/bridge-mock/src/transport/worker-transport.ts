/**
 * @goat/bridge-mock - Hermetic Worker Bridge Mock Transport
 * Enables @goat/appservice Worker runtime and headless tests to execute
 * against all 197 actions across 18 domains without a browser DOM or native host.
 */

import { GoatBridgeMock, GoatBridgeMockOptions } from '../runtime.js';
import { mockState, MockStateManager } from '../state/store.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export interface HermeticWorkerBridgeMockTransportOptions extends GoatBridgeMockOptions {
  bridgeMock?: GoatBridgeMock;
  delayMs?: number;
}

export interface WorkerBridgeCallFrame<T = any> {
  id?: string;
  callId?: string;
  type?: string; // 'BRIDGE_CALL' | 'BRIDGE_REQUEST'
  action: string;
  payload?: T;
  params?: T;
  seqId?: number;
  seq?: number;
  domain?: string;
  timestamp?: number;
}

export interface WorkerBridgeReplyFrame<T = any> {
  id: string;
  callId?: string;
  type: string; // 'BRIDGE_REPLY' | 'BRIDGE_RESPONSE'
  action: string;
  success: boolean;
  data?: T;
  error?: {
    code: string | number;
    message: string;
    details?: unknown;
  };
  seqId?: number;
  seq?: number;
  timestamp: number;
  durationMs: number;
}

export interface DispatchedCallRecord {
  callId: string;
  action: string;
  payload?: any;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export class HermeticWorkerBridgeMockTransport {
  public readonly bridgeMock: GoatBridgeMock;
  public readonly state: MockStateManager;
  public delayMs: number = 0;
  public errorInjectionAction?: string;
  public dispatchedActions: string[] = [];
  public dispatchedCalls: DispatchedCallRecord[] = [];

  private attachedCleanups: Set<() => void> = new Set();

  constructor(options: HermeticWorkerBridgeMockTransportOptions = {}) {
    this.bridgeMock = options.bridgeMock || new GoatBridgeMock(options);
    this.state = this.bridgeMock.state;
    this.delayMs = options.delayMs || 0;
  }

  /**
   * Direct dispatch contract compatible with AppViewBridgeForwarder & HostDispatcher
   */
  public async dispatch(call: {
    callId?: string;
    id?: string;
    action: string;
    payload?: Record<string, unknown>;
    params?: Record<string, unknown>;
    domain?: string;
    seq?: number;
    seqId?: number;
  }): Promise<{
    callId: string;
    action: string;
    success: boolean;
    data?: unknown;
    error?: { code: string | number; message: string; details?: unknown };
    durationMs: number;
  }> {
    const startTime = Date.now();
    const action = call.action;
    const callId = call.callId || call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = call.payload || call.params || {};

    this.dispatchedActions.push(action);

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Injected error simulation for fault-tolerance / resilience testing
    if (this.errorInjectionAction && (this.errorInjectionAction === action || this.errorInjectionAction === '*')) {
      const durationMs = Date.now() - startTime;
      const errorObj = {
        code: BridgeErrorCodes.NATIVE_EXECUTION_ERROR || 'HOST_ERROR_INJECTED',
        message: `Simulated host error for ${action}`,
      };
      this.dispatchedCalls.push({
        callId,
        action,
        payload,
        timestamp: startTime,
        durationMs,
        success: false,
        error: errorObj.message,
      });
      return {
        callId,
        action,
        success: false,
        error: errorObj,
        durationMs,
      };
    }

    try {
      const data = await this.bridgeMock.callNative(action, payload);
      const durationMs = Date.now() - startTime;
      this.dispatchedCalls.push({
        callId,
        action,
        payload,
        timestamp: startTime,
        durationMs,
        success: true,
      });
      return {
        callId,
        action,
        success: true,
        data,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const code = err instanceof GoatBridgeError ? err.code : (err?.code || BridgeErrorCodes.NATIVE_EXECUTION_ERROR || 500);
      const message = err?.message || String(err);
      const details = err?.details;

      this.dispatchedCalls.push({
        callId,
        action,
        payload,
        timestamp: startTime,
        durationMs,
        success: false,
        error: message,
      });

      return {
        callId,
        action,
        success: false,
        error: { code, message, details },
        durationMs,
      };
    }
  }

  /**
   * Attaches an AppService Worker port / MessagePort / EventEmitter / IpcChannel
   * to automatically intercept BRIDGE_CALL messages and reply with BRIDGE_REPLY.
   */
  public attachWorkerPort(port: any): () => void {
    if (!port) return () => {};

    const messageHandler = async (event: any) => {
      const msg = (event && event.data !== undefined) ? event.data : event;
      if (!msg || typeof msg !== 'object') return;

      const isBridgeCall =
        msg.type === 'BRIDGE_CALL' ||
        msg.type === 'BRIDGE_REQUEST' ||
        (msg.action && typeof msg.action === 'string');

      if (!isBridgeCall) return;

      const callId = msg.callId || msg.id || (msg.payload && msg.payload.callId);
      const action = msg.action || (msg.payload && msg.payload.action);
      const payload = msg.payload?.payload !== undefined ? msg.payload.payload : (msg.payload || msg.params || {});
      const seqId = msg.seqId ?? msg.seq;

      if (!action) return;

      const reply = await this.dispatch({
        callId,
        action,
        payload,
        domain: msg.domain || msg.payload?.domain,
      });

      const replyFrame: WorkerBridgeReplyFrame = {
        id: callId || reply.callId,
        callId: reply.callId,
        type: 'BRIDGE_REPLY',
        action: reply.action,
        success: reply.success,
        data: reply.data,
        error: reply.error,
        seqId,
        seq: seqId,
        timestamp: Date.now(),
        durationMs: reply.durationMs,
      };

      if (typeof port.postMessage === 'function') {
        port.postMessage(replyFrame);
      } else if (typeof port.send === 'function') {
        port.send('BRIDGE_REPLY', reply);
      } else if (typeof port.emit === 'function') {
        port.emit('message', replyFrame);
        port.emit('BRIDGE_REPLY', replyFrame);
      }
    };

    let cleanup: () => void;

    if (typeof port.addEventListener === 'function') {
      port.addEventListener('message', messageHandler);
      cleanup = () => {
        try {
          port.removeEventListener('message', messageHandler);
        } catch {}
      };
    } else if (typeof port.on === 'function') {
      port.on('message', messageHandler);
      port.on('BRIDGE_CALL', messageHandler);
      cleanup = () => {
        try {
          if (typeof port.off === 'function') {
            port.off('message', messageHandler);
            port.off('BRIDGE_CALL', messageHandler);
          } else if (typeof port.removeListener === 'function') {
            port.removeListener('message', messageHandler);
            port.removeListener('BRIDGE_CALL', messageHandler);
          }
        } catch {}
      };
    } else {
      const prevOnMessage = port.onmessage;
      port.onmessage = messageHandler;
      cleanup = () => {
        if (port.onmessage === messageHandler) {
          port.onmessage = prevOnMessage || null;
        }
      };
    }

    this.attachedCleanups.add(cleanup);
    return () => {
      this.attachedCleanups.delete(cleanup);
      cleanup();
    };
  }

  /**
   * Resets transport state, call history, and error injections.
   */
  public clear(): void {
    this.dispatchedActions = [];
    this.dispatchedCalls = [];
    this.delayMs = 0;
    this.errorInjectionAction = undefined;
  }

  /**
   * Disposes transport and all attached port listeners.
   */
  public dispose(): void {
    this.clear();
    for (const cleanup of Array.from(this.attachedCleanups)) {
      try {
        cleanup();
      } catch {}
    }
    this.attachedCleanups.clear();
  }
}
