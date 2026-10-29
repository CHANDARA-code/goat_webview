import React, { useState } from 'react';
import {
  CaretRightOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  QrcodeOutlined,
  CodeOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Select, Switch, Modal, Tooltip, message, QRCode } from 'antd';
import { PLAYGROUND_TEMPLATES } from '../CodePlayground/templates';
import { useSimulator } from '../../context/SimulatorContext';
import { encodeProjectState } from '../../utils/projectState';
import { downloadMiniAppZip } from '../../utils/zipExport';
import styles from './Workspace.module.css';

interface TopBarProps {
  projectName: string;
  setProjectName: (name: string) => void;
  activeTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  autoRun: boolean;
  setAutoRun: (enabled: boolean) => void;
  onReset: () => void;
  platform: 'ios' | 'android' | 'web';
  setPlatform: (p: 'ios' | 'android' | 'web') => void;
  device: string;
  deviceColor: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  setProjectName,
  activeTemplateId,
  onSelectTemplate,
  autoRun,
  setAutoRun,
  onReset,
  platform,
  setPlatform,
  device,
  deviceColor,
}) => {
  const { playgroundCode, runPlayground, hardware, chaosConfig } = useSimulator();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const shareState = {
      name: projectName,
      code: playgroundCode,
      template: activeTemplateId,
      platform,
      device,
      deviceColor,
      hardware: {
        batteryLevel: hardware.battery.level,
        networkType: hardware.network.type,
        theme: hardware.theme,
        mockResult: hardware.biometrics.mockResult,
      },
      chaos: {
        enabled: chaosConfig.enabled,
        rate: chaosConfig.failureRate,
      },
    };
    const hash = encodeProjectState(shareState);
    const baseUrl = window.location.href.split('#')[0];
    return `${baseUrl}#project=${hash}`;
  };

  const handleShare = () => {
    const url = getShareUrl();
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(null, '', url);
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        message.success('Project session link copied to clipboard!');
      });
    }
  };

  const handleDownload = () => {
    downloadMiniAppZip(projectName, playgroundCode);
    message.success('Mini-App archive downloaded!');
  };

  const handleCopyCli = () => {
    const cmd = 'npx @goat/cli dev';
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd).then(() => {
        setCopiedCli(true);
        message.success('Copied CLI command: npx @goat/cli dev');
        setTimeout(() => setCopiedCli(false), 2000);
      });
    }
  };

  return (
    <header className={styles.topBar}>
      {/* Left: Project title & Template */}
      <div className={styles.topBarLeft}>
        <input
          type="text"
          className={styles.projectNameInput}
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          aria-label="Editable Project Name"
          title="Click to edit project name"
        />

        <Select
          value={activeTemplateId}
          onChange={onSelectTemplate}
          size="small"
          style={{ width: 175 }}
          aria-label="Select Template"
          options={PLAYGROUND_TEMPLATES.map((t) => ({
            value: t.id,
            label: t.label,
          }))}
        />
      </div>

      {/* Center: Run & Auto-run */}
      <div className={styles.topBarCenter}>
        <Tooltip title="Run Mini-App (Cmd/Ctrl + Enter)">
          <button
            type="button"
            className={styles.primaryRunButton}
            onClick={runPlayground}
            aria-label="Run Mini-App (Cmd/Ctrl + Enter)"
          >
            <CaretRightOutlined />
            <span>Run</span>
          </button>
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--goat-text-secondary)' }}>Auto-run</span>
          <Switch
            size="small"
            checked={autoRun}
            onChange={setAutoRun}
            aria-label="Toggle Auto-Run"
          />
        </div>

        <Tooltip title="Reset to template default">
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={onReset}
            aria-label="Reset Code"
          >
            <ReloadOutlined />
          </button>
        </Tooltip>
      </div>

      {/* Right: Actions (Share, Download, CLI, QR, Platform) */}
      <div className={styles.topBarRight}>
        <Tooltip title="Share workspace session (URL hash)">
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={handleShare}
            aria-label="Share workspace link"
          >
            <ShareAltOutlined />
            <span>Share</span>
          </button>
        </Tooltip>

        <Tooltip title="Export runnable project zip">
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={handleDownload}
            aria-label="Download project zip"
          >
            <DownloadOutlined />
            <span>Download</span>
          </button>
        </Tooltip>

        <Tooltip title="Copy local CLI command (goat dev)">
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={handleCopyCli}
            aria-label="Copy CLI command"
          >
            {copiedCli ? <CheckOutlined style={{ color: 'var(--goat-success)' }} /> : <CodeOutlined />}
            <span>CLI</span>
          </button>
        </Tooltip>

        <Tooltip title="Open on Mobile Browser (QR)">
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={() => setIsQrModalOpen(true)}
            aria-label="Open on Phone via QR"
          >
            <QrcodeOutlined />
            <span>Phone</span>
          </button>
        </Tooltip>

        <Select
          value={platform}
          onChange={setPlatform}
          size="small"
          style={{ width: 100 }}
          aria-label="Platform Selector"
          options={[
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
            { value: 'web', label: 'Web' },
          ]}
        />
      </div>

      {/* QR Code Modal */}
      <Modal
        title="Open Playground on Mobile Browser"
        open={isQrModalOpen}
        onCancel={() => setIsQrModalOpen(false)}
        footer={null}
        width={360}
        centered
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <QRCode value={getShareUrl()} size={200} />
          </div>
          <div
            style={{
              background: 'var(--goat-bg-elevated)',
              padding: '12px',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--goat-text)',
              lineHeight: 1.5,
              textAlign: 'left',
              border: '1px solid var(--goat-border)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4, color: 'var(--goat-primary)' }}>
              Browser Simulation Only
            </strong>
            Scanning this QR code opens this exact mini-app development session directly in your mobile browser with the hermetic Goat mock bridge. No native app installation or device pairing required.
          </div>
        </div>
      </Modal>
    </header>
  );
};

export default TopBar;
