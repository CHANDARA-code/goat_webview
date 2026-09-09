import React, { useEffect, useState } from 'react';
import { Segmented, Button, Alert, App, Typography, Space } from 'antd';
import {
  CodeOutlined,
  PlayCircleOutlined,
  LinkOutlined,
  InboxOutlined,
  LockOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeEditor } from './CodeEditor';
import { PLAYGROUND_TEMPLATES } from './templates';
import styles from './CodePlaygroundPanel.module.css';

const { Text, Title } = Typography;

function encodeCodeForUrl(code: string): string {
  return btoa(encodeURIComponent(code).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
}

function decodeCodeFromUrl(encoded: string): string {
  return decodeURIComponent(
    atob(encoded)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'hello-bridge': <CodeOutlined />,
  'bottom-sheet-cart': <InboxOutlined />,
  'biometric-checkout': <LockOutlined />,
  'permission-haptics': <MobileOutlined />,
};

export const CodePlaygroundPanel: React.FC = () => {
  const { message } = App.useApp();
  const { playgroundCode, setPlaygroundCode, runPlayground } = useSimulator();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(PLAYGROUND_TEMPLATES[0]?.id ?? null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('code');
    if (!shared) return;
    try {
      setPlaygroundCode(decodeCodeFromUrl(shared));
      setActiveTemplateId(null);
    } catch {
      // Malformed link ignored
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    const template = PLAYGROUND_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setActiveTemplateId(templateId);
    setPlaygroundCode(template.code);
  };

  const handleCopyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('code', encodeCodeForUrl(playgroundCode));
    try {
      await navigator.clipboard.writeText(url.toString());
      message.success('Playground link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy playground link:', err);
      message.error('Failed to copy link');
    }
  };

  const segmentedOptions = PLAYGROUND_TEMPLATES.map((t) => ({
    label: (
      <span>
        {TEMPLATE_ICONS[t.id]} <span style={{ marginLeft: 4 }}>{t.label}</span>
      </span>
    ),
    value: t.id,
  }));

  return (
    <div className={styles.panel} data-testid="code-playground-panel">
      <div className={styles.header}>
        <Title level={4} style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeOutlined /> Live Code Playground
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Write <code>goatBridge.callNative(action, payload)</code> calls — the same convention used
          throughout the API docs — and watch them run against the live preview.
        </Text>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented
          block
          value={activeTemplateId ?? undefined}
          onChange={(val) => handleSelectTemplate(val as string)}
          options={segmentedOptions}
        />
      </div>

      <div className={styles.editorWrapper}>
        <CodeEditor
          value={playgroundCode}
          onChange={(value) => {
            setActiveTemplateId(null);
            setPlaygroundCode(value);
          }}
          height="320px"
        />
      </div>

      <div className={styles.actionsRow} style={{ marginTop: 12, marginBottom: 12 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={runPlayground}
            data-testid="playground-run-btn"
          >
            Run
          </Button>
          <Button icon={<LinkOutlined />} onClick={handleCopyLink}>
            Copy Link
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Sandboxed Execution"
        description="No network or storage access. Over 15 actions have real mock behavior; others respond with generic telemetry success."
        style={{ borderRadius: 6 }}
      />
    </div>
  );
};

export default CodePlaygroundPanel;
