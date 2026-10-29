import React, { useState, useMemo } from 'react';
import {
  Segmented,
  Select,
  Input,
  Button,
  Empty,
  Badge,
  Typography,
  Space,
  App,
} from 'antd';
import {
  CloudSyncOutlined,
  CopyOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  MobileOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import type { BridgeTrace } from '../../types/simulator';
import { TraceItemAccordion } from './TraceItemAccordion';
import { InspectorStats } from './InspectorStats';
import styles from './BridgeInspector.module.css';

const { Text, Title } = Typography;

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
  const { message } = App.useApp();
  const { traces, clearTraces, callBridge } = useSimulator();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'error'>('all');
  const [selectedLane, setSelectedLane] = useState<string>('all');

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

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
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

      if (selectedDomain !== 'All Domains' && trace.domain !== selectedDomain) {
        return false;
      }

      if (selectedStatus !== 'all' && trace.status !== selectedStatus) {
        return false;
      }

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
      message.success('Copied all bridge traces as JSON');
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
    message.success('Exported trace log file');
  };

  const laneOptions = [
    {
      label: (
        <span>
          <GlobalOutlined /> All Lanes{' '}
          <Badge count={laneCounts.all} overflowCount={999} style={{ backgroundColor: 'var(--goat-text-secondary)', marginLeft: 4 }} />
        </span>
      ),
      value: 'all',
    },
    {
      label: (
        <span>
          <ThunderboltOutlined /> AppService -&gt; AppView{' '}
          <Badge count={laneCounts.appservice_to_appview} overflowCount={999} style={{ backgroundColor: 'var(--goat-primary)', marginLeft: 4 }} />
        </span>
      ),
      value: 'appservice_to_appview',
    },
    {
      label: (
        <span>
          <MobileOutlined /> AppView -&gt; Native{' '}
          <Badge count={laneCounts.appview_to_native} overflowCount={999} style={{ backgroundColor: 'var(--goat-success)', marginLeft: 4 }} />
        </span>
      ),
      value: 'appview_to_native',
    },
    {
      label: (
        <span>
          <RollbackOutlined /> Native -&gt; AppView{' '}
          <Badge count={laneCounts.native_to_appview} overflowCount={999} style={{ backgroundColor: 'var(--goat-info)', marginLeft: 4 }} />
        </span>
      ),
      value: 'native_to_appview',
    },
  ];

  return (
    <div className={styles.inspectorWrapper} data-testid="live-bridge-ipc-inspector">
      {/* 1. Header Bar */}
      <div className={styles.headerBar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudSyncOutlined /> Live Bridge IPC Inspector
          </Title>
          <Text type="secondary" style={{ fontSize: 11 }}>(JSON-RPC Telemetry Stream)</Text>
        </div>

        <Space.Compact>
          <Button icon={<CopyOutlined />} onClick={handleCopyAll} disabled={traces.length === 0}>
            Copy All
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportJson} disabled={traces.length === 0}>
            Export JSON
          </Button>
          <Button icon={<DeleteOutlined />} danger onClick={clearTraces} disabled={traces.length === 0}>
            Clear Log
          </Button>
        </Space.Compact>
      </div>

      {/* 2. Stats Summary */}
      <InspectorStats traces={traces} />

      {/* 3. Thread Lane Tabs */}
      <div style={{ marginBottom: 16 }} data-testid="inspector-lane-tabs">
        <Segmented
          block
          value={selectedLane}
          onChange={(val) => setSelectedLane(val as string)}
          options={laneOptions}
        />
      </div>

      {/* 4. Search and Filters */}
      <div className={styles.filtersBar} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Filter by action name, JSON params, or lane..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{ flex: 1 }}
          data-testid="inspector-search-input"
        />

        <Select
          style={{ width: 160 }}
          value={selectedDomain}
          onChange={(val) => setSelectedDomain(val)}
          options={DOMAIN_OPTIONS.map((d) => ({ value: d, label: d }))}
          data-testid="inspector-domain-filter"
        />

        <Select
          style={{ width: 160 }}
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val as any)}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'success', label: 'Success Only (200)' },
            { value: 'error', label: 'Errors Only (ERR)' },
          ]}
          data-testid="inspector-status-filter"
        />
      </div>

      {/* 5. Live Trace Stream */}
      <div className={styles.traceList} data-testid="trace-list-container">
        {filteredTraces.length === 0 ? (
          <Empty
            description="No Bridge Calls Recorded Yet. Interact with the Device Simulator or Component Playgrounds to stream real-time JSON-RPC telemetry."
            style={{ margin: '48px 0' }}
            data-testid="bridge-trace-empty"
          />
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
