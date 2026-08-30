export interface CDPTargetInfo {
  id: string;
  title: string;
  description?: string;
  type: 'page' | 'service_worker' | 'browser' | 'other';
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
  appId?: string;
  connected?: boolean;
  createdAt: number;
}

export interface CDPVersionResponse {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl: string;
}

export interface CDPMessage {
  id?: number;
  method?: string;
  params?: Record<string, any>;
  result?: Record<string, any>;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface GoatBridgeMessageSentEvent {
  method: 'GoatBridge.messageSent';
  params: {
    callId: string;
    appId?: string;
    action: string;
    payload?: Record<string, any>;
    params?: Record<string, any>;
    timestamp: number;
    sourceFrame?: string;
    threadLane?: string;
    seqId?: number;
    batchId?: string;
    workerIpcLatencyMs?: number;
    nativeExecutionLatencyMs?: number;
    domRenderLatencyMs?: number;
    parentCallId?: string;
  };
}

export interface GoatBridgeMessageReceivedEvent {
  method: 'GoatBridge.messageReceived';
  params: {
    callId: string;
    appId?: string;
    action?: string;
    status: 'success' | 'error';
    result?: Record<string, any>;
    response?: Record<string, any>;
    error?: string | Record<string, any>;
    durationMs: number;
    timestamp: number;
    threadLane?: string;
    seqId?: number;
    batchId?: string;
    workerIpcLatencyMs?: number;
    nativeExecutionLatencyMs?: number;
    domRenderLatencyMs?: number;
    parentCallId?: string;
  };
}

export interface GoatBridgeSetMockCommand {
  id: number;
  method: 'GoatBridge.setMockResponse';
  params: {
    appId?: string;
    action: string;
    mockResult?: Record<string, any>;
    response?: Record<string, any>;
    delayMs?: number;
    shouldFail?: boolean;
    errorMessage?: string;
  };
}
