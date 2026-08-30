/**
 * Hermetic Dual-Thread Mini-App Engine Simulator & Test Harness
 * Simulates Worker context (AppService), DOM render thread (AppView),
 * Bidirectional 16ms Frame-Aligned IPC Channel, and Multi-Platform Native Hosts.
 */

import type {
  BridgeCallPayload,
  BridgeError,
  BridgeReplyPayload,
  HostSignalEvent,
  IpcMessageFrame,
  IpcMessageType,
  LifecyclePayload,
  LifecycleSignal,
  LifecycleState,
  PatchType,
  TelemetryTraceEvent,
  ThreadLane,
  UiEventPayload,
  UiPatchPayload,
  VDomPatch,
  VNode,
} from '../../../src/types.ts';

/**
 * 1. Virtual DOM Diffing Engine
 */
export class VDomEngine {
  static createVNode(
    tag: string,
    props: Record<string, unknown> = {},
    children: VNode[] = [],
    text?: string,
    key?: string | number,
    extraKey?: string | number
  ): VNode {
    const effectiveKey = key !== undefined ? key : extraKey;
    return { tag, props, children, text, key: effectiveKey };
  }

  static diff(
    oldNode: VNode | null | undefined,
    newNode: VNode | null | undefined,
    path: number[] = []
  ): VDomPatch[] {
    const patches: VDomPatch[] = [];

    // Case 1: Node created
    if (!oldNode && newNode) {
      patches.push({ type: 'CREATE', path, vnode: newNode });
      return patches;
    }

    // Case 2: Node removed
    if (oldNode && !newNode) {
      patches.push({ type: 'REMOVE', path });
      return patches;
    }

    if (!oldNode || !newNode) return patches;

    // Case 3: Node replaced (different tag)
    if (oldNode.tag !== newNode.tag) {
      patches.push({ type: 'REPLACE', path, vnode: newNode });
      return patches;
    }

    // Case 4: Text changed
    if (oldNode.text !== newNode.text) {
      patches.push({ type: 'SET_TEXT', path, text: newNode.text });
    }

    // Case 5: Props updated
    const oldProps = oldNode.props || {};
    const newProps = newNode.props || {};
    const propsDiff: Record<string, unknown> = {};
    let propsChanged = false;

    for (const key of Object.keys(newProps)) {
      if (oldProps[key] !== newProps[key]) {
        propsDiff[key] = newProps[key];
        propsChanged = true;
      }
    }
    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        propsDiff[key] = null;
        propsChanged = true;
      }
    }

    if (propsChanged) {
      patches.push({ type: 'UPDATE_PROPS', path, props: propsDiff });
    }

    // Case 6: Children diffing & Reordering
    const oldChildren = oldNode.children || [];
    const newChildren = newNode.children || [];

    // Keyed reordering detection
    const hasKeys =
      oldChildren.some((c) => c.key !== undefined) &&
      newChildren.some((c) => c.key !== undefined);

    if (hasKeys) {
      const order: number[] = [];
      const oldKeyMap = new Map<string | number, number>();
      oldChildren.forEach((child, idx) => {
        if (child.key !== undefined) oldKeyMap.set(child.key, idx);
      });

      let reordered = false;
      for (let i = 0; i < newChildren.length; i++) {
        const newChild = newChildren[i];
        if (newChild.key !== undefined && oldKeyMap.has(newChild.key)) {
          const oldIdx = oldKeyMap.get(newChild.key)!;
          order.push(oldIdx);
          if (oldIdx !== i) reordered = true;
        } else {
          order.push(-1);
          reordered = true;
        }
      }

      if (reordered) {
        patches.push({ type: 'REORDER', path, order });
      }
    }

    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      const childPatches = VDomEngine.diff(
        oldChildren[i],
        newChildren[i],
        [...path, i]
      );
      patches.push(...childPatches);
    }

    return patches;
  }
}

/**
 * 2. IPC Message Frame Channel & 16ms Batcher
 */
export class IpcChannel {
  private seqCounter = 0;
  private pendingPatchQueue: VDomPatch[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchIntervalMs: number;
  public messageLog: IpcMessageFrame[] = [];
  public roundTripLatencies: number[] = [];
  private listeners = new Map<IpcMessageType, ((frame: IpcMessageFrame) => void)[]>();

  constructor(batchIntervalMs = 16) {
    this.batchIntervalMs = batchIntervalMs;
  }

  nextSeq(): number {
    return ++this.seqCounter;
  }

  on(type: IpcMessageType, callback: (frame: IpcMessageFrame) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  send<T>(type: IpcMessageType, payload: T): IpcMessageFrame<T> {
    const frame: IpcMessageFrame<T> = {
      id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      seq: this.nextSeq(),
      timestamp: Date.now(),
      payload,
    };

    this.messageLog.push(frame as IpcMessageFrame);
    const callbacks = this.listeners.get(type) || [];
    for (const cb of callbacks) {
      cb(frame as IpcMessageFrame);
    }
    return frame;
  }

  queueUiPatch(patch: VDomPatch, onFlush: (batch: UiPatchPayload) => void): void {
    this.pendingPatchQueue.push(patch);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushUiPatches(onFlush);
      }, this.batchIntervalMs);
    }
  }

  flushUiPatches(onFlush: (batch: UiPatchPayload) => void): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.pendingPatchQueue.length === 0) return;

    const patches = [...this.pendingPatchQueue];
    this.pendingPatchQueue = [];

    const batchPayload: UiPatchPayload = {
      batchId: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rootId: 'root',
      patches,
      timestamp: Date.now(),
    };

    const frame = this.send('UI_PATCH', batchPayload);
    onFlush(batchPayload);
  }

  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingPatchQueue = [];
    this.messageLog = [];
    this.roundTripLatencies = [];
    this.listeners.clear();
    this.seqCounter = 0;
  }
}

/**
 * 3. AppService Worker Runtime Context Simulator
 */
export class WorkerContainer {
  public appId: string;
  public state: LifecycleState = 'UNINITIALIZED';
  public data: Record<string, unknown> = {};
  public currentVTree: VNode | null = null;
  public ipc: IpcChannel;
  public pendingCalls = new Map<
    string,
    {
      resolve: (val: unknown) => void;
      reject: (err: BridgeError) => void;
      startTime: number;
    }
  >();
  private activeTimers: NodeJS.Timeout[] = [];
  public telemetry: TelemetryRelay;

  constructor(appId: string, ipc: IpcChannel, telemetry: TelemetryRelay) {
    this.appId = appId;
    this.ipc = ipc;
    this.telemetry = telemetry;

    // Listen for BRIDGE_REPLY
    this.ipc.on('BRIDGE_REPLY', (frame) => {
      const reply = frame.payload as BridgeReplyPayload;
      const pending = this.pendingCalls.get(reply.callId);
      if (pending) {
        this.pendingCalls.delete(reply.callId);
        const duration = Date.now() - pending.startTime;
        this.ipc.roundTripLatencies.push(duration);

        this.telemetry.recordSpan({
          traceId: `trace_${reply.callId}`,
          spanId: `span_worker_recv_${Date.now()}`,
          threadLane: 'AppService',
          name: `bridgeReply:${reply.action}`,
          seqId: frame.seq,
          callId: reply.callId,
          timestamp: Date.now(),
          durationMs: duration,
        });

        if (reply.success) {
          pending.resolve(reply.data);
        } else {
          pending.reject(reply.error || { code: 'UNKNOWN', message: 'Bridge call failed' });
        }
      }
    });

    // Listen for UI_EVENT from AppView
    this.ipc.on('UI_EVENT', (frame) => {
      const event = frame.payload as UiEventPayload;
      this.handleUiEvent(event);
    });
  }

  // Simulated Sandboxed GoatBridge API
  get GoatBridge() {
    return {
      call: async (action: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
        if (this.state === 'TERMINATED' || this.state === 'CRASHED') {
          throw new Error(`Cannot invoke GoatBridge.call in ${this.state} state`);
        }

        const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
          this.pendingCalls.set(callId, { resolve, reject, startTime });

          const callPayload: BridgeCallPayload = {
            callId,
            action,
            payload,
          };

          const frame = this.ipc.send('BRIDGE_CALL', callPayload);

          this.telemetry.recordSpan({
            traceId: `trace_${callId}`,
            spanId: `span_worker_call_${Date.now()}`,
            threadLane: 'AppService',
            name: `bridgeCall:${action}`,
            seqId: frame.seq,
            callId,
            timestamp: startTime,
          });
        });
      },
    };
  }

  evaluateScript(codeString: string): unknown {
    if (this.state === 'TERMINATED' || this.state === 'CRASHED') {
      throw new Error(`Cannot execute script in ${this.state} state`);
    }

    try {
      // Sandbox execution: exclude window, document, DOM globals
      const sandboxFn = new Function(
        'GoatBridge',
        'setData',
        'getData',
        'getApp',
        `
        const window = undefined;
        const document = undefined;
        const HTMLElement = undefined;
        const localStorage = undefined;
        ${codeString}
        `
      );

      return sandboxFn(
        this.GoatBridge,
        (newData: Record<string, unknown>, renderTreeFn?: () => VNode) =>
          this.setData(newData, renderTreeFn),
        () => ({ ...this.data }),
        () => ({ appId: this.appId, state: this.state })
      );
    } catch (err) {
      if (this.state === 'RUNNING' || this.state === 'LAUNCHING') {
        this.state = 'CRASHED';
        this.ipc.send('LIFECYCLE', {
          appId: this.appId,
          state: 'CRASHED',
          event: 'onAppServiceCrash',
          timestamp: Date.now(),
          details: { error: err instanceof Error ? err.message : String(err) },
        } as LifecyclePayload);
      }
      throw err;
    }
  }

  setData(partialData: Record<string, unknown>, renderTreeFn?: (data: Record<string, unknown>) => VNode): void {
    if (this.state === 'SUSPENDED') {
      // In suspended state, queue data updates without flushing patches
      this.data = { ...this.data, ...partialData };
      return;
    }

    this.data = { ...this.data, ...partialData };

    if (renderTreeFn) {
      const newVTree = renderTreeFn(this.data);
      const patches = VDomEngine.diff(this.currentVTree, newVTree);
      this.currentVTree = newVTree;

      for (const patch of patches) {
        this.ipc.queueUiPatch(patch, () => {
          // flushed
        });
      }
    }
  }

  handleUiEvent(event: UiEventPayload): void {
    this.telemetry.recordSpan({
      traceId: `trace_event_${event.eventId}`,
      spanId: `span_worker_event_${Date.now()}`,
      threadLane: 'AppService',
      name: `uiEvent:${event.eventType}`,
      seqId: 0,
      timestamp: Date.now(),
    });
  }

  launch(): void {
    this.state = 'LAUNCHING';
    this.state = 'RUNNING';
    this.ipc.send('LIFECYCLE', {
      appId: this.appId,
      state: 'RUNNING',
      event: 'onAppServiceReady',
      timestamp: Date.now(),
    } as LifecyclePayload);
  }

  suspend(): void {
    this.state = 'SUSPENDED';
    // Clear active timers
    for (const t of this.activeTimers) clearTimeout(t);
    this.activeTimers = [];

    this.ipc.send('LIFECYCLE', {
      appId: this.appId,
      state: 'SUSPENDED',
      event: 'onAppServiceSuspend',
      timestamp: Date.now(),
    } as LifecyclePayload);
  }

  resume(): void {
    this.state = 'RUNNING';
    this.ipc.send('LIFECYCLE', {
      appId: this.appId,
      state: 'RUNNING',
      event: 'onAppServiceResume',
      timestamp: Date.now(),
    } as LifecyclePayload);
  }

  triggerCrash(err: Error): void {
    this.state = 'CRASHED';
    for (const t of this.activeTimers) clearTimeout(t);
    this.activeTimers = [];
    for (const [, pending] of this.pendingCalls) {
      pending.reject(err);
    }
    this.pendingCalls.clear();

    this.ipc.send('LIFECYCLE', {
      appId: this.appId,
      state: 'CRASHED',
      event: 'onAppServiceCrash',
      timestamp: Date.now(),
      details: { error: err.message },
    } as LifecyclePayload);
  }

  terminate(): void {
    this.state = 'TERMINATED';
    for (const t of this.activeTimers) clearTimeout(t);
    this.activeTimers = [];
    this.pendingCalls.clear();

    this.ipc.send('LIFECYCLE', {
      appId: this.appId,
      state: 'TERMINATED',
      event: 'onAppServiceTerminate',
      timestamp: Date.now(),
    } as LifecyclePayload);
  }
}

/**
 * 4. AppView Render Context Simulator
 */
export class AppViewRenderer {
  public domTree: VNode | null = null;
  public appliedPatchesCount = 0;
  public ipc: IpcChannel;
  public hostDispatcher: HostDispatcher;
  public telemetry: TelemetryRelay;

  constructor(
    ipc: IpcChannel,
    hostDispatcher: HostDispatcher,
    telemetry: TelemetryRelay
  ) {
    this.ipc = ipc;
    this.hostDispatcher = hostDispatcher;
    this.telemetry = telemetry;

    // Listen for UI_PATCH frames
    this.ipc.on('UI_PATCH', (frame) => {
      const payload = frame.payload as UiPatchPayload;
      this.applyPatchBatch(payload, frame.seq);
    });

    // Listen for BRIDGE_CALL frames to forward to Host
    this.ipc.on('BRIDGE_CALL', async (frame) => {
      const call = frame.payload as BridgeCallPayload;

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_appview_fwd_${Date.now()}`,
        threadLane: 'AppView',
        name: `forwardToHost:${call.action}`,
        seqId: frame.seq,
        callId: call.callId,
        timestamp: Date.now(),
      });

      const reply = await this.hostDispatcher.dispatch(call);

      this.telemetry.recordSpan({
        traceId: `trace_${call.callId}`,
        spanId: `span_appview_reply_${Date.now()}`,
        threadLane: 'AppView',
        name: `replyFromHost:${call.action}`,
        seqId: frame.seq,
        callId: call.callId,
        timestamp: Date.now(),
      });

      this.ipc.send('BRIDGE_REPLY', reply);
    });
  }

  applyPatchBatch(batch: UiPatchPayload, seq: number): void {
    const startTime = Date.now();

    for (const patch of batch.patches) {
      this.applySinglePatch(patch);
      this.appliedPatchesCount++;
    }

    this.telemetry.recordSpan({
      traceId: `trace_batch_${batch.batchId}`,
      spanId: `span_appview_render_${Date.now()}`,
      threadLane: 'AppView',
      name: 'applyUiPatchBatch',
      seqId: seq,
      batchId: batch.batchId,
      timestamp: startTime,
      durationMs: Date.now() - startTime,
    });
  }

  private applySinglePatch(patch: VDomPatch): void {
    if (patch.type === 'CREATE' && patch.vnode) {
      if (patch.path.length === 0) {
        this.domTree = JSON.parse(JSON.stringify(patch.vnode));
      } else {
        this.insertNodeAtPath(this.domTree, patch.path, patch.vnode);
      }
    } else if (patch.type === 'REMOVE') {
      if (patch.path.length === 0) {
        this.domTree = null;
      } else {
        this.removeNodeAtPath(this.domTree, patch.path);
      }
    } else if (patch.type === 'REPLACE' && patch.vnode) {
      if (patch.path.length === 0) {
        this.domTree = JSON.parse(JSON.stringify(patch.vnode));
      } else {
        this.replaceNodeAtPath(this.domTree, patch.path, patch.vnode);
      }
    } else if (patch.type === 'SET_TEXT') {
      const target = this.findNodeAtPath(this.domTree, patch.path);
      if (target) target.text = patch.text;
    } else if (patch.type === 'UPDATE_PROPS' && patch.props) {
      const target = this.findNodeAtPath(this.domTree, patch.path);
      if (target) {
        target.props = target.props || {};
        for (const [k, v] of Object.entries(patch.props)) {
          if (v === null) delete target.props[k];
          else target.props[k] = v;
        }
      }
    } else if (patch.type === 'REORDER' && patch.order) {
      const target = this.findNodeAtPath(this.domTree, patch.path);
      if (target && target.children) {
        const reorderedChildren: VNode[] = [];
        for (const oldIdx of patch.order) {
          if (oldIdx >= 0 && oldIdx < target.children.length) {
            reorderedChildren.push(target.children[oldIdx]);
          }
        }
        target.children = reorderedChildren;
      }
    }
  }

  findNodeAtPath(root: VNode | null, path: number[]): VNode | null {
    if (!root) return null;
    let curr = root;
    for (const idx of path) {
      if (!curr.children || !curr.children[idx]) return null;
      curr = curr.children[idx];
    }
    return curr;
  }

  private insertNodeAtPath(root: VNode | null, path: number[], node: VNode): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex = path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent) {
      parent.children = parent.children || [];
      parent.children.splice(targetIndex, 0, JSON.parse(JSON.stringify(node)));
    }
  }

  private removeNodeAtPath(root: VNode | null, path: number[]): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex = path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent && parent.children) {
      parent.children.splice(targetIndex, 1);
    }
  }

  private replaceNodeAtPath(root: VNode | null, path: number[], node: VNode): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex = path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent && parent.children) {
      parent.children[targetIndex] = JSON.parse(JSON.stringify(node));
    }
  }

  simulateUserEvent(eventType: string, targetPath: number[] = [], data: Record<string, unknown> = {}): void {
    const eventPayload: UiEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      targetPath,
      data,
      timestamp: Date.now(),
    };

    this.ipc.send('UI_EVENT', eventPayload);
  }
}

/**
 * 5. Multi-Platform Host Dispatcher Simulator
 * Simulates Android GoatBridgeActionHandler.kt (141+ actions),
 * iOS GoatScriptMessageHandler.swift, and Flutter / React Native stream bindings.
 */
export class HostDispatcher {
  public platform: 'android' | 'ios' | 'flutter' | 'react-native' | 'mock' = 'mock';
  public memoryStorage = new Map<string, unknown>();
  public lifecycleEvents: HostSignalEvent[] = [];
  public dispatchedActions: string[] = [];
  public delayMs: number = 0;
  public errorInjectionAction?: string;
  public telemetry: TelemetryRelay;

  constructor(telemetry: TelemetryRelay) {
    this.telemetry = telemetry;
  }

  async dispatch(call: BridgeCallPayload): Promise<BridgeReplyPayload> {
    const startTime = Date.now();
    this.dispatchedActions.push(call.action);

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    this.telemetry.recordSpan({
      traceId: `trace_${call.callId}`,
      spanId: `span_host_${Date.now()}`,
      threadLane: 'Host',
      name: `executeHostAction:${call.action}`,
      seqId: 0,
      callId: call.callId,
      timestamp: startTime,
    });

    if (this.errorInjectionAction === call.action) {
      return {
        callId: call.callId,
        action: call.action,
        success: false,
        error: { code: 'HOST_ERROR_INJECTED', message: `Simulated host error for ${call.action}` },
        durationMs: Date.now() - startTime,
      };
    }

    const reply = this.handleMockActions(call, startTime);
    return reply;
  }

  private handleMockActions(call: BridgeCallPayload, startTime: number): BridgeReplyPayload {
    const { action, payload, callId } = call;

    // Storage Domain
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

    // Location Domain
    if (action === 'location.getCurrent' || action === 'getLocation') {
      return {
        callId,
        action,
        success: true,
        data: { latitude: 37.7749, longitude: -122.4194, accuracy: 5.0 },
        durationMs: Date.now() - startTime,
      };
    }

    // Network Domain
    if (action === 'network.request' || action === 'request') {
      return {
        callId,
        action,
        success: true,
        data: { status: 200, data: { message: 'Mock HTTP response', url: payload.url } },
        durationMs: Date.now() - startTime,
      };
    }

    // UI & Navigation Domain
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

    // Default Fallback
    return {
      callId,
      action,
      success: true,
      data: { mockExecuted: true, action, payload },
      durationMs: Date.now() - startTime,
    };
  }

  recordLifecycleEvent(event: HostSignalEvent): void {
    this.lifecycleEvents.push(event);
  }
}

/**
 * 6. Telemetry & CDP Trace Relay Simulator
 */
export class TelemetryRelay {
  public traces: TelemetryTraceEvent[] = [];

  recordSpan(span: TelemetryTraceEvent): void {
    this.traces.push(span);
  }

  recordTrace(span: any): void {
    this.traces.push(span);
  }

  getTraces(): TelemetryTraceEvent[] {
    return this.traces;
  }

  calculateWaterfall(callId: string): { totalDurationMs: number; spans: TelemetryTraceEvent[] } {
    const spans = this.traces.filter((t) => (t as any).attributes?.callId === callId || t.callId === callId);
    const minTime = spans.length ? Math.min(...spans.map((s) => (s as any).startTime || s.timestamp)) : 0;
    const maxTime = spans.length ? Math.max(...spans.map((s) => (s as any).endTime || (s.timestamp + (s.durationMs || 0)))) : 0;
    return {
      totalDurationMs: maxTime - minTime,
      spans,
    };
  }

  getTraceWaterfall(traceId: string): TelemetryTraceEvent[] {
    return this.traces
      .filter((t) => t.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getTracesByLane(lane: ThreadLane): TelemetryTraceEvent[] {
    return this.traces.filter((t) => t.threadLane === lane);
  }

  clear(): void {
    this.traces = [];
  }
}

/**
 * 7. Master Dual-Thread Test Environment Builder
 */
export class DualThreadTestEnvironment {
  public ipc: IpcChannel;
  public telemetry: TelemetryRelay;
  public host: HostDispatcher;
  public worker: WorkerContainer;
  public appView: AppViewRenderer;

  constructor(appId = 'mini_app_test_1', batchIntervalMs = 16) {
    this.ipc = new IpcChannel(batchIntervalMs);
    this.telemetry = new TelemetryRelay();
    this.host = new HostDispatcher(this.telemetry);
    this.worker = new WorkerContainer(appId, this.ipc, this.telemetry);
    this.appView = new AppViewRenderer(this.ipc, this.host, this.telemetry);

    // Forward worker lifecycle signals to host
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
  }

  destroy(): void {
    this.worker.terminate();
    this.ipc.clear();
    this.telemetry.clear();
  }
}
