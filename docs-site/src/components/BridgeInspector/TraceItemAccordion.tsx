import React, { useState } from 'react';
import type { BridgeTrace } from '../../types/simulator';
import { JsonViewer } from '../Common/JsonViewer';
import styles from './BridgeInspector.module.css';

interface TraceItemAccordionProps {
  trace: BridgeTrace;
  onReplay: (trace: BridgeTrace) => void;
}

export const TraceItemAccordion: React.FC<TraceItemAccordionProps> = ({ trace, onReplay }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedEnvelope, setCopiedEnvelope] = useState(false);

  const formattedTime = new Date(trace.timestamp).toLocaleTimeString();

  // Normalize lane attribution
  const threadLane =
    trace.threadLane ||
    (trace.action.includes('UI_PATCH')
      ? 'appservice_to_appview'
      : trace.action.includes('PUSH') || trace.action.includes('EVENT')
      ? 'native_to_appview'
      : 'appview_to_native');

  // Compute 3-Stage Latency Breakdown: T_worker_ipc, T_native_exec, T_dom_flush
  const totalDuration = Math.max(trace.latencyMs || 0, 0.1);
  const workerIpcLatency =
    trace.workerIpcLatencyMs !== undefined
      ? trace.workerIpcLatencyMs
      : Math.max(0.4, Number((totalDuration * 0.18).toFixed(1)));
  const nativeExecLatency =
    trace.nativeExecutionLatencyMs !== undefined
      ? trace.nativeExecutionLatencyMs
      : Math.max(0.6, Number((totalDuration * 0.68).toFixed(1)));
  const domRenderLatency =
    trace.domRenderLatencyMs !== undefined
      ? trace.domRenderLatencyMs
      : Math.max(0.2, Number((totalDuration - workerIpcLatency - nativeExecLatency).toFixed(1)));

  const totalCalculated = +(workerIpcLatency + nativeExecLatency + domRenderLatency).toFixed(1);
  const workerPct = Math.max(8, Math.min(80, Math.round((workerIpcLatency / totalCalculated) * 100)));
  const nativePct = Math.max(15, Math.min(85, Math.round((nativeExecLatency / totalCalculated) * 100)));
  const domPct = Math.max(5, 100 - workerPct - nativePct);

  const isWarmPath = totalCalculated < 5.0 || trace.latencyMs < 5.0;

  const handleCopyEnvelope = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
      setCopiedEnvelope(true);
      setTimeout(() => setCopiedEnvelope(false), 2000);
    } catch (err) {
      console.error('Failed to copy envelope', err);
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReplay(trace);
  };

  const renderLaneBadge = () => {
    switch (threadLane) {
      case 'appservice_to_appview':
      case 'AppService':
        return <span className={`${styles.laneBadge} ${styles.laneBadgeWorker}`}>⚡ Worker ➔ View</span>;
      case 'appview_to_native':
      case 'AppView':
        return <span className={`${styles.laneBadge} ${styles.laneBadgeNative}`}>📱 View ➔ Native</span>;
      case 'native_to_appview':
      case 'Host':
      case 'native':
        return <span className={`${styles.laneBadge} ${styles.laneBadgeHost}`}>↩ Native ➔ View</span>;
      case 'appview_to_appservice':
        return <span className={`${styles.laneBadge} ${styles.laneBadgeReply}`}>↩ View ➔ Worker</span>;
      default:
        return <span className={`${styles.laneBadge} ${styles.laneBadgeNative}`}>📱 {threadLane}</span>;
    }
  };

  return (
    <div className={styles.traceCard} data-testid="bridge-trace-card" data-action={trace.action}>
      <div className={styles.traceSummary} onClick={() => setExpanded(!expanded)}>
        <div className={styles.traceLeft}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{formattedTime}</span>
          {renderLaneBadge()}
          <span className={styles.domainBadge}>{trace.domain}</span>
          {trace.seqId !== undefined && (
            <span className={styles.seqBadge} title="Sequence ID">#{trace.seqId}</span>
          )}
          {trace.batchId && (
            <span className={styles.seqBadge} title="Batch ID">📦 {trace.batchId}</span>
          )}
          <span className={styles.actionName}>{trace.action}</span>
        </div>

        <div className={styles.traceRight}>
          {trace.latencyMs > 0 && (
            <span
              className={styles.latencyBadge}
              style={{
                color:
                  trace.latencyMs < 5
                    ? '#34d399'
                    : trace.latencyMs < 50
                    ? '#38bdf8'
                    : trace.latencyMs < 120
                    ? '#fbbf24'
                    : '#f87171',
              }}
            >
              {trace.latencyMs}ms
            </span>
          )}

          <span
            className={`${styles.statusBadge} ${
              trace.status === 'success'
                ? styles.statusSuccess
                : trace.status === 'error'
                ? styles.statusError
                : styles.statusPending
            }`}
          >
            {trace.status === 'success' ? '✓ 200' : trace.status === 'error' ? '✕ ERR' : '⏳ PENDING'}
          </span>

          <span style={{ color: '#94a3b8', fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.traceDetail}>
          {/* Header Metadata and Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>ID: <code>{trace.id}</code></span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={styles.btnSmall}
                onClick={handleCopyEnvelope}
                title="Copy entire JSON-RPC envelope"
              >
                {copiedEnvelope ? '✓ Copied Envelope' : 'Copy Envelope'}
              </button>
              <button
                className={styles.btnSmall}
                onClick={handleReplay}
                style={{ background: '#4338ca', color: '#ffffff', borderColor: '#4f46e5' }}
                title="Re-execute this action on the bridge"
              >
                ↻ Replay Call
              </button>
            </div>
          </div>

          {/* 3-Stage Latency Waterfall Breakdown Display */}
          <div className={styles.waterfallContainer} data-testid="latency-waterfall-container">
            <div className={styles.waterfallHeader}>
              <span className={styles.waterfallTitle}>
                <span>⏱️</span>
                <span>3-Stage Latency Waterfall Breakdown</span>
              </span>
              <span className={styles.warmPathBadge}>
                {isWarmPath ? '✓ Warm-Path Target Verified (<5ms)' : `Total: ${totalCalculated}ms`}
              </span>
            </div>

            {/* Segmented Waterfall Progress Bar */}
            <div className={styles.waterfallBar} title={`Worker IPC: ${workerIpcLatency}ms | Native Exec: ${nativeExecLatency}ms | DOM Flush: ${domRenderLatency}ms`}>
              <div
                className={styles.waterfallSegmentWorker}
                style={{ width: `${workerPct}%` }}
                title={`Stage 1: T_worker_ipc (${workerIpcLatency}ms - ${workerPct}%)`}
              />
              <div
                className={styles.waterfallSegmentNative}
                style={{ width: `${nativePct}%` }}
                title={`Stage 2: T_native_exec (${nativeExecLatency}ms - ${nativePct}%)`}
              />
              <div
                className={styles.waterfallSegmentRender}
                style={{ width: `${domPct}%` }}
                title={`Stage 3: T_dom_flush (${domRenderLatency}ms - ${domPct}%)`}
              />
            </div>

            {/* Metric Breakdown Cards */}
            <div className={styles.waterfallGrid}>
              <div className={styles.waterfallCard}>
                <span className={styles.waterfallCardLabel}>
                  <span style={{ color: '#c084fc' }}>🟣</span> T_worker_ipc
                </span>
                <span className={styles.waterfallCardValue}>{workerIpcLatency} ms</span>
                <span className={styles.waterfallCardPct}>Worker IPC Transit ({workerPct}%)</span>
              </div>

              <div className={styles.waterfallCard}>
                <span className={styles.waterfallCardLabel}>
                  <span style={{ color: '#60a5fa' }}>🔵</span> T_native_exec
                </span>
                <span className={styles.waterfallCardValue}>{nativeExecLatency} ms</span>
                <span className={styles.waterfallCardPct}>Native Host Execution ({nativePct}%)</span>
              </div>

              <div className={styles.waterfallCard}>
                <span className={styles.waterfallCardLabel}>
                  <span style={{ color: '#34d399' }}>🟢</span> T_dom_flush
                </span>
                <span className={styles.waterfallCardValue}>{domRenderLatency} ms</span>
                <span className={styles.waterfallCardPct}>DOM Flush / Reply ({domPct}%)</span>
              </div>
            </div>

            {/* Formula Notation Display */}
            <div className={styles.waterfallFormula}>
              <span>
                <strong>Formula:</strong> <code>T_total = T_worker_ipc + T_native_exec + T_dom_flush</code>
              </span>
              <span>
                <code>{totalCalculated} ms = {workerIpcLatency}ms + {nativeExecLatency}ms + {domRenderLatency}ms</code>
              </span>
            </div>
          </div>

          {/* Request Payload */}
          <JsonViewer data={trace.payload} label="Request Payload (Params)" defaultExpanded={true} />

          {/* Response */}
          {trace.response && (
            <JsonViewer
              data={trace.response}
              label="Native Bridge Response"
              defaultExpanded={true}
            />
          )}

          {/* Error Message */}
          {trace.errorMessage && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: '11px',
                marginTop: '6px',
              }}
            >
              <strong>Error: </strong> {trace.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
