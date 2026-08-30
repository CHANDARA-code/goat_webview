import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token'),
    appId: text('app_id').notNull(),
    deviceName: text('device_name').notNull(),
    platform: text('platform').notNull(),
    osVersion: text('os_version').notNull(),
    ipAddress: text('ip_address').notNull(),
    connectedAt: integer('connected_at').notNull(),
    disconnectedAt: integer('disconnected_at'),
    status: text('status').notNull().default('ACTIVE'),
    deviceInfo: text('device_info'), // JSON string
  },
  (table) => ({
    appIdIdx: index('idx_sessions_app_id').on(table.appId),
    tokenIdx: index('idx_sessions_token').on(table.token),
    statusIdx: index('idx_sessions_status').on(table.status),
  })
);

export const traces = sqliteTable(
  'traces',
  {
    id: text('id').primaryKey(),
    callId: text('call_id').notNull(),
    appId: text('app_id').notNull(),
    sessionId: text('session_id'),
    action: text('action').notNull(),
    direction: text('direction').notNull().default('REQ'), // 'REQ' | 'RES' | 'EVENT'
    params: text('params'), // JSON string
    payload: text('payload'), // JSON string (alias for params)
    response: text('response'), // JSON string
    error: text('error'), // JSON string
    errorMessage: text('error_message'),
    status: text('status').notNull().default('SUCCESS'), // 'PENDING' | 'SUCCESS' | 'ERROR'
    durationMs: real('duration_ms').default(0.0),
    timestamp: integer('timestamp').notNull(),
    startTime: integer('start_time'),
    endTime: integer('end_time'),
    thread: text('thread').default('main'),
    threadLane: text('thread_lane'),
    seqId: integer('seq_id'),
    batchId: text('batch_id'),
    workerIpcLatencyMs: real('worker_ipc_latency_ms'),
    nativeExecutionLatencyMs: real('native_execution_latency_ms'),
    domRenderLatencyMs: real('dom_render_latency_ms'),
    parentCallId: text('parent_call_id'),
    ip: text('ip').default('127.0.0.1'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    appTimestampIdx: index('idx_traces_app_timestamp').on(table.appId, table.timestamp),
    actionIdx: index('idx_traces_action').on(table.action),
    callIdIdx: index('idx_traces_call_id').on(table.callId),
    createdAtIdx: index('idx_traces_created_at').on(table.createdAt),
    statusIdx: index('idx_traces_status').on(table.status),
    threadLaneIdx: index('idx_traces_thread_lane').on(table.threadLane),
  })
);

export const mockRules = sqliteTable(
  'mock_rules',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().default('*'),
    action: text('action').notNull(),
    response: text('response'), // JSON string
    responsePayload: text('response_payload'), // JSON string
    delayMs: integer('delay_ms').notNull().default(0),
    shouldFail: integer('should_fail').notNull().default(0), // 0 or 1
    errorMessage: text('error_message'),
    enabled: integer('enabled').notNull().default(1), // 0 or 1
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    appActionIdx: index('idx_mock_rules_app_action').on(table.appId, table.action),
    actionIdx: index('idx_mock_rules_action').on(table.action),
  })
);
