import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database.service';
import { TraceItem, TraceQueryFilter, TraceStatsFilter, TraceStatsResponse, MockRuleItem } from './traces.types';
import * as crypto from 'crypto';

export class TracesService extends EventEmitter {
  constructor(private dbService: DatabaseService) {
    super();
  }

  private stringifyJson(val: unknown): string | null {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  private parseJson(val: string | null | undefined): any {
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  public ingestTrace(raw: TraceItem): TraceItem {
    const sqlite = this.dbService.getRawSqlite();
    const id = raw.id || `trace_${crypto.randomUUID()}`;
    const callId = raw.callId || `call_${crypto.randomUUID()}`;
    const appId = raw.appId || 'default';
    const sessionId = raw.sessionId || null;
    const action = raw.action || 'UNKNOWN';
    const direction = raw.direction || 'REQ';

    const paramsObj = raw.params !== undefined ? raw.params : raw.payload;
    const paramsStr = this.stringifyJson(paramsObj);
    const payloadStr = paramsStr;
    const responseStr = this.stringifyJson(raw.response);
    const errorStr = this.stringifyJson(raw.error);
    const errorMessage = raw.errorMessage || (raw.error ? (typeof raw.error === 'string' ? raw.error : (raw.error as any).message || null) : null);

    let status = raw.status;
    if (!status) {
      if (raw.error || errorMessage) {
        status = 'ERROR';
      } else {
        status = 'SUCCESS';
      }
    }

    let durationMs = raw.durationMs;
    const now = Date.now();
    const timestamp = raw.timestamp || raw.startTime || now;
    const startTime = raw.startTime || timestamp;
    const endTime = raw.endTime || (durationMs !== undefined && durationMs > 0 ? startTime + durationMs : null);

    if ((durationMs === undefined || durationMs === null || durationMs === 0) && startTime && endTime) {
      durationMs = Math.max(0, endTime - startTime);
    }
    if (durationMs === undefined || durationMs === null) {
      durationMs = 0;
    }

    const thread = raw.thread || (raw.threadLane ? String(raw.threadLane) : 'main');
    const threadLane = raw.threadLane || null;
    const seqId = raw.seqId !== undefined && raw.seqId !== null ? Number(raw.seqId) : null;
    const batchId = raw.batchId || null;
    const workerIpcLatencyMs = raw.workerIpcLatencyMs !== undefined && raw.workerIpcLatencyMs !== null ? Number(raw.workerIpcLatencyMs) : null;
    const nativeExecutionLatencyMs = raw.nativeExecutionLatencyMs !== undefined && raw.nativeExecutionLatencyMs !== null ? Number(raw.nativeExecutionLatencyMs) : null;
    const domRenderLatencyMs = raw.domRenderLatencyMs !== undefined && raw.domRenderLatencyMs !== null ? Number(raw.domRenderLatencyMs) : null;
    const parentCallId = raw.parentCallId || null;
    const ip = raw.ip || '127.0.0.1';
    const createdAt = raw.createdAt || now;

    const stmt = sqlite.prepare(`
      INSERT INTO traces (
        id, call_id, app_id, session_id, action, direction,
        params, payload, response, error, error_message,
        status, duration_ms, timestamp, start_time, end_time,
        thread, thread_lane, seq_id, batch_id,
        worker_ipc_latency_ms, native_execution_latency_ms, dom_render_latency_ms, parent_call_id,
        ip, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run(
      id, callId, appId, sessionId, action, direction,
      paramsStr, payloadStr, responseStr, errorStr, errorMessage,
      status, durationMs, timestamp, startTime, endTime,
      thread, threadLane, seqId, batchId,
      workerIpcLatencyMs, nativeExecutionLatencyMs, domRenderLatencyMs, parentCallId,
      ip, createdAt
    );

    const inserted: TraceItem = {
      id,
      callId,
      appId,
      sessionId: sessionId || undefined,
      action,
      direction,
      params: this.parseJson(paramsStr),
      payload: this.parseJson(payloadStr),
      response: this.parseJson(responseStr),
      error: this.parseJson(errorStr),
      errorMessage: errorMessage || undefined,
      status,
      durationMs,
      timestamp,
      startTime,
      endTime: endTime || undefined,
      thread,
      threadLane: threadLane || undefined,
      seqId: seqId !== null ? seqId : undefined,
      batchId: batchId || undefined,
      workerIpcLatencyMs: workerIpcLatencyMs !== null ? workerIpcLatencyMs : undefined,
      nativeExecutionLatencyMs: nativeExecutionLatencyMs !== null ? nativeExecutionLatencyMs : undefined,
      domRenderLatencyMs: domRenderLatencyMs !== null ? domRenderLatencyMs : undefined,
      parentCallId: parentCallId || undefined,
      ip,
      createdAt,
    };

    this.emit('trace', inserted);
    return inserted;
  }

  public ingestTraces(tracesList: TraceItem[]): TraceItem[] {
    const results: TraceItem[] = [];
    const sqlite = this.dbService.getRawSqlite();
    const transaction = sqlite.transaction((items: TraceItem[]) => {
      for (const item of items) {
        results.push(this.ingestTrace(item));
      }
    });
    transaction(tracesList);
    return results;
  }

  public getTraces(filter: TraceQueryFilter = {}): { total: number; data: TraceItem[] } {
    const sqlite = this.dbService.getRawSqlite();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.appId) {
      conditions.push('app_id = ?');
      params.push(filter.appId);
    }
    if (filter.sessionId) {
      conditions.push('session_id = ?');
      params.push(filter.sessionId);
    }
    if (filter.action) {
      conditions.push('action = ?');
      params.push(filter.action);
    }
    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter.hasError !== undefined) {
      const hasErr = String(filter.hasError) === 'true';
      if (hasErr) {
        conditions.push('(status = "ERROR" OR error IS NOT NULL OR error_message IS NOT NULL)');
      } else {
        conditions.push('status = "SUCCESS" AND error IS NULL AND error_message IS NULL');
      }
    }
    if (filter.minDuration !== undefined) {
      conditions.push('duration_ms >= ?');
      params.push(Number(filter.minDuration));
    }
    if (filter.startTime !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(Number(filter.startTime));
    }
    if (filter.endTime !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(Number(filter.endTime));
    }
    if (filter.threadLane) {
      conditions.push('thread_lane = ?');
      params.push(filter.threadLane);
    }
    if (filter.batchId) {
      conditions.push('batch_id = ?');
      params.push(filter.batchId);
    }
    if (filter.seqId !== undefined) {
      conditions.push('seq_id = ?');
      params.push(Number(filter.seqId));
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      conditions.push('(action LIKE ? OR call_id LIKE ? OR payload LIKE ? OR params LIKE ? OR response LIKE ? OR error LIKE ? OR error_message LIKE ? OR thread_lane LIKE ?)');
      params.push(term, term, term, term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = sqlite.prepare(`SELECT COUNT(*) as count FROM traces ${whereClause}`);
    const totalRow = countStmt.get(...params) as { count: number };
    const total = totalRow ? totalRow.count : 0;

    let sortCol = 'created_at';
    if (filter.sortBy === 'timestamp') sortCol = 'timestamp';
    else if (filter.sortBy === 'durationMs') sortCol = 'duration_ms';
    else if (filter.sortBy === 'action') sortCol = 'action';
    else if (filter.sortBy === 'createdAt') sortCol = 'created_at';

    const sortOrder = filter.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(Number(filter.limit) || 50, 1), 1000);
    const offset = Math.max(Number(filter.offset) || 0, 0);

    const queryStmt = sqlite.prepare(`
      SELECT * FROM traces ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `);

    const rows = queryStmt.all(...params, limit, offset) as any[];

    const data: TraceItem[] = rows.map((row) => ({
      id: row.id,
      callId: row.call_id,
      appId: row.app_id,
      sessionId: row.session_id || undefined,
      action: row.action,
      direction: row.direction,
      params: this.parseJson(row.params),
      payload: this.parseJson(row.payload),
      response: this.parseJson(row.response),
      error: this.parseJson(row.error),
      errorMessage: row.error_message || undefined,
      status: row.status,
      durationMs: row.duration_ms,
      timestamp: row.timestamp,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      thread: row.thread,
      threadLane: row.thread_lane || undefined,
      seqId: row.seq_id !== null && row.seq_id !== undefined ? row.seq_id : undefined,
      batchId: row.batch_id || undefined,
      workerIpcLatencyMs: row.worker_ipc_latency_ms !== null && row.worker_ipc_latency_ms !== undefined ? row.worker_ipc_latency_ms : undefined,
      nativeExecutionLatencyMs: row.native_execution_latency_ms !== null && row.native_execution_latency_ms !== undefined ? row.native_execution_latency_ms : undefined,
      domRenderLatencyMs: row.dom_render_latency_ms !== null && row.dom_render_latency_ms !== undefined ? row.dom_render_latency_ms : undefined,
      parentCallId: row.parent_call_id || undefined,
      ip: row.ip,
      createdAt: row.created_at,
    }));

    return { total, data };
  }

  public getTraceById(callIdOrId: string): TraceItem | null {
    const sqlite = this.dbService.getRawSqlite();
    const stmt = sqlite.prepare(`SELECT * FROM traces WHERE call_id = ? OR id = ? LIMIT 1`);
    const row = stmt.get(callIdOrId, callIdOrId) as any;
    if (!row) return null;

    return {
      id: row.id,
      callId: row.call_id,
      appId: row.app_id,
      sessionId: row.session_id || undefined,
      action: row.action,
      direction: row.direction,
      params: this.parseJson(row.params),
      payload: this.parseJson(row.payload),
      response: this.parseJson(row.response),
      error: this.parseJson(row.error),
      errorMessage: row.error_message || undefined,
      status: row.status,
      durationMs: row.duration_ms,
      timestamp: row.timestamp,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      thread: row.thread,
      threadLane: row.thread_lane || undefined,
      seqId: row.seq_id !== null && row.seq_id !== undefined ? row.seq_id : undefined,
      batchId: row.batch_id || undefined,
      workerIpcLatencyMs: row.worker_ipc_latency_ms !== null && row.worker_ipc_latency_ms !== undefined ? row.worker_ipc_latency_ms : undefined,
      nativeExecutionLatencyMs: row.native_execution_latency_ms !== null && row.native_execution_latency_ms !== undefined ? row.native_execution_latency_ms : undefined,
      domRenderLatencyMs: row.dom_render_latency_ms !== null && row.dom_render_latency_ms !== undefined ? row.dom_render_latency_ms : undefined,
      parentCallId: row.parent_call_id || undefined,
      ip: row.ip,
      createdAt: row.created_at,
    };
  }

  public getStats(filter: TraceStatsFilter = {}): TraceStatsResponse {
    const sqlite = this.dbService.getRawSqlite();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.appId) {
      conditions.push('app_id = ?');
      params.push(filter.appId);
    }
    if (filter.sessionId) {
      conditions.push('session_id = ?');
      params.push(filter.sessionId);
    }
    if (filter.timeWindowSec) {
      const minTime = Date.now() - Number(filter.timeWindowSec) * 1000;
      conditions.push('timestamp >= ?');
      params.push(minTime);
    }
    if (filter.startTime) {
      conditions.push('timestamp >= ?');
      params.push(Number(filter.startTime));
    }
    if (filter.endTime) {
      conditions.push('timestamp <= ?');
      params.push(Number(filter.endTime));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const stmt = sqlite.prepare(`SELECT duration_ms, status, action, timestamp FROM traces ${whereClause} ORDER BY duration_ms ASC`);
    const rows = stmt.all(...params) as Array<{ duration_ms: number; status: string; action: string; timestamp: number }>;

    const totalCalls = rows.length;
    if (totalCalls === 0) {
      return {
        totalCalls: 0,
        errorCount: 0,
        errorRate: 0,
        errorRatePercentage: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p90LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        throughputPerSec: 0,
        callsPerAction: {},
        topSlowActions: [],
      };
    }

    let errorCount = 0;
    let sumDuration = 0;
    const callsPerAction: Record<string, number> = {};
    const actionDurations: Record<string, { count: number; totalDuration: number; maxDuration: number }> = {};
    let minTimestamp = rows[0].timestamp;
    let maxTimestamp = rows[0].timestamp;

    for (const r of rows) {
      if (r.status === 'ERROR') {
        errorCount++;
      }
      sumDuration += r.duration_ms || 0;
      callsPerAction[r.action] = (callsPerAction[r.action] || 0) + 1;

      if (!actionDurations[r.action]) {
        actionDurations[r.action] = { count: 0, totalDuration: 0, maxDuration: 0 };
      }
      actionDurations[r.action].count++;
      actionDurations[r.action].totalDuration += r.duration_ms || 0;
      actionDurations[r.action].maxDuration = Math.max(actionDurations[r.action].maxDuration, r.duration_ms || 0);

      if (r.timestamp < minTimestamp) minTimestamp = r.timestamp;
      if (r.timestamp > maxTimestamp) maxTimestamp = r.timestamp;
    }

    const avgLatencyMs = Number((sumDuration / totalCalls).toFixed(2));
    const errorRate = Number(((errorCount / totalCalls) * 100).toFixed(2));
    const errorRatePercentage = errorRate;

    // Percentile calculation
    const getPercentile = (p: number): number => {
      const idx = Math.min(Math.floor((p / 100) * totalCalls), totalCalls - 1);
      return Number((rows[idx].duration_ms || 0).toFixed(2));
    };

    const p50LatencyMs = getPercentile(50);
    const p90LatencyMs = getPercentile(90);
    const p95LatencyMs = getPercentile(95);
    const p99LatencyMs = getPercentile(99);

    const timeSpanSec = Math.max((maxTimestamp - minTimestamp) / 1000, 1);
    const throughputPerSec = Number((totalCalls / timeSpanSec).toFixed(2));

    const topSlowActions = Object.entries(actionDurations)
      .map(([action, stats]) => ({
        action,
        count: stats.count,
        avgDurationMs: Number((stats.totalDuration / stats.count).toFixed(2)),
        maxDurationMs: Number(stats.maxDuration.toFixed(2)),
      }))
      .sort((a, b) => b.avgDurationMs - a.avgDurationMs);

    return {
      totalCalls,
      errorCount,
      errorRate,
      errorRatePercentage,
      avgLatencyMs,
      p50LatencyMs,
      p90LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      throughputPerSec,
      callsPerAction,
      topSlowActions,
    };
  }

  public deleteTraces(filter: { appId?: string; sessionId?: string; olderThanMs?: number } = {}): number {
    const sqlite = this.dbService.getRawSqlite();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.appId) {
      conditions.push('app_id = ?');
      params.push(filter.appId);
    }
    if (filter.sessionId) {
      conditions.push('session_id = ?');
      params.push(filter.sessionId);
    }
    if (filter.olderThanMs) {
      const cutoff = Date.now() - filter.olderThanMs;
      conditions.push('created_at < ?');
      params.push(cutoff);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = sqlite.prepare(`DELETE FROM traces ${whereClause}`);
    const result = stmt.run(...params);
    return result.changes;
  }

  public getMocks(appId?: string): MockRuleItem[] {
    const sqlite = this.dbService.getRawSqlite();
    let stmt;
    let rows: any[];

    if (appId) {
      stmt = sqlite.prepare(`SELECT * FROM mock_rules WHERE app_id = ? OR app_id = '*' ORDER BY created_at DESC`);
      rows = stmt.all(appId);
    } else {
      stmt = sqlite.prepare(`SELECT * FROM mock_rules ORDER BY created_at DESC`);
      rows = stmt.all();
    }

    return rows.map((r) => ({
      id: r.id,
      appId: r.app_id,
      action: r.action,
      response: this.parseJson(r.response || r.response_payload),
      responsePayload: this.parseJson(r.response_payload || r.response),
      delayMs: r.delay_ms,
      shouldFail: Boolean(r.should_fail),
      errorMessage: r.error_message || undefined,
      enabled: Boolean(r.enabled),
      createdAt: r.created_at,
    }));
  }

  public setMock(rule: MockRuleItem): MockRuleItem {
    const sqlite = this.dbService.getRawSqlite();
    const id = rule.id || `mock_${crypto.randomUUID()}`;
    const appId = rule.appId || '*';
    const action = rule.action;
    const resp = rule.response !== undefined ? rule.response : rule.responsePayload;
    const responseStr = this.stringifyJson(resp) || '{}';
    const delayMs = rule.delayMs || 0;
    const shouldFail = rule.shouldFail ? 1 : 0;
    const errorMessage = rule.errorMessage || null;
    const enabled = rule.enabled !== false ? 1 : 0;
    const createdAt = rule.createdAt || Date.now();

    // Check if existing rule for appId + action
    const existing = sqlite.prepare(`SELECT id FROM mock_rules WHERE app_id = ? AND action = ?`).get(appId, action) as { id: string } | undefined;

    if (existing) {
      sqlite.prepare(`
        UPDATE mock_rules
        SET response = ?, response_payload = ?, delay_ms = ?, should_fail = ?, error_message = ?, enabled = ?
        WHERE id = ?
      `).run(responseStr, responseStr, delayMs, shouldFail, errorMessage, enabled, existing.id);
      return {
        id: existing.id,
        appId,
        action,
        response: this.parseJson(responseStr),
        responsePayload: this.parseJson(responseStr),
        delayMs,
        shouldFail: Boolean(shouldFail),
        errorMessage: errorMessage || undefined,
        enabled: Boolean(enabled),
        createdAt,
      };
    } else {
      sqlite.prepare(`
        INSERT INTO mock_rules (id, app_id, action, response, response_payload, delay_ms, should_fail, error_message, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, appId, action, responseStr, responseStr, delayMs, shouldFail, errorMessage, enabled, createdAt);

      return {
        id,
        appId,
        action,
        response: this.parseJson(responseStr),
        responsePayload: this.parseJson(responseStr),
        delayMs,
        shouldFail: Boolean(shouldFail),
        errorMessage: errorMessage || undefined,
        enabled: Boolean(enabled),
        createdAt,
      };
    }
  }

  public deleteMock(actionOrId: string, appId?: string): boolean {
    const sqlite = this.dbService.getRawSqlite();
    let result;
    if (appId) {
      result = sqlite.prepare(`DELETE FROM mock_rules WHERE (action = ? OR id = ?) AND app_id = ?`).run(actionOrId, actionOrId, appId);
    } else {
      result = sqlite.prepare(`DELETE FROM mock_rules WHERE action = ? OR id = ?`).run(actionOrId, actionOrId);
    }
    return result.changes > 0;
  }

  public matchMock(action: string, appId: string = '*'): MockRuleItem | null {
    const sqlite = this.dbService.getRawSqlite();
    const row = sqlite.prepare(`
      SELECT * FROM mock_rules
      WHERE action = ? AND (app_id = ? OR app_id = '*') AND enabled = 1
      ORDER BY (CASE WHEN app_id = ? THEN 0 ELSE 1 END) ASC
      LIMIT 1
    `).get(action, appId, appId) as any;

    if (!row) return null;

    return {
      id: row.id,
      appId: row.app_id,
      action: row.action,
      response: this.parseJson(row.response || row.response_payload),
      responsePayload: this.parseJson(row.response_payload || row.response),
      delayMs: row.delay_ms,
      shouldFail: Boolean(row.should_fail),
      errorMessage: row.error_message || undefined,
      enabled: Boolean(row.enabled),
      createdAt: row.created_at,
    };
  }
}
