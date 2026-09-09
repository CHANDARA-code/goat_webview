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
              suffix={<span style={{ fontSize: 12, color: '#10b981' }}>% ({successCount})</span>}
              valueStyle={{ color: '#10b981', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Errors</span>}
              value={errorCount}
              valueStyle={{ color: errorCount > 0 ? '#ef4444' : undefined, fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<span style={{ fontSize: 11 }}>Avg Latency</span>}
              value={avgLatency}
              suffix={<span style={{ fontSize: 12, color: '#38bdf8' }}>ms</span>}
              valueStyle={{ color: '#38bdf8', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
