/**
 * @goat/devtools - Dual-Thread Runtime Service
 * Wraps @goat/appservice (AppServiceWorkerContainer + AppViewDomRenderer)
 * and @goat/bridge-mock (HermeticWorkerBridgeMockTransport) for high-performance
 * 60fps simulation, live VDOM diffing, and hot code reloading.
 */

import {
  AppServiceWorkerContainer,
  AppViewDomRenderer,
  IpcChannel,
  TelemetryRelay,
  HostDispatcher,
  VDomEngine,
} from '@goat/appservice';
import type {
  VNode,
  UiEventPayload,
  BridgeCallPayload,
  BridgeReplyPayload,
  LifecyclePayload,
  TelemetryTraceEvent,
  ThreadLane,
  VDomPatch,
} from '@goat/appservice';
import {
  HermeticWorkerBridgeMockTransport,
  mockState,
  GoatBridgeMock,
} from '@goat/bridge-mock';
import type { FrameRateMetrics } from '../types/index.ts';

export interface RuntimeServiceOptions {
  appId?: string;
  batchIntervalMs?: number;
  containerElement?: HTMLElement | null;
  onLog?: (log: { thread: 'AppService' | 'AppView' | 'GoatHost'; level: 'log' | 'info' | 'warn' | 'error'; message: string; data?: any; timestamp: number }) => void;
  onTrace?: (trace: { id: string; action: string; domain: string; durationMs: number; status: 'success' | 'error' | 'pending'; payload?: any; response?: any; timestamp: number }) => void;
  onMetrics?: (metrics: FrameRateMetrics) => void;
}

export class DualThreadRuntimeService {
  public appId: string;
  public ipc: IpcChannel;
  public worker: AppServiceWorkerContainer;
  public renderer: AppViewDomRenderer;
  public telemetry: TelemetryRelay;
  public bridgeTransport: HermeticWorkerBridgeMockTransport;
  public hostDispatcher: HostDispatcher;

  private containerElement: HTMLElement | null = null;
  private onLogCallback?: RuntimeServiceOptions['onLog'];
  private onTraceCallback?: RuntimeServiceOptions['onTrace'];
  private onMetricsCallback?: RuntimeServiceOptions['onMetrics'];

  private fpsMetrics: FrameRateMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    droppedFrames: 0,
    vdomPatchCount: 0,
    lastUpdated: Date.now(),
  };

  private frameTimes: number[] = [];
  private lastFrameTimestamp: number = performance.now();
  private isDestroyed: boolean = false;
  private animFrameId: number | null = null;
  private metricsIntervalId: any = null;

  constructor(options: RuntimeServiceOptions = {}) {
    this.appId = options.appId || 'goat-miniapp-sim';
    const batchIntervalMs = options.batchIntervalMs ?? 16;

    this.containerElement = options.containerElement || null;
    this.onLogCallback = options.onLog;
    this.onTraceCallback = options.onTrace;
    this.onMetricsCallback = options.onMetrics;

    // 1. Initialize IPC Channel with 60fps frame batching
    this.ipc = new IpcChannel('appservice', undefined, { batchIntervalMs });

    // 2. Initialize Telemetry & Mock Transports
    this.telemetry = new TelemetryRelay();
    this.hostDispatcher = new HostDispatcher(this.telemetry);
    this.bridgeTransport = new HermeticWorkerBridgeMockTransport({ delayMs: 0 });

    // 3. Initialize Worker Container & DOM Renderer
    this.worker = new AppServiceWorkerContainer(this.appId, this.ipc);
    this.renderer = new AppViewDomRenderer(this.containerElement, this.ipc);

    this.wireIpcPipelines();
    this.startTelemetryLoop();
  }

  /**
   * Mounts or switches target DOM container for AppViewDomRenderer
   */
  public mountRenderer(container: HTMLElement | null): void {
    this.containerElement = container;
    (this.renderer as any).container = container;
  }

  /**
   * Wires IPC message pipelines: Lifecycle, Bridge RPC, UI Events, Telemetry
   */
  private wireIpcPipelines(): void {
    // 1. Bridge RPC: Intercept BRIDGE_CALL and execute via HermeticWorkerBridgeMockTransport
    this.ipc.on('BRIDGE_CALL', async (frame) => {
      const call = frame.payload as BridgeCallPayload;
      const startTime = performance.now();
      const callId = call.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Telemetry: AppService call span
      this.telemetry.recordSpan({
        traceId: `trace_${callId}`,
        spanId: `span_worker_${Date.now()}`,
        threadLane: 'AppService',
        name: `bridgeCall:${call.action}`,
        seqId: frame.seq,
        callId,
        timestamp: Date.now(),
      });

      this.log('AppService', 'log', `GoatBridge.call("${call.action}")`, call.payload);

      // Telemetry: AppView forwarding span
      this.telemetry.recordSpan({
        traceId: `trace_${callId}`,
        spanId: `span_appview_fwd_${Date.now()}`,
        threadLane: 'AppView',
        name: `forwardBridgeCall:${call.action}`,
        seqId: frame.seq,
        callId,
        timestamp: Date.now(),
      });

      // Dispatch to Mock Transport
      const reply = await this.bridgeTransport.dispatch({
        callId,
        action: call.action,
        payload: call.payload,
        domain: (call as any).domain,
      });

      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      // Telemetry: Host Reply & AppView Relay spans
      this.telemetry.recordSpan({
        traceId: `trace_${callId}`,
        spanId: `span_host_reply_${Date.now()}`,
        threadLane: 'Host',
        name: `hostExecute:${call.action}`,
        seqId: frame.seq,
        callId,
        timestamp: Date.now(),
        durationMs,
      });

      // Reply back to worker
      const replyFrame: BridgeReplyPayload = {
        callId,
        action: call.action,
        success: reply.success,
        data: reply.data,
        error: reply.error as any,
        durationMs,
      };

      this.ipc.send('BRIDGE_REPLY', replyFrame);

      if (reply.success) {
        this.log('GoatHost', 'info', `Bridge [${call.action}] resolved (${durationMs}ms)`, reply.data);
      } else {
        this.log('GoatHost', 'error', `Bridge [${call.action}] failed: ${reply.error?.message}`, reply.error);
      }

      if (this.onTraceCallback) {
        this.onTraceCallback({
          id: callId,
          action: call.action,
          domain: (call as any).domain || 'System',
          durationMs,
          status: reply.success ? 'success' : 'error',
          payload: call.payload,
          response: reply.data || reply.error,
          timestamp: Date.now(),
        });
      }
    });

    // 2. UI Event Pipeline: Renderer → Worker
    this.ipc.on('UI_EVENT', (frame) => {
      const event = frame.payload as UiEventPayload;
      const nodeId = event.nodeId || event.target?.id || 'unknown';
      this.telemetry.recordSpan({
        traceId: `trace_event_${event.eventId}`,
        spanId: `span_worker_event_${Date.now()}`,
        threadLane: 'AppService',
        name: `uiEvent:${event.eventType}`,
        seqId: frame.seq,
        timestamp: Date.now(),
      });
      this.log('AppView', 'log', `UI Event [${event.eventType}] dispatched from element #${nodeId}`);
      this.worker.handleUiEvent(event);
    });

    // 3. Lifecycle Pipeline
    this.ipc.on('LIFECYCLE', (frame) => {
      const payload = frame.payload as LifecyclePayload;
      if (payload && payload.event) {
        this.log('AppService', 'info', `Lifecycle event: ${payload.event}`);
      }
    });

    // 4. UI Patch Pipeline: Monitor VDOM patch count
    this.ipc.on('UI_PATCH', (frame) => {
      const patches = (frame.payload as any)?.patches || [];
      this.fpsMetrics.vdomPatchCount += patches.length;
      this.fpsMetrics.lastUpdated = Date.now();
    });
  }

  /**
   * Evaluates mini-app code bundle with safe error handling and hot reload
   */
  public evaluateCode(code: string, isBundle: boolean = true): { success: boolean; error?: string } {
    try {
      if (isBundle) {
        this.worker.loadBundle(code);
      } else {
        this.worker.evaluateScript(code);
      }
      this.log('AppService', 'info', 'Mini-app bundle evaluated successfully');
      return { success: true };
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('AppService', 'error', `Bundle execution error: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Sets reactive data and calculates VDOM diff
   */
  public setData(
    partialData: Record<string, unknown>,
    renderTreeFn?: (data: Record<string, unknown>) => VNode
  ): void {
    this.worker.setData(partialData, renderTreeFn);
  }

  /**
   * Dispatches a simulated UI event (click, tap, input) into the dual-thread runtime
   */
  public dispatchUiEvent(eventType: string, targetNodeId: string, eventData: Record<string, unknown> = {}): void {
    const payload: UiEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      nodeId: targetNodeId,
      target: { id: targetNodeId },
      timestamp: Date.now(),
      detail: eventData,
    };
    this.ipc.send('UI_EVENT', payload);
  }

  /**
   * Starts telemetry frame rate monitoring loop (measures 60fps rendering)
   */
  private startTelemetryLoop(): void {
    let frameCount = 0;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      if (this.isDestroyed) return;

      const delta = timestamp - this.lastFrameTimestamp;
      this.lastFrameTimestamp = timestamp;

      this.frameTimes.push(delta);
      if (this.frameTimes.length > 30) {
        this.frameTimes.shift();
      }

      if (delta > 24) {
        this.fpsMetrics.droppedFrames++;
      }

      frameCount++;
      const elapsed = timestamp - lastTime;

      if (elapsed >= 500) {
        const computedFps = Math.round((frameCount * 1000) / elapsed);
        const avgFrameTime =
          this.frameTimes.length > 0
            ? Math.round((this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length) * 10) / 10
            : 16.6;

        this.fpsMetrics.fps = Math.min(60, Math.max(1, computedFps));
        this.fpsMetrics.frameTimeMs = avgFrameTime;
        this.fpsMetrics.lastUpdated = Date.now();

        if (this.onMetricsCallback) {
          this.onMetricsCallback({ ...this.fpsMetrics });
        }

        frameCount = 0;
        lastTime = timestamp;
      }

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        this.animFrameId = window.requestAnimationFrame(loop);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.animFrameId = window.requestAnimationFrame(loop);
    } else {
      // Fallback for Node/JSDOM test environments
      this.metricsIntervalId = setInterval(() => {
        if (this.isDestroyed) return;
        this.fpsMetrics.fps = 60;
        this.fpsMetrics.frameTimeMs = 16.6;
        this.fpsMetrics.lastUpdated = Date.now();
        if (this.onMetricsCallback) {
          this.onMetricsCallback({ ...this.fpsMetrics });
        }
      }, 500);
    }
  }

  /**
   * Internal logging helper
   */
  private log(
    thread: 'AppService' | 'AppView' | 'GoatHost',
    level: 'log' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    if (this.onLogCallback) {
      this.onLogCallback({
        thread,
        level,
        message,
        data,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Gets current live Virtual DOM Tree
   */
  public getDomTree(): VNode | null {
    return this.renderer.domTree || this.worker.currentVTree;
  }

  /**
   * Finds a VNode in live DOM tree by ID
   */
  public findVNodeById(nodeId: string): VNode | null {
    return this.renderer.findVNodeById(this.getDomTree(), nodeId);
  }

  /**
   * Current metrics snapshot
   */
  public getMetrics(): FrameRateMetrics {
    return { ...this.fpsMetrics };
  }

  /**
   * Pauses runtime safely
   */
  public pause(): void {
    if (this.worker.state === 'RUNNING') {
      this.worker.suspend();
      this.log('AppService', 'info', 'Mini-App runtime suspended (paused)');
    }
  }

  /**
   * Resumes runtime safely
   */
  public resume(): void {
    if (this.worker.state === 'SUSPENDED') {
      this.worker.resume();
      this.log('AppService', 'info', 'Mini-App runtime resumed');
    }
  }

  /**
   * Restarts runtime with clean state
   */
  public restart(): void {
    this.worker.destroy();
    this.ipc.clear();
    this.telemetry.clear();
    this.bridgeTransport.clear();

    this.worker = new AppServiceWorkerContainer(this.appId, this.ipc);
    this.renderer = new AppViewDomRenderer(this.containerElement, this.ipc);

    this.wireIpcPipelines();
    this.log('AppService', 'info', 'Dual-thread runtime initialized and ready');
  }

  /**
   * Destroys runtime and releases listeners and intervals
   */
  public destroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }
    this.worker.destroy();
    this.ipc.clear();
    this.telemetry.clear();
    this.bridgeTransport.dispose();
  }
}

/**
 * Creates and initializes a DualThreadRuntimeService instance
 */
export function createDualThreadRuntime(options: RuntimeServiceOptions = {}): DualThreadRuntimeService {
  return new DualThreadRuntimeService(options);
}
