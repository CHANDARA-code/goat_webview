/**
 * @goat/bridge-mock - Hermetic Browser Simulation Runtime Core
 */

import {
  BridgeRequest,
  BridgeResponse,
  TraceEnvelope,
} from './types.js';
import { GoatBridgeError, BridgeErrorCodes } from './errors.js';
import { mockState, MockStateManager } from './state/store.js';
import { eventBus, BridgeEventBus } from './transport/event-bus.js';
import { traceClient, GoatTraceWebSocketClient, WebSocketClientOptions } from './transport/websocket-client.js';
import {
  dispatchBridgeAction,
  SUPPORTED_ACTIONS,
  normalizeActionName,
} from './handlers/index.js';
import {
  biometricModal,
  scannerModal,
  permissionModal,
  externalLinkModal,
  BiometricModalSubsystem,
  ScannerModalSubsystem,
  PermissionModalSubsystem,
  ExternalLinkModalSubsystem,
} from './ui/index.js';

export interface GoatBridgeMockOptions {
  appId?: string;
  enableTraceWebSocket?: boolean;
  webSocketOptions?: WebSocketClientOptions;
  enforceUserGestureFreshness?: boolean;
  enforceDialogCooldown?: boolean;
}

export class GoatBridgeMock {
  public readonly appId: string;
  public readonly state: MockStateManager = mockState;
  public readonly events: BridgeEventBus = eventBus;
  public readonly tracer: GoatTraceWebSocketClient = traceClient;

  // UI Modals
  public readonly modals = {
    biometric: biometricModal,
    scanner: scannerModal,
    permission: permissionModal,
    externalLink: externalLinkModal,
  };

  private reqCounter: number = 0;

  constructor(options: GoatBridgeMockOptions = {}) {
    this.appId = options.appId || mockState.defaultAppId;
    mockState.defaultAppId = this.appId;

    if (options.enforceUserGestureFreshness) {
      mockState.enforceGestureFreshness = true;
    }
    if (options.enforceDialogCooldown) {
      mockState.enforceDialogCooldown = true;
    }

    if (options.enableTraceWebSocket) {
      this.tracer.connect();
    }
  }

  /**
   * Primary asynchronous IPC entrypoint for Mini-Apps
   */
  public async callNative<T = any>(action: string, payload: any = {}): Promise<T> {
    const callId = `req_${Date.now()}_${++this.reqCounter}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = Date.now();

    // Check CDP dynamic mock overrides from @goat/server
    const override = this.tracer.getMockOverride(action);
    if (override !== undefined) {
      const durationMs = Date.now() - startTime;
      this.recordTrace(callId, action, payload, { code: 200, message: 'SUCCESS', data: override }, undefined, durationMs);
      return override as T;
    }

    try {
      const data = await dispatchBridgeAction(action, payload, this.appId);
      const durationMs = Date.now() - startTime;

      this.recordTrace(callId, action, payload, { code: 200, message: 'SUCCESS', data }, undefined, durationMs);
      return data as T;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorCode = err instanceof GoatBridgeError ? err.code : BridgeErrorCodes.NATIVE_EXECUTION_ERROR;
      const errorMsg = err?.message || String(err);

      this.recordTrace(
        callId,
        action,
        payload,
        undefined,
        { code: errorCode, message: errorMsg, details: err?.details },
        durationMs
      );

      if (err instanceof GoatBridgeError) {
        throw err;
      }
      throw new GoatBridgeError(errorCode, errorMsg, { originalError: err });
    }
  }

  /**
   * Low-level postMessage entrypoint matching Android / iOS bridge interfaces
   */
  public postMessage(message: string | BridgeRequest): void {
    let req: BridgeRequest;
    try {
      req = typeof message === 'string' ? JSON.parse(message) : message;
    } catch {
      console.error('[GoatBridgeMock] Invalid JSON in postMessage:', message);
      return;
    }

    const id = req.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const action = req.action;
    const payload = req.payload || req.params || {};

    this.callNative(action, payload)
      .then((data) => {
        const res: BridgeResponse = {
          id,
          success: true,
          data,
          code: 200,
        };
        this.replyPostMessage(res);
      })
      .catch((err) => {
        const res: BridgeResponse = {
          id,
          success: false,
          error: err?.message || 'Bridge execution failed',
          code: err instanceof GoatBridgeError ? 400 : 500,
        };
        this.replyPostMessage(res);
      });
  }

  private replyPostMessage(res: BridgeResponse): void {
    if (typeof window !== 'undefined') {
      // 1. Dispatch custom window event
      try {
        const event = new CustomEvent('goatBridgeResponse', { detail: res });
        window.dispatchEvent(event);
      } catch {}

      // 2. Dispatch message event on window if listeners exist
      try {
        window.postMessage({ type: 'goatBridgeResponse', ...res }, '*');
      } catch {}
    }
  }

  /**
   * Subscribe to native events
   */
  public on(event: string, handler: (payload: any) => void): () => void {
    return this.events.on(event, handler);
  }

  /**
   * Emit native events
   */
  public emit(event: string, payload: any): void {
    this.events.emit(event, payload);
  }

  /**
   * Check if action is supported
   */
  public canIUse(action: string): boolean {
    const norm = normalizeActionName(action);
    return SUPPORTED_ACTIONS.has(norm) || mockState.dynamicCapabilities.has(norm);
  }

  /**
   * Record IPC Trace Envelope
   */
  private recordTrace(
    callId: string,
    action: string,
    params: any,
    response?: { code: number; message: string; data?: any },
    error?: { code: string; message: string; details?: any },
    durationMs: number = 0
  ): void {
    const envelope: TraceEnvelope = {
      callId,
      appId: this.appId,
      action: normalizeActionName(action),
      params: params || {},
      response,
      error,
      durationMs,
      timestamp: Date.now(),
      thread: 'mock-main-thread',
    };

    this.tracer.sendTrace(envelope);
  }
}
