import React from 'react';
import { Row, Col, Statistic, Card } from 'antd';
import type { BridgeTrace } from '../../types/simulator';

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
    <div data-testid="inspector-stats-bar" style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Total Calls</span>}
              value={total}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Success Rate</span>}
              value={successRate}
              suffix={<span style={{ fontSize: 12, color: 'var(--goat-success)' }}>% ({successCount})</span>}
              valueStyle={{ color: 'var(--goat-success)', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Errors</span>}
              value={errorCount}
              valueStyle={{ color: errorCount > 0 ? 'var(--goat-error)' : undefined, fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Avg Latency</span>}
              value={avgLatency}
              suffix={<span style={{ fontSize: 12, color: 'var(--goat-primary)' }}>ms</span>}
              valueStyle={{ color: 'var(--goat-primary)', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
