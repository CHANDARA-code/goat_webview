import {
  BridgeCallPayload,
  BridgeReplyPayload,
  HostSignalEvent,
  LifecyclePayload,
  TelemetryTraceEvent,
  ThreadLane,
  UiEventPayload,
  UiPatchPayload,
  VDomPatch,
  VNode,
} from '../types.js';
import { IpcChannel } from '../ipc/channel.js';
import { VDomEngine } from '../vdom/index.js';
import { AppServiceWorkerContainer } from '../worker/container.js';
import { AppViewDomRenderer } from '../renderer/dom-renderer.js';

export { VDomEngine };

export class HostDispatcher {
  public platform: 'android' | 'ios' | 'flutter' | 'react-native' | 'mock' = 'mock';
  public memoryStorage = new Map<string, unknown>();
  public lifecycleEvents: HostSignalEvent[] = [];
  public dispatchedActions: string[] = [];
  public delayMs: number = 0;
  public errorInjectionAction?: string;
  public telemetry?: TelemetryRelay;

  constructor(telemetry?: TelemetryRelay) {
    this.telemetry = telemetry;
  }

  public async dispatch(call: BridgeCallPayload): Promise<BridgeReplyPayload> {
    const startTime = Date.now();
    this.dispatchedActions.push(call.action);

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    if (this.telemetry) {
      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_host_${Date.now()}`,
        threadLane: 'Host',
        name: `executeHostAction:${call.action}`,
        seqId: 0,
        callId: call.callId,
        timestamp: startTime,
      });
    }

    if (this.errorInjectionAction === call.action) {
      return {
        callId: call.callId,
        action: call.action,
        success: false,
        error: { code: 'HOST_ERROR_INJECTED', message: `Simulated host error for ${call.action}` },
        durationMs: Date.now() - startTime,
      };
    }

    const { action, payload, callId } = call;

    if (action === 'storage.set' || action === 'setStorage') {
      this.memoryStorage.set(String(payload.key), payload.value);
      return { callId, action, success: true, data: { success: true }, durationMs: Date.now() - startTime };
    }
    if (action === 'storage.get' || action === 'getStorage') {
      const value = this.memoryStorage.get(String(payload.key));
      return { callId, action, success: true, data: { value }, durationMs: Date.now() - startTime };
    }
    if (action === 'storage.remove' || action === 'removeStorage') {
      this.memoryStorage.delete(String(payload.key));
      return { callId, action, success: true, data: { success: true }, durationMs: Date.now() - startTime };
    }
    if (action === 'location.getCurrent' || action === 'getLocation') {
      return {
        callId,
        action,
        success: true,
        data: { latitude: 37.7749, longitude: -122.4194, accuracy: 5.0 },
        durationMs: Date.now() - startTime,
      };
    }
    if (action === 'network.request' || action === 'request') {
      return {
        callId,
        action,
        success: true,
        data: { status: 200, data: { message: 'Mock HTTP response', url: payload.url } },
        durationMs: Date.now() - startTime,
      };
    }
    if (action === 'navigation.navigateTo' || action === 'navigateTo') {
      return {
        callId,
        action,
        success: true,
        data: { navigatedTo: payload.url || payload.path },
        durationMs: Date.now() - startTime,
      };
    }
    if (action === 'ui.showToast' || action === 'showToast') {
      return { callId, action, success: true, data: { shown: true }, durationMs: Date.now() - startTime };
    }

    return {
      callId,
      action,
      success: true,
      data: { mockExecuted: true, action, payload },
      durationMs: Date.now() - startTime,
    };
  }

  public recordLifecycleEvent(event: HostSignalEvent): void {
    this.lifecycleEvents.push(event);
  }

  public clear(): void {
    this.memoryStorage.clear();
    this.lifecycleEvents = [];
    this.dispatchedActions = [];
    this.delayMs = 0;
    this.errorInjectionAction = undefined;
  }
}

export class TelemetryRelay {
  public traces: TelemetryTraceEvent[] = [];

  public recordSpan(span: TelemetryTraceEvent): void {
    this.traces.push(span);
  }

  public getTraceWaterfall(traceId: string): TelemetryTraceEvent[] {
    return this.traces
      .filter((t) => t.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public getTracesByLane(lane: ThreadLane): TelemetryTraceEvent[] {
    return this.traces.filter((t) => t.threadLane === lane);
  }

  public clear(): void {
    this.traces = [];
  }
}

export class DualThreadTestEnvironment {
  public ipc: IpcChannel;
  public telemetry: TelemetryRelay;
  public host: HostDispatcher;
  public worker: AppServiceWorkerContainer;
  public appView: AppViewDomRenderer;

  constructor(appId: string = 'mini_app_test_1', batchIntervalMs: number = 16) {
    this.ipc = new IpcChannel('appservice', undefined, { batchIntervalMs });
    this.telemetry = new TelemetryRelay();
    this.host = new HostDispatcher(this.telemetry);
    this.worker = new AppServiceWorkerContainer(appId, this.ipc);
    this.appView = new AppViewDomRenderer(null, this.ipc);

    // Wire worker lifecycle events to host
    this.ipc.on('LIFECYCLE', (frame) => {
      const payload = frame.payload as LifecyclePayload;
      if (payload.event) {
        this.host.recordLifecycleEvent({
          event: payload.event as any,
          timestamp: payload.timestamp,
          appId: payload.appId,
          details: payload.details,
        });
      }
    });

    // Wire BRIDGE_CALL to host dispatcher
    this.ipc.on('BRIDGE_CALL', async (frame) => {
      const call = frame.payload as BridgeCallPayload;
      const startTime = Date.now();

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_worker_call_${startTime}`,
        threadLane: 'AppService',
        name: `bridgeCall:${call.action}`,
        seqId: frame.seq,
        callId: call.callId,
        timestamp: startTime,
      });

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_appview_fwd_${Date.now()}`,
        threadLane: 'AppView',
        name: `forwardToHost:${call.action}`,
        seqId: frame.seq,
        callId: call.callId,
        timestamp: Date.now(),
      });

      const reply = await this.host.dispatch(call);

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_appview_reply_${Date.now()}`,
        threadLane: 'AppView',
        name: `replyFromHost:${call.action}`,
        seqId: frame.seq,
        callId: call.callId,
        timestamp: Date.now(),
      });

      const replyFrame = this.ipc.send('BRIDGE_REPLY', reply);
      const recvTime = Date.now();

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_worker_recv_${recvTime}`,
        threadLane: 'AppService',
        name: `bridgeReply:${call.action}`,
        seqId: replyFrame.seq,
        callId: call.callId,
        timestamp: recvTime,
        durationMs: reply.durationMs,
      });
    });

    // Wire UI_EVENT telemetry
    this.ipc.on('UI_EVENT', (frame) => {
      const event = frame.payload as UiEventPayload;
      this.telemetry.recordSpan({
        traceId: `trace_event_${event.eventId}`,
        spanId: `span_worker_event_${Date.now()}`,
        threadLane: 'AppService',
        name: `uiEvent:${event.eventType}`,
        seqId: frame.seq,
        timestamp: Date.now(),
      });
    });
  }

  public destroy(): void {
    this.worker.destroy();
    this.ipc.clear();
    this.telemetry.clear();
    this.host.clear();
  }
}
