import React, { useState } from 'react';
import type { BridgeTrace } from '../types.js';

interface BridgeTracePanelProps {
  traces: BridgeTrace[];
  onClear: () => void;
}

const STATUS_COLORS: Record<BridgeTrace['status'], string> = {
  pending: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
};

const STATUS_LABELS: Record<BridgeTrace['status'], string> = {
  pending: '⏳ pending',
  success: '✅ success',
  error: '❌ error',
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#374151',
  },
  clearBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px',
    color: '#9ca3af',
    gap: '8px',
    fontSize: '13px',
  },
  traceItem: {
    borderBottom: '1px solid #f3f4f6',
    padding: '8px 12px',
    cursor: 'pointer',
  },
  traceItemHover: {
    backgroundColor: '#f9fafb',
  },
  traceTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  actionName: {
    fontWeight: 600,
    color: '#1f2937',
    fontSize: '12px',
  },
  rightMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  statusBadge: {
    padding: '1px 6px',
    borderRadius: '9999px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#fff',
  },
  latency: {
    color: '#6b7280',
    fontSize: '11px',
  },
  timestamp: {
    color: '#9ca3af',
    fontSize: '10px',
    marginBottom: '4px',
  },
  json: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    padding: '6px',
    marginTop: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontSize: '11px',
    color: '#374151',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  collapseLabel: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '4px',
  },
};

function TraceItem({ trace }: { trace: BridgeTrace }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(trace.timestamp).toLocaleTimeString();

  return (
    <div
      style={styles.traceItem}
      onClick={() => setExpanded((v) => !v)}
      data-testid="bridge-trace-item"
      data-action={trace.action}
    >
      <div style={styles.traceTop}>
        <span style={styles.actionName}>{trace.action}</span>
        <span style={styles.rightMeta}>
          {trace.latency > 0 && <span style={styles.latency}>{trace.latency}ms</span>}
          <span
            style={{
              ...styles.statusBadge,
              backgroundColor: STATUS_COLORS[trace.status],
            }}
          >
            {STATUS_LABELS[trace.status]}
          </span>
        </span>
      </div>
      <div style={styles.timestamp}>{date}</div>
      {expanded && (
        <>
          <div style={styles.collapseLabel}>▼ payload</div>
          <pre style={styles.json}>{JSON.stringify(trace.payload, null, 2)}</pre>
          {trace.response !== null && (
            <>
              <div style={styles.collapseLabel}>▼ response</div>
              <pre style={styles.json}>{JSON.stringify(trace.response, null, 2)}</pre>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function BridgeTracePanel({ traces, onClear }: BridgeTracePanelProps) {
  return (
    <div style={styles.panel} data-testid="bridge-trace-panel">
      <div style={styles.header}>
        <span style={styles.title}>🔌 Bridge Inspector</span>
        <button style={styles.clearBtn} onClick={onClear} aria-label="Clear bridge traces">
          Clear
        </button>
      </div>

      <div style={styles.list}>
        {traces.length === 0 ? (
          <div style={styles.emptyState} data-testid="bridge-trace-empty">
            <span>📭</span>
            <span>No bridge calls yet — click a showcase card to start</span>
          </div>
        ) : (
          traces.map((trace) => <TraceItem key={trace.id} trace={trace} />)
        )}
      </div>
    </div>
  );
}

export default BridgeTracePanel;
