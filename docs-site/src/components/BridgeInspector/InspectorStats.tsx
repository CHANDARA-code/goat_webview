import React from 'react';
import type { BridgeTrace } from '../../types/simulator';
import styles from './BridgeInspector.module.css';

interface InspectorStatsProps {
  traces: BridgeTrace[];
}

export const InspectorStats: React.FC<InspectorStatsProps> = ({ traces }) => {
  const total = traces.length;
  const successCount = traces.filter((t) => t.status === 'success').length;
  const errorCount = traces.filter((t) => t.status === 'error').length;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 100;

  const totalLatency = traces.reduce((acc, t) => acc + (t.latencyMs || 0), 0);
  const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0;

  return (
    <div className={styles.statsBar} data-testid="inspector-stats-bar">
      <div className={styles.statItem}>
        <span>Total Calls:</span>
        <span className={styles.statValue}>{total}</span>
      </div>

      <div className={styles.statItem}>
        <span>Success:</span>
        <span className={styles.statValue} style={{ color: '#34d399' }}>
          {successCount} ({successRate}%)
        </span>
      </div>

      <div className={styles.statItem}>
        <span>Errors:</span>
        <span className={styles.statValue} style={{ color: errorCount > 0 ? '#f87171' : '#94a3b8' }}>
          {errorCount}
        </span>
      </div>

      <div className={styles.statItem}>
        <span>Avg Latency:</span>
        <span className={styles.statValue} style={{ color: '#38bdf8' }}>
          {avgLatency} ms
        </span>
      </div>

      <div className={styles.statItem} style={{ marginLeft: 'auto' }}>
        <span>Session:</span>
        <span className={styles.statValue} style={{ fontFamily: 'monospace', fontSize: '10px' }}>
          goat-dev-sess
        </span>
      </div>
    </div>
  );
};
