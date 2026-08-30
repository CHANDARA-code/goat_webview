/**
 * @goat/bridge-mock - Real-time WebSocket Trace Client
 * Streams bridge IPC call telemetry to @goat/server (CDP DevTools relay and trace DB).
 */

import { TraceEnvelope } from '../types.js';
import { mockState } from '../state/store.js';

export interface WebSocketClientOptions {
  url?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
}

export class GoatTraceWebSocketClient {
  private url: string;
  private ws: any = null;
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectIntervalMs: number;
  private messageQueue: string[] = [];
  private mockOverrides: Map<string, any> = new Map();

  constructor(options: WebSocketClientOptions = {}) {
    this.url = options.url || 'ws://localhost:9222/traces';
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? 2000;

    if (options.autoConnect) {
      this.connect();
    }
  }

  public connect(): void {
    if (this.isDestroyed || this.isConnecting || (this.ws && this.ws.readyState === 1)) {
      return;
    }

    const WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket;
    if (!WebSocketImpl) {
      // WebSocket not available in environment, trace logging will be in-memory only
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocketImpl(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.flushQueue();
      };

      this.ws.onmessage = (event: any) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          this.handleIncomingMessage(data);
        } catch {
          // Ignore invalid messages
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        if (!this.isDestroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectIntervalMs);
        }
      };
    } catch {
      this.isConnecting = false;
    }
  }

  public disconnect(): void {
    this.isDestroyed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
  }

  public sendTrace(envelope: TraceEnvelope): void {
    mockState.traces.push(envelope);

    const message = JSON.stringify({
      type: 'trace',
      data: envelope,
    });

    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(message);
      } catch {
        this.messageQueue.push(message);
      }
    } else {
      if (this.messageQueue.length < 500) {
        this.messageQueue.push(message);
      }
    }
  }

  public setMockResponse(action: string, response: any): void {
    this.mockOverrides.set(action.toUpperCase(), response);
  }

  public getMockOverride(action: string): any | undefined {
    return this.mockOverrides.get(action.toUpperCase());
  }

  public clearMockOverrides(): void {
    this.mockOverrides.clear();
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    // Handle CDP GoatBridge.setMockResponse
    if (msg.method === 'GoatBridge.setMockResponse' && msg.params) {
      const { action, mockResult, overrideState } = msg.params;
      if (action) {
        this.setMockResponse(action, mockResult);
      }
      if (overrideState && typeof overrideState === 'object') {
        Object.assign(mockState, overrideState);
      }
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== 1) return;
    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift();
      if (item) {
        try {
          this.ws.send(item);
        } catch {
          this.messageQueue.unshift(item);
          break;
        }
      }
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1;
  }
}

export const traceClient = new GoatTraceWebSocketClient({ autoConnect: false });
