import React from 'react';
import { CheckCircleOutlined, ThunderboltOutlined, BugOutlined } from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import styles from './Workspace.module.css';

export const StatusBar: React.FC = () => {
  const { executableActionCount, stats, chaosConfig } = useSimulator();

  const formattedTime = stats.lastRunTimestamp
    ? new Date(stats.lastRunTimestamp).toLocaleTimeString()
    : 'Never';

  return (
    <footer className={styles.statusBar} aria-label="Simulator Status Bar">
      <div className={styles.statusItem}>
        <CheckCircleOutlined style={{ color: 'var(--goat-success)' }} />
        <span className={styles.coverageBadge}>
          {executableActionCount} Actions Executable
        </span>
        <span style={{ color: 'var(--goat-text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--goat-text-secondary)' }}>@goat/bridge-mock</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {chaosConfig.enabled && (
          <div className={styles.statusItem} style={{ color: 'var(--goat-error)' }}>
            <BugOutlined />
            <span>Chaos: {chaosConfig.failureRate}%</span>
          </div>
        )}

        <div className={styles.statusItem}>
          <span>Calls: <strong>{stats.totalCalls}</strong></span>
        </div>

        <div className={styles.statusItem}>
          <span>Errors: <strong style={{ color: stats.totalErrors > 0 ? 'var(--goat-error)' : 'inherit' }}>{stats.totalErrors}</strong></span>
        </div>

        <div className={styles.statusItem}>
          <span>Last Run: <strong>{formattedTime}</strong></span>
        </div>

        <div className={styles.statusItem} style={{ color: 'var(--goat-text-tertiary)', fontSize: 10 }}>
          <span>⌘↵ Run</span>
          <span>·</span>
          <span>⌘B Rail</span>
          <span>·</span>
          <span>⌘J Dock</span>
        </div>
      </div>
    </footer>
  );
};

export default StatusBar;
