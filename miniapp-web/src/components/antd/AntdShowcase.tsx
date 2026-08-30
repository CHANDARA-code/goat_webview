import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Divider,
  Flex,
  Input,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { bridge } from '../../miniapp-bridge';

const { Title, Paragraph, Text } = Typography;

export function AntdShowcase() {
  const { message } = AntdApp.useApp();
  const [rail, setRail] = useState<string>('Apple Pay');
  const [note, setNote] = useState<string>('');

  const handlePing = async () => {
    try {
      await bridge.triggerSelection();
    } catch {
      // haptics are best-effort
    }
    message.success(`Ready to charge via ${rail}`);
  };

  return (
    <div className="p-4 pb-24">
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            Ant Design UI Kit
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            This screen is the reference for how mini-app UI is built in this repo. Every new
            screen and component should use <Text code>antd</Text> primitives.
          </Paragraph>
        </div>

        <Flex gap="middle" wrap="wrap">
          <Card size="small" style={{ minWidth: 160 }}>
            <Statistic title="Bridge actions" value={197} prefix={<ThunderboltOutlined />} />
          </Card>
          <Card size="small" style={{ minWidth: 160 }}>
            <Statistic title="Domains" value={18} />
          </Card>
        </Flex>

        <Card title="Checkout rail" size="small">
          <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            <Segmented
              block
              value={rail}
              onChange={(value) => setRail(value as string)}
              options={['Apple Pay', 'Google Pay', 'Card']}
            />
            <Input
              placeholder="Order note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              allowClear
            />
            <Divider style={{ margin: '4px 0' }} />
            <Flex justify="space-between" align="center">
              <Tag color="processing">{note ? 'Note attached' : 'No note'}</Tag>
              <Button type="primary" icon={<RocketOutlined />} onClick={handlePing}>
                Pay with {rail}
              </Button>
            </Flex>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
