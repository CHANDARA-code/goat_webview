/**
 * @goat/bridge-mock - Domain 18: Capability Discovery & APM Telemetry Handlers (14 Actions)
 */

import { mockState } from '../state/store.js';
import {
  ApiCapabilityResult,
  ProcessSandboxStatusResult,
  StartupBenchmarkReportResult,
  ApmMetricsPayload,
  ApmSummaryResult,
  MemoryMetricsResult,
  TraceSpanResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class ApmHandlers {
  private static metricCounter: number = 0;
  private static spanCounter: number = 0;

  /**
   * Action 184: GET_API_CAPABILITIES
   */
  public static getApiCapabilities(payload: any = {}, supportedActionsCatalog: Set<string>): { totalCapabilities: number; capabilities: ApiCapabilityResult[] } {
    const category = payload.category ? String(payload.category).toUpperCase() : undefined;
    const list: ApiCapabilityResult[] = [];

    for (const action of supportedActionsCatalog) {
      const actCat = this.inferCategory(action);
      if (!category || actCat === category) {
        list.push({
          actionName: action,
          category: actCat,
          isSupported: true,
        });
      }
    }

    // Add dynamically registered capabilities
    for (const cap of mockState.dynamicCapabilities.values()) {
      if (!category || cap.category === category) {
        list.push(cap);
      }
    }

    return { totalCapabilities: list.length, capabilities: list };
  }

  /**
   * Action 185: REGISTER_CAPABILITY
   */
  public static registerCapability(payload: any = {}): { registered: boolean; actionName: string } {
    const actionName = payload.actionName || payload.action;
    if (!actionName) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "actionName"');
    }
    const category = payload.category || 'CUSTOM_PLUGIN';
    const isSupported = payload.isSupported !== false;

    mockState.dynamicCapabilities.set(actionName.toUpperCase(), {
      actionName: actionName.toUpperCase(),
      category: category.toUpperCase(),
      isSupported,
    });

    return { registered: true, actionName };
  }

  /**
   * Action 186: GET_SANDBOX_PROCESS_STATUS
   */
  public static getSandboxProcessStatus(payload: any = {}, callerAppId: string = mockState.defaultAppId): ProcessSandboxStatusResult {
    const appId = payload.appId || callerAppId;
    return {
      pid: 48921,
      isAlive: true,
      isInitialized: true,
      activeAppId: appId,
      isolatedProcessName: `:sandboxed_process_${appId}`,
    };
  }

  /**
   * Action 187: GET_STARTUP_BENCHMARK_REPORT
   */
  public static getStartupBenchmarkReport(): StartupBenchmarkReportResult {
    return { ...mockState.startupBenchmark };
  }

  /**
   * Action 188: RECORD_STARTUP_BENCHMARK_SAMPLE
   */
  public static recordStartupBenchmarkSample(payload: any = {}): { recorded: boolean; coldStartTimeMs: number; warmStartTimeMs: number } {
    const cold = typeof payload.coldStartTimeMs === 'number' ? payload.coldStartTimeMs : 120;
    const warm = typeof payload.warmStartTimeMs === 'number' ? payload.warmStartTimeMs : 25;

    mockState.startupBenchmark.coldStartTimeMs = cold;
    mockState.startupBenchmark.warmStartTimeMs = warm;
    mockState.startupBenchmark.totalSamples++;

    return { recorded: true, coldStartTimeMs: cold, warmStartTimeMs: warm };
  }

  /**
   * Action 189 / 190: REPORT_METRICS / SEND_APM_METRIC
   */
  public static reportMetrics(payload: ApmMetricsPayload = {}): { recorded: boolean; id: string; isSlaViolation: boolean; violationReason?: string } {
    const id = `apm_${++this.metricCounter}`;
    mockState.apmMetrics.push({ ...payload });

    // Check SLA violation (e.g. LCP > 2500ms or INP > 200ms)
    let isSlaViolation = false;
    let violationReason: string | undefined;

    if (payload.lcpMs && payload.lcpMs > 2500) {
      isSlaViolation = true;
      violationReason = `LCP of ${payload.lcpMs}ms exceeded SLA threshold of 2500ms`;
    } else if (payload.inpMs && payload.inpMs > 200) {
      isSlaViolation = true;
      violationReason = `INP of ${payload.inpMs}ms exceeded SLA threshold of 200ms`;
    }

    return { recorded: true, id, isSlaViolation, violationReason };
  }

  /**
   * Action 191 / 192: GET_APM_METRICS / GET_APM_SUMMARY
   */
  public static getApmMetrics(): ApmSummaryResult {
    const reports = mockState.apmMetrics;
    let totalFcp = 0;
    let totalLcp = 0;
    let totalBridge = 0;
    let violations = 0;

    for (const r of reports) {
      if (r.fcpMs) totalFcp += r.fcpMs;
      if (r.lcpMs) {
        totalLcp += r.lcpMs;
        if (r.lcpMs > 2500) violations++;
      }
      if (r.bridgeLatencyAvgMs) totalBridge += r.bridgeLatencyAvgMs;
    }

    const count = Math.max(1, reports.length);

    return {
      totalReports: reports.length,
      avgFcpMs: reports.length > 0 ? Number((totalFcp / count).toFixed(2)) : 120.5,
      avgLcpMs: reports.length > 0 ? Number((totalLcp / count).toFixed(2)) : 340.2,
      avgBridgeLatencyMs: reports.length > 0 ? Number((totalBridge / count).toFixed(2)) : 4.8,
      totalSlaViolations: violations,
    };
  }

  /**
   * Action 193: RECORD_BRIDGE_TIMING
   */
  public static recordBridgeTiming(payload: any = {}): { recorded: boolean; action: string; durationMs: number; id: string } {
    const action = payload.action || 'UNKNOWN';
    const durationMs = typeof payload.durationMs === 'number' ? payload.durationMs : 1.5;
    const id = `timing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    mockState.bridgeTimings.push({ action, durationMs, id });
    return { recorded: true, action, durationMs, id };
  }

  /**
   * Action 194: START_TRACE
   */
  public static startTrace(payload: any = {}): TraceSpanResult {
    const opName = payload.operationName || payload.name || `trace_span_${++this.spanCounter}`;
    const genHex = (len: number) => {
      let str = '';
      while (str.length < len) {
        str += Math.random().toString(16).substring(2);
      }
      return str.substring(0, len);
    };
    const spanId = genHex(16);
    const traceId = genHex(32);
    const traceparent = `00-${traceId}-${spanId}-01`;
    const startTimeMs = Date.now();

    mockState.activeSpans.set(spanId, {
      spanId,
      traceId,
      opName,
      startMs: startTimeMs,
      traceparent,
    });

    return {
      traceparent,
      traceId,
      spanId,
      operationName: opName,
      startTimeMs,
    };
  }

  /**
   * Action 195: STOP_TRACE
   */
  public static stopTrace(payload: any = {}): { stopped: boolean; spanId: string; durationMs: number } {
    const spanId = payload.spanId;
    if (spanId && mockState.activeSpans.has(spanId)) {
      const active = mockState.activeSpans.get(spanId)!;
      const durationMs = Date.now() - active.startMs;
      mockState.activeSpans.delete(spanId);
      mockState.completedSpans.push({
        spanId,
        traceId: active.traceId,
        opName: active.opName,
        durationMs,
      });
      return { stopped: true, spanId, durationMs };
    }
    return { stopped: true, spanId: spanId || '', durationMs: 0 };
  }

  /**
   * Action 196: GET_TRACES
   */
  public static getTraces(): { activeSpanCount: number; completedSpanCount: number } {
    return {
      activeSpanCount: mockState.activeSpans.size,
      completedSpanCount: mockState.completedSpans.length,
    };
  }

  /**
   * Action 197: GET_MEMORY_METRICS
   */
  public static getMemoryMetrics(): MemoryMetricsResult {
    return {
      totalMemoryMb: 256.0,
      freeMemoryMb: 142.5,
      usedMemoryMb: 113.5,
      maxMemoryMb: 512.0,
    };
  }

  private static inferCategory(action: string): string {
    const act = action.toUpperCase();
    if (act.includes('STORAGE') || act.includes('COOKIE') || act.includes('HTTP_AUTH')) return 'STORAGE';
    if (act.includes('FS_') || act.includes('FILE')) return 'FILESYSTEM';
    if (act.includes('API_') || act.includes('WEBSOCKET') || act.includes('DOWNLOAD') || act.includes('UPLOAD') || act.includes('SSL') || act.includes('NETWORK')) return 'NETWORK';
    if (act.includes('TOAST') || act.includes('MODAL') || act.includes('LOADING') || act.includes('NAV_BAR') || act.includes('BOTTOM_SHEET') || act.includes('TAB_') || act.includes('MINI_APP') || act.includes('INSETS')) return 'UI';
    if (act.includes('ACCELEROMETER') || act.includes('GYROSCOPE') || act.includes('COMPASS') || act.includes('MOTION') || act.includes('PHONE') || act.includes('SMS')) return 'SENSORS';
    if (act.includes('LOCATION') || act.includes('GEOFENCE')) return 'LOCATION';
    if (act.includes('BIOMETRIC') || act.includes('PERMISSION') || act.includes('SETTING') || act.includes('AUTHORIZE') || act.includes('SANDBOX_HEADERS')) return 'SECURITY';
    if (act.includes('SCAN') || act.includes('MEDIA') || act.includes('IMAGE') || act.includes('AUDIO')) return 'MEDIA';
    if (act.includes('CONTACT') || act.includes('SHARE')) return 'CONTACTS';
    if (act.includes('PUSH')) return 'PUSH';
    if (act.includes('BLE') || act.includes('NFC')) return 'HARDWARE';
    if (act.includes('WEB3') || act.includes('PAYMENT') || act.includes('INVOICE') || act.includes('PURCHASE')) return 'PAYMENT';
    if (act.includes('BINARY')) return 'BINARY_IPC';
    if (act.includes('NAV_') || act.includes('BACK') || act.includes('HISTORY') || act.includes('PAGE_STACK') || act.includes('PREDICTIVE')) return 'NAVIGATION';
    if (act.includes('SUBPACKAGE') || act.includes('BYTECODE') || act.includes('WASM')) return 'RUNTIME';
    if (act.includes('RENDER') || act.includes('TRANSPARENCY') || act.includes('THEME') || act.includes('NATIVE_VIEW')) return 'RENDER';
    return 'CORE';
  }
}
