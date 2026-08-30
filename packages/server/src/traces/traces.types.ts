export type ThreadLaneType =
  | 'appservice_to_appview'
  | 'appview_to_native'
  | 'native_to_appview'
  | 'appview_to_appservice'
  | 'AppService'
  | 'AppView'
  | 'Host'
  | 'roundtrip_complete'
  | string;

export interface TraceItem {
  id?: string;
  callId: string;
  appId: string;
  sessionId?: string;
  action: string;
  direction?: 'REQ' | 'RES' | 'EVENT';
  params?: Record<string, unknown> | string | null;
  payload?: Record<string, unknown> | string | null;
  response?: Record<string, unknown> | string | null;
  error?: Record<string, unknown> | string | null;
  errorMessage?: string | null;
  status?: 'PENDING' | 'SUCCESS' | 'ERROR';
  durationMs?: number;
  timestamp?: number;
  startTime?: number;
  endTime?: number;
  thread?: string;
  threadLane?: ThreadLaneType;
  seqId?: number;
  batchId?: string;
  batchCount?: number;
  workerIpcLatencyMs?: number;
  nativeExecutionLatencyMs?: number;
  domRenderLatencyMs?: number;
  parentCallId?: string;
  ip?: string;
  createdAt?: number;
}

export interface TraceQueryFilter {
  appId?: string;
  sessionId?: string;
  action?: string;
  status?: 'PENDING' | 'SUCCESS' | 'ERROR';
  hasError?: boolean | string;
  minDuration?: number | string;
  startTime?: number | string;
  endTime?: number | string;
  threadLane?: string;
  batchId?: string;
  seqId?: number | string;
  search?: string;
  limit?: number | string;
  offset?: number | string;
  sortBy?: 'createdAt' | 'timestamp' | 'durationMs' | 'action';
  sortOrder?: 'asc' | 'desc';
}

export interface TraceStatsFilter {
  appId?: string;
  sessionId?: string;
  timeWindowSec?: number | string;
  startTime?: number | string;
  endTime?: number | string;
}

export interface TraceStatsResponse {
  totalCalls: number;
  errorCount: number;
  errorRate: number; // percentage (0 - 100) or ratio
  errorRatePercentage: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputPerSec: number;
  callsPerAction: Record<string, number>;
  topSlowActions: Array<{
    action: string;
    count: number;
    avgDurationMs: number;
    maxDurationMs: number;
  }>;
}

export interface MockRuleItem {
  id?: string;
  appId?: string;
  action: string;
  response?: Record<string, unknown> | string;
  responsePayload?: Record<string, unknown> | string;
  delayMs?: number;
  shouldFail?: boolean | number;
  errorMessage?: string;
  enabled?: boolean | number;
  createdAt?: number;
}
