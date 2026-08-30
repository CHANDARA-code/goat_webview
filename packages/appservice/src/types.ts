/**
 * @goat/appservice - Universal Type Contracts & Protocol Schemas
 * Specs: ORIGINAL_REQUEST §R1-R4, PROJECT.md § Interface Contracts
 */

// ==========================================
// 1. Thread-to-Thread IPC Protocols
// ==========================================

export type IpcMessageType =
  | 'BRIDGE_CALL'
  | 'BRIDGE_REPLY'
  | 'UI_PATCH'
  | 'UI_EVENT'
  | 'LIFECYCLE'
  | 'TELEMETRY'
  | 'HEARTBEAT_PING'
  | 'HEARTBEAT_PONG';

export type IpcSource = 'appservice' | 'appview' | 'native_host' | 'host' | 'AppService' | 'AppView' | 'Host';

export interface IpcMessageFrame<T = unknown> {
  id: string;
  type: IpcMessageType;
  seq: number;
  timestamp: number;
  source?: IpcSource;
  payload: T;
}

// ==========================================
// 2. Bridge Call & Reply Payloads
// ==========================================

export interface BridgeCallPayload {
  callId: string;
  action: string;
  payload: Record<string, unknown>;
  domain?: string;
  timeoutMs?: number;
}

export interface BridgeError {
  code: string | number;
  message: string;
  details?: unknown;
}

export type BridgeErrorPayload = BridgeError;

export interface BridgeReplyPayload {
  callId: string;
  action: string;
  success: boolean;
  data?: unknown;
  error?: BridgeError;
  durationMs: number;
}

// ==========================================
// 3. Mini-App Lifecycle State Machine
// ==========================================

export type LifecycleState =
  | 'UNINITIALIZED'
  | 'LAUNCHING'
  | 'RUNNING'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'CRASHED';

export type MiniAppLifecycleState = LifecycleState;

export type LifecycleSignal =
  | 'onAppServiceReady'
  | 'onAppServiceCrash'
  | 'onAppServiceTerminate'
  | 'onAppServiceSuspend'
  | 'onAppServiceResume';

export type LifecycleEventName =
  | 'INIT'
  | 'LAUNCH_SUCCESS'
  | 'LAUNCH_FAILURE'
  | 'SUSPEND'
  | 'RESUME'
  | 'TERMINATE'
  | 'FATAL_ERROR'
  | LifecycleSignal;

export interface LifecyclePayload {
  appId: string;
  state?: LifecycleState;
  fromState?: LifecycleState;
  toState?: LifecycleState;
  event?: LifecycleSignal | LifecycleEventName;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface HostSignalEvent {
  event: LifecycleSignal;
  timestamp: number;
  appId: string;
  details?: Record<string, unknown>;
}

// ==========================================
// 4. Virtual DOM & Patch Protocol
// ==========================================

export type VNodeType = 'ELEMENT' | 'TEXT' | 'FRAGMENT';

export interface VNodeProps {
  key?: string | number;
  class?: string;
  className?: string;
  style?: string | Record<string, string | number>;
  id?: string;
  dataset?: Record<string, unknown>;
  disabled?: boolean;
  value?: unknown;
  [key: string]: unknown;
}

export interface VNode {
  type?: VNodeType;
  nodeId?: string;
  tag: string;
  key?: string | number;
  props?: VNodeProps;
  children?: VNode[];
  text?: string;
}

export type PatchType =
  | 'CREATE'
  | 'REMOVE'
  | 'REPLACE'
  | 'UPDATE_PROPS'
  | 'SET_TEXT'
  | 'REORDER'
  | 'REORDER_CHILDREN';

export type PatchOpType = PatchType;

export interface ReorderMove {
  fromIndex: number;
  toIndex: number;
  key?: string | number;
}

export interface VDomPatch {
  type: PatchType;
  path: number[]; // Hierarchical child index path from root, e.g. [0, 1, 3]
  targetNodeId?: string;
  vnode?: VNode;
  newVNode?: VNode;
  childIndex?: number;
  insertIndex?: number;
  props?: Record<string, unknown>;
  set?: Record<string, unknown>;
  remove?: string[];
  text?: string;
  order?: number[];
  moves?: ReorderMove[];
  newOrderKeys?: Array<string | number>;
  key?: string | number;
}

export interface UiPatchPayload {
  batchId: string;
  rootId: string;
  seq?: number;
  timestamp: number;
  patches: VDomPatch[];
}

// ==========================================
// 5. UI Event Interception Payloads
// ==========================================

export interface SerializedTouchEvent {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
}

export interface UiEventPayload {
  eventId: string;
  nodeId?: string;
  eventType: string; // e.g. 'tap', 'click', 'input', 'scroll'
  timestamp: number;
  targetPath?: number[];
  target?: {
    id?: string;
    dataset?: Record<string, unknown>;
    value?: unknown;
    checked?: boolean;
  };
  data?: Record<string, unknown>;
  detail?: Record<string, unknown>;
  touches?: SerializedTouchEvent[];
}

// ==========================================
// 6. Telemetry & Dual-Thread Tracing
// ==========================================

export type ThreadLane = 'AppService' | 'AppView' | 'Host' | 'appservice' | 'appview' | 'native';

export interface TelemetryTraceEvent {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  threadLane: ThreadLane;
  name: string;
  seqId: number;
  batchId?: string;
  callId?: string;
  action?: string;
  phase?: 'DISPATCH' | 'RECEIVE' | 'APPLY_PATCH' | 'DOM_EVENT' | 'NATIVE_CALL' | 'NATIVE_RETURN' | string;
  timestamp: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export type DualThreadTraceEnvelope = TelemetryTraceEvent;

// ==========================================
// 7. AppService Container Configuration
// ==========================================

export interface AppServiceConfig {
  appId: string;
  batchIntervalMs?: number;
  enableTelemetry?: boolean;
  defaultRpcTimeoutMs?: number;
}
