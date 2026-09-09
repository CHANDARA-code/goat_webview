import React, { useState } from 'react';
import {
  Drawer,
  Tag,
  Table,
  Button,
  Input,
  Typography,
  Space,
  Alert,
  Card,
} from 'antd';
import {
  LockOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  AimOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { ApiAction } from '../../data/api-matrix';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeSnippetTabs } from './CodeSnippetTabs';
import styles from './styles.module.css';

const { Text, Title, Paragraph } = Typography;

interface ActionModalProps {
  action: ApiAction;
  onClose: () => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({ action, onClose }) => {
  const { callBridge } = useSimulator();
  const [simulatorState, setSimulatorState] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [simulatorResult, setSimulatorResult] = useState<any>(null);
  const [payloadInput, setPayloadInput] = useState<string>(
    JSON.stringify(action.defaultPayload || {}, null, 2)
  );

  const handleSimulate = async () => {
    setSimulatorState('executing');
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(payloadInput);
      } catch (err) {
        parsedPayload = action.defaultPayload || {};
      }

      const trace = await callBridge(action.action, parsedPayload, action.domain);
      setSimulatorResult({
        id: trace.id,
        action: trace.action,
        status: trace.status === 'success' ? 'SUCCESS' : 'ERROR',
        latencyMs: trace.latencyMs,
        payload: trace.payload,
        response: trace.response,
        errorMessage: trace.errorMessage,
      });
      setSimulatorState(trace.status === 'success' ? 'success' : 'error');
    } catch (e: any) {
      setSimulatorResult({ error: e.message || 'Execution error' });
      setSimulatorState('error');
    }
  };

  const paramColumns = [
    { title: 'Parameter', dataIndex: 'name', key: 'name', render: (text: string) => <code>{text}</code> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (text: string) => <code>{text}</code> },
    {
      title: 'Required',
      dataIndex: 'required',
      key: 'required',
      render: (req: boolean) => (req ? <Tag color="red">Required</Tag> : <Tag color="default">Optional</Tag>),
    },
    { title: 'Default', dataIndex: 'defaultValue', key: 'defaultValue', render: (text?: string) => (text ? <code>{text}</code> : '-') },
    { title: 'Description', dataIndex: 'description', key: 'description' },
  ];

  const errorColumns = [
    { title: 'Error Code', dataIndex: 'code', key: 'code', render: (text: string) => <Tag color="error">{text}</Tag> },
    { title: 'Meaning', dataIndex: 'meaning', key: 'meaning' },
    { title: 'Troubleshooting', dataIndex: 'troubleshooting', key: 'troubleshooting' },
  ];

  return (
    <Drawer
      title={
        <Space>
          <Tag color="processing">{action.domain}</Tag>
          <code>{action.action}</code>
        </Space>
      }
      placement="right"
      width={720}
      open={!!action}
      onClose={onClose}
      extra={
        <Button onClick={onClose} size="small">
          Close
        </Button>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Paragraph style={{ fontSize: 14 }}>{action.description}</Paragraph>
          <Alert
            type="info"
            showIcon
            icon={<AimOutlined />}
            message="Purpose"
            description={action.purpose}
          />
        </div>

        {/* Badges */}
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
            Permissions & Sandbox:
          </Text>
          <Space wrap>
            {action.permissions.scope === 'none' ? (
              <Tag color="success" icon={<ThunderboltOutlined />}>Zero-Permission Action</Tag>
            ) : (
              <Tag color="warning" icon={<LockOutlined />}>Requires Scope: {action.permissions.scope}</Tag>
            )}
            {action.permissions.manifest.map((m) => (
              <Tag key={m} color="gold">Manifest: {m}</Tag>
            ))}
            {action.permissions.requiresGesture && (
              <Tag color="volcano" icon={<ExclamationCircleOutlined />}>Active User Gesture Required</Tag>
            )}
          </Space>
        </div>

        {/* Platform Support */}
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
            Platform Parity:
          </Text>
          <Space wrap>
            <Tag color={action.platforms.android ? 'blue' : 'default'}>Android</Tag>
            <Tag color={action.platforms.ios ? 'geekblue' : 'default'}>iOS</Tag>
            <Tag color={action.platforms.reactNative ? 'cyan' : 'default'}>React Native</Tag>
            <Tag color={action.platforms.flutter ? 'purple' : 'default'}>Flutter</Tag>
            <Tag color={action.platforms.web ? 'green' : 'default'}>Web Simulator</Tag>
          </Space>
        </div>

        {/* Parameters */}
        <div>
          <Title level={5}>Input Parameters</Title>
          {action.params.length === 0 ? (
            <Text type="secondary">No parameters required (empty payload <code>{'{}'}</code>).</Text>
          ) : (
            <Table
              dataSource={action.params.map((p) => ({ ...p, key: p.name }))}
              columns={paramColumns}
              pagination={false}
              size="small"
            />
          )}
        </div>

        {/* Return Schema */}
        <div>
          <Title level={5}>Return Schema</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
            Type: <code>{action.returns.type}</code> — {action.returns.description}
          </Text>
          <pre className={styles.schemaBlock}>
            <code>{JSON.stringify(action.returns.schema, null, 2)}</code>
          </pre>
        </div>

        {/* Error Taxonomy */}
        {action.errors.length > 0 && (
          <div>
            <Title level={5}>Error Taxonomy</Title>
            <Table
              dataSource={action.errors.map((e) => ({ ...e, key: e.code }))}
              columns={errorColumns}
              pagination={false}
              size="small"
            />
          </div>
        )}

        {/* Implementation Snippets */}
        <div>
          <Title level={5}>Multi-Framework Implementation</Title>
          <CodeSnippetTabs snippets={action.snippets} />
        </div>

        {/* Try in Simulator */}
        <div>
          <Title level={5}>Try in Simulator</Title>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              Simulation Payload (JSON):
            </Text>
            <Input.TextArea
              rows={3}
              value={payloadInput}
              onChange={(e) => setPayloadInput(e.target.value)}
              style={{ fontFamily: 'monospace', marginBottom: 8 }}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={simulatorState === 'executing'}
              onClick={handleSimulate}
            >
              Execute Action in Simulator
            </Button>

            {simulatorResult && (
              <div style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: '#10b981', display: 'block', marginBottom: 4 }}>
                  Telemetry Result ({simulatorResult.latencyMs ?? '?'}ms Mock IPC):
                </Text>
                <pre className={styles.simJsonBlock}>
                  <code>{JSON.stringify(simulatorResult, null, 2)}</code>
                </pre>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Button
            type="link"
            icon={<BookOutlined />}
            href={`/docs/api/${action.domainSlug}#${action.action.toLowerCase().replace(/_/g, '-')}`}
          >
            View Full Domain Article
          </Button>
        </div>
      </Space>
    </Drawer>
  );
};
