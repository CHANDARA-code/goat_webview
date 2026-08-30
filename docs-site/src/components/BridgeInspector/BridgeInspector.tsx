import React, { useState, useMemo } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import type { BridgeTrace } from '../../types/simulator';
import { TraceItemAccordion } from './TraceItemAccordion';
import { InspectorStats } from './InspectorStats';
import styles from './BridgeInspector.module.css';

const DOMAIN_OPTIONS = [
  'All Domains',
  'Navigation',
  'UI Sheet',
  'Permissions',
  'Security',
  'Sensors',
  'Biometrics',
  'Geolocation',
  'Hardware',
  'Network',
  'Storage',
  'Core',
];

export const BridgeInspector: React.FC = () => {
  const { traces, clearTraces, callBridge } = useSimulator();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'error'>('all');
  const [selectedLane, setSelectedLane] = useState<string>('all');
  const [copiedAll, setCopiedAll] = useState(false);

  // Compute lane counts for badges
  const laneCounts = useMemo(() => {
    let workerCount = 0;
    let nativeCount = 0;
    let hostCount = 0;

    for (const t of traces) {
      if (t.threadLane === 'appservice_to_appview' || t.action.includes('UI_PATCH')) {
        workerCount++;
      } else if (t.threadLane === 'native_to_appview' || t.threadLane === 'Host' || t.threadLane === 'native') {
        hostCount++;
      } else {
        nativeCount++;
      }
    }

    return {
      all: traces.length,
      appservice_to_appview: workerCount,
      appview_to_native: nativeCount,
      native_to_appview: hostCount,
    };
  }, [traces]);

  // Filter traces based on query, domain, status, and thread lane
  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      // Thread Lane filter
      if (selectedLane !== 'all') {
        if (selectedLane === 'appservice_to_appview') {
          if (trace.threadLane !== 'appservice_to_appview' && !trace.action.includes('UI_PATCH')) {
            return false;
          }
        } else if (selectedLane === 'native_to_appview') {
          if (trace.threadLane !== 'native_to_appview' && trace.threadLane !== 'Host' && trace.threadLane !== 'native') {
            return false;
          }
        } else if (selectedLane === 'appview_to_native') {
          if (trace.threadLane && trace.threadLane !== 'appview_to_native' && trace.threadLane !== 'AppView') {
            return false;
          }
        }
      }

      // Domain filter
      if (selectedDomain !== 'All Domains' && trace.domain !== selectedDomain) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && trace.status !== selectedStatus) {
        return false;
      }

      // Search Query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesAction = trace.action.toLowerCase().includes(q);
        const matchesPayload = JSON.stringify(trace.payload).toLowerCase().includes(q);
        const matchesResponse = JSON.stringify(trace.response || {}).toLowerCase().includes(q);
        const matchesDomain = trace.domain.toLowerCase().includes(q);
        const matchesLane = trace.threadLane?.toLowerCase().includes(q);
        return matchesAction || matchesPayload || matchesResponse || matchesDomain || !!matchesLane;
      }

      return true;
    });
  }, [traces, searchQuery, selectedDomain, selectedStatus, selectedLane]);

  const handleReplay = (trace: BridgeTrace) => {
    callBridge(trace.action, trace.payload, trace.domain);
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(traces, null, 2));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy traces', err);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(traces, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `goat-bridge-traces-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={styles.inspectorWrapper} data-testid="live-bridge-ipc-inspector">
      {/* 1. Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <span>🔌</span>
          <span>Live Bridge IPC Inspector</span>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
            (JSON-RPC Telemetry Stream)
          </span>
        </div>

        <div className={styles.actionControls}>
          <button
            className={styles.btnSmall}
            onClick={handleCopyAll}
            disabled={traces.length === 0}
            title="Copy all traces as JSON"
          >
            {copiedAll ? '✓ Copied All' : 'Copy All'}
          </button>
          <button
            className={styles.btnSmall}
            onClick={handleExportJson}
            disabled={traces.length === 0}
            title="Export JSON file"
          >
            Export JSON
          </button>
          <button
            className={styles.btnSmall}
            onClick={clearTraces}
            disabled={traces.length === 0}
            style={{ color: '#f87171' }}
            title="Clear current trace log"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* 2. Stats Summary */}
      <InspectorStats traces={traces} />

      {/* 3. Thread Lane Tabs */}
      <div className={styles.laneTabBar} data-testid="inspector-lane-tabs">
        <button
          className={`${styles.laneTabBtn} ${selectedLane === 'all' ? styles.laneTabActiveAll : ''}`}
          onClick={() => setSelectedLane('all')}
          data-testid="lane-tab-all"
        >
          <span>🌐 All Lanes</span>
          <span className={styles.laneBadgeCount}>{laneCounts.all}</span>
        </button>

        <button
          className={`${styles.laneTabBtn} ${selectedLane === 'appservice_to_appview' ? styles.laneTabActiveWorker : ''}`}
          onClick={() => setSelectedLane('appservice_to_appview')}
          data-testid="lane-tab-worker"
        >
          <span>⚡ AppService → AppView</span>
          <span className={styles.laneBadgeCount}>{laneCounts.appservice_to_appview}</span>
        </button>

        <button
          className={`${styles.laneTabBtn} ${selectedLane === 'appview_to_native' ? styles.laneTabActiveNative : ''}`}
          onClick={() => setSelectedLane('appview_to_native')}
          data-testid="lane-tab-native"
        >
          <span>📱 AppView → Native</span>
          <span className={styles.laneBadgeCount}>{laneCounts.appview_to_native}</span>
        </button>

        <button
          className={`${styles.laneTabBtn} ${selectedLane === 'native_to_appview' ? styles.laneTabActiveHost : ''}`}
          onClick={() => setSelectedLane('native_to_appview')}
          data-testid="lane-tab-host"
        >
          <span>↩ Native → AppView</span>
          <span className={styles.laneBadgeCount}>{laneCounts.native_to_appview}</span>
        </button>
      </div>

      {/* 4. Search and Filters */}
      <div className={styles.filtersBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Filter by action name, JSON params, or lane..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="inspector-search-input"
        />

        <select
          className={styles.domainSelect}
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          data-testid="inspector-domain-filter"
        >
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className={styles.domainSelect}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
          data-testid="inspector-status-filter"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success Only (✓ 200)</option>
          <option value="error">Errors Only (✕ ERR)</option>
        </select>
      </div>

      {/* 5. Live Trace Stream */}
      <div className={styles.traceList} data-testid="trace-list-container">
        {filteredTraces.length === 0 ? (
          <div className={styles.emptyState} data-testid="bridge-trace-empty">
            <span style={{ fontSize: '32px' }}>📡</span>
            <span style={{ fontWeight: 600 }}>No Bridge Calls Recorded Yet</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Interact with the Device Simulator or Component Playgrounds to stream real-time JSON-RPC telemetry.
            </span>
          </div>
        ) : (
          filteredTraces.map((trace) => (
            <TraceItemAccordion key={trace.id} trace={trace} onReplay={handleReplay} />
          ))
        )}
      </div>
    </div>
  );
};

export default BridgeInspector;
