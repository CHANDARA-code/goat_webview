import React, { useState } from 'react';
import { Tag, Button, Collapse, App, Space, Typography, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CopyOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  MobileOutlined,
  RollbackOutlined,
  ClockCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { BridgeTrace } from '../../types/simulator';
import { JsonViewer } from '../Common/JsonViewer';
import styles from './BridgeInspector.module.css';

const { Text } = Typography;

interface TraceItemAccordionProps {
  trace: BridgeTrace;
  onReplay: (trace: BridgeTrace) => void;
}

export const TraceItemAccordion: React.FC<TraceItemAccordionProps> = ({ trace, onReplay }) => {
  const { message } = App.useApp();
  const [activeKey, setActiveKey] = useState<string | string[]>([]);

  const formattedTime = new Date(trace.timestamp).toLocaleTimeString();

  const threadLane =
    trace.threadLane ||
    (trace.action.includes('UI_PATCH')
      ? 'appservice_to_appview'
      : trace.action.includes('PUSH') || trace.action.includes('EVENT')
      ? 'native_to_appview'
      : 'appview_to_native');

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
      message.success('Copied JSON-RPC trace envelope');
    } catch (err) {
      console.error('Failed to copy envelope', err);
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReplay(trace);
  };

  const renderStatusTag = () => {
    if (trace.status === 'success') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>200 OK</Tag>;
    }
    if (trace.status === 'error') {
      return <Tag color="error" icon={<CloseCircleOutlined />}>ERR</Tag>;
    }
    return <Tag color="processing" icon={<SyncOutlined spin />}>PENDING</Tag>;
  };

  const renderLaneTag = () => {
    switch (threadLane) {
      case 'appservice_to_appview':
      case 'AppService':
        return <Tag color="purple" icon={<ThunderboltOutlined />}>Worker -&gt; View</Tag>;
      case 'appview_to_native':
      case 'AppView':
        return <Tag color="blue" icon={<MobileOutlined />}>View -&gt; Native</Tag>;
      case 'native_to_appview':
      case 'Host':
      case 'native':
        return <Tag color="cyan" icon={<RollbackOutlined />}>Native -&gt; View</Tag>;
      default:
        return <Tag color="default" icon={<MobileOutlined />}>{threadLane}</Tag>;
    }
  };

  const panelHeader = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <Space wrap size="small">
        <Text type="secondary" style={{ fontSize: 11 }}>{formattedTime}</Text>
        {renderLaneTag()}
        <Tag color="geekblue">{trace.domain}</Tag>
        {trace.seqId !== undefined && <Tag style={{ fontSize: 10 }}>#{trace.seqId}</Tag>}
        {trace.batchId && (
          <Tag icon={<InboxOutlined />} style={{ fontSize: 10 }}>
            {trace.batchId}
          </Tag>
        )}
        <Text strong>
          {trace.action}
        </Text>
      </Space>

      <Space size="small">
        {trace.latencyMs > 0 && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
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
          </Text>
        )}
        {renderStatusTag()}
      </Space>
    </div>
  );

  return (
    <div className={styles.traceCard} data-testid="bridge-trace-card" data-action={trace.action} style={{ marginBottom: 8 }}>
      <Collapse
        activeKey={activeKey}
        onChange={(keys) => setActiveKey(keys)}
        items={[
          {
            key: trace.id,
            label: panelHeader,
            children: (
              <div className={styles.traceDetail}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ID: <code>{trace.id}</code>
                  </Text>
                  <Space size="small">
                    <Button icon={<CopyOutlined />} size="small" onClick={handleCopyEnvelope}>
                      Copy Envelope
                    </Button>
                    <Button type="primary" icon={<ReloadOutlined />} size="small" onClick={handleReplay}>
                      Replay Call
                    </Button>
                  </Space>
                </div>

                {/* 3-Stage Latency Waterfall */}
                <div className={styles.waterfallContainer} data-testid="latency-waterfall-container" style={{ marginBottom: 12 }}>
                  <div className={styles.waterfallHeader}>
                    <Text strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClockCircleOutlined /> 3-Stage Latency Waterfall Breakdown
                    </Text>
                    <Tag color={isWarmPath ? 'success' : 'default'}>
                      {isWarmPath ? 'Warm-Path Target Verified (<5ms)' : `Total: ${totalCalculated}ms`}
                    </Tag>
                  </div>

                  <div
                    className={styles.waterfallBar}
                    style={{ height: 8, borderRadius: 4, display: 'flex', overflow: 'hidden', margin: '8px 0', backgroundColor: '#334155' }}
                  >
                    <div className={styles.waterfallSegmentWorker} style={{ width: `${workerPct}%`, backgroundColor: '#c084fc' }} />
                    <div className={styles.waterfallSegmentNative} style={{ width: `${nativePct}%`, backgroundColor: '#60a5fa' }} />
                    <div className={styles.waterfallSegmentRender} style={{ width: `${domPct}%`, backgroundColor: '#34d399' }} />
                  </div>

                  <div className={styles.waterfallGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                    <div className={styles.waterfallCard}>
                      <Text style={{ fontSize: 10, color: '#c084fc', display: 'block' }}>T_worker_ipc</Text>
                      <Text strong style={{ fontSize: 12 }}>{workerIpcLatency} ms</Text>
                    </div>
                    <div className={styles.waterfallCard}>
                      <Text style={{ fontSize: 10, color: '#60a5fa', display: 'block' }}>T_native_exec</Text>
                      <Text strong style={{ fontSize: 12 }}>{nativeExecLatency} ms</Text>
                    </div>
                    <div className={styles.waterfallCard}>
                      <Text style={{ fontSize: 10, color: '#34d399', display: 'block' }}>T_dom_flush</Text>
                      <Text strong style={{ fontSize: 12 }}>{domRenderLatency} ms</Text>
                    </div>
                  </div>
                </div>

                <JsonViewer data={trace.payload} label="Request Payload (Params)" defaultExpanded={true} />

                {trace.response && (
                  <div style={{ marginTop: 8 }}>
                    <JsonViewer data={trace.response} label="Native Bridge Response" defaultExpanded={true} />
                  </div>
                )}

                {trace.errorMessage && (
                  <Alert
                    type="error"
                    showIcon
                    message="Bridge Error"
                    description={trace.errorMessage}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
