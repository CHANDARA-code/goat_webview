import React from 'react';
import {
  FolderOpenOutlined,
  AppstoreOutlined,
  ControlOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Slider, Switch, Radio, Select, Tooltip, Button } from 'antd';
import { useSimulator, GPS_PRESETS } from '../../context/SimulatorContext';
import { PLAYGROUND_TEMPLATES } from '../CodePlayground/templates';
import type { PermissionType, PermissionStatus } from '../../types/simulator';
import styles from './Workspace.module.css';

interface LeftRailProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: 'files' | 'examples' | 'hardware' | 'settings';
  setActiveTab: (tab: 'files' | 'examples' | 'hardware' | 'settings') => void;
  onSelectTemplate: (templateId: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  wordWrap: boolean;
  setWordWrap: (wrap: boolean) => void;
  autoRun: boolean;
  setAutoRun: (autoRun: boolean) => void;
}

const EXAMPLE_DEMOS = [
  { id: 'navbar', title: 'Navigation Bar', desc: 'Title, subtitles, theme colors, left/right action buttons, progress bars' },
  { id: 'bottomsheet', title: 'Bottom Sheet', desc: 'Native sheet gestures, snap points, dismissible sheet with tabbed cart' },
  { id: 'permission', title: 'Permission Priming', desc: 'Two-stage educational priming modal -> OS prompt -> permanent denial flow' },
  { id: 'externallink', title: 'External Link Interceptor', desc: 'Zero-trust host checking, session allowlisting, external warning dialog' },
  { id: 'haptics', title: 'Tactile Haptics', desc: 'Light, medium, heavy, rigid, soft, and notification haptic vibration' },
  { id: 'biometrics', title: 'Biometric Enclave', desc: 'FaceID/TouchID prompt, biometric tokens, hostile lockout' },
];

export const LeftRail: React.FC<LeftRailProps> = ({
  collapsed,
  onToggleCollapse,
  activeTab,
  setActiveTab,
  onSelectTemplate,
  fontSize,
  setFontSize,
  wordWrap,
  setWordWrap,
  autoRun,
  setAutoRun,
}) => {
  const {
    hardware,
    updateHardware,
    permissionDialog,
    setPermissionDialog,
    chaosConfig,
    updateChaos,
    setActiveWidgetTab,
    activeWidgetTab,
    setPlaygroundCode,
    runPlayground,
  } = useSimulator();

  const handlePermChange = (perm: PermissionType, status: PermissionStatus) => {
    setPermissionDialog((prev) => ({
      ...prev,
      statusMap: { ...prev.statusMap, [perm]: status },
    }));
  };

  const handleNetworkPreset = (preset: 'wifi' | '5g' | '4g' | '3g' | 'offline') => {
    let latency = 25;
    if (preset === '5g') latency = 45;
    if (preset === '4g') latency = 90;
    if (preset === '3g') latency = 380;
    if (preset === 'offline') latency = 0;

    updateHardware('network', { type: preset, latencyMs: latency });
  };

  const handleBiometricPreset = (preset: 'success' | 'fail' | 'locked' | 'none') => {
    if (preset === 'none') {
      updateHardware('biometrics', {
        ...hardware.biometrics,
        biometryType: 'none',
        mockResult: 'fail',
      });
    } else {
      updateHardware('biometrics', {
        ...hardware.biometrics,
        biometryType: hardware.platform === 'ios' ? 'face' : 'biometric_prompt',
        mockResult: preset,
      });
    }
  };

  return (
    <aside className={styles.leftRail}>
      {/* Icon Column */}
      <div className={styles.railIconStrip}>
        <Tooltip title="Files & Templates" placement="right">
          <button
            type="button"
            className={`${styles.railIconButton} ${!collapsed && activeTab === 'files' ? styles.railIconButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('files');
            }}
            aria-label="Files & Templates"
          >
            <FolderOpenOutlined />
          </button>
        </Tooltip>

        <Tooltip title="Interactive Component Examples" placement="right">
          <button
            type="button"
            className={`${styles.railIconButton} ${!collapsed && activeTab === 'examples' ? styles.railIconButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('examples');
            }}
            aria-label="Interactive Component Examples"
          >
            <AppstoreOutlined />
          </button>
        </Tooltip>

        <Tooltip title="Hardware & Hostile Conditions" placement="right">
          <button
            type="button"
            className={`${styles.railIconButton} ${!collapsed && activeTab === 'hardware' ? styles.railIconButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('hardware');
            }}
            aria-label="Hardware & Hostile Conditions"
          >
            <ControlOutlined />
          </button>
        </Tooltip>

        <Tooltip title="Workspace Settings" placement="right">
          <button
            type="button"
            className={`${styles.railIconButton} ${!collapsed && activeTab === 'settings' ? styles.railIconButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('settings');
            }}
            aria-label="Workspace Settings"
          >
            <SettingOutlined />
          </button>
        </Tooltip>

        <div style={{ flex: 1 }} />

        <Tooltip title={collapsed ? 'Expand Rail (Cmd/Ctrl + B)' : 'Collapse Rail (Cmd/Ctrl + B)'} placement="right">
          <button
            type="button"
            className={styles.railIconButton}
            onClick={onToggleCollapse}
            aria-label="Toggle Left Rail"
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </Tooltip>
      </div>

      {/* Expanded Content Panel */}
      {!collapsed && (
        <div className={styles.railPanelContent}>
          {activeTab === 'files' && (
            <div>
              <div className={styles.railPanelTitle}>
                <span>Project Files</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--goat-bg-elevated)',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  <FileTextOutlined style={{ color: 'var(--goat-primary)' }} />
                  <span>index.html</span>
                  <span style={{ fontSize: 10, color: 'var(--goat-text-secondary)', marginLeft: 'auto' }}>Entry</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--goat-text-secondary)',
                  }}
                >
                  <FileTextOutlined />
                  <span>goat.config.json</span>
                </div>
              </div>

              <div className={styles.railPanelTitle} style={{ marginTop: 20 }}>
                <span>Starter Templates</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PLAYGROUND_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      onSelectTemplate(tmpl.id);
                      setPlaygroundCode(tmpl.code);
                      setActiveWidgetTab('playground');
                      runPlayground();
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'var(--goat-bg-input)',
                      border: '1px solid var(--goat-border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--goat-text)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--goat-text-heading)' }}>
                      {tmpl.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--goat-text-secondary)', marginTop: 2 }}>
                      {tmpl.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'examples' && (
            <div>
              <div className={styles.railPanelTitle}>
                <span>Component Demos</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--goat-text-secondary)', marginBottom: 12 }}>
                Explore native mobile containers rendered in the simulator:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXAMPLE_DEMOS.map((demo) => {
                  const isActive = activeWidgetTab === demo.id;
                  return (
                    <div
                      key={demo.id}
                      style={{
                        padding: '10px',
                        background: isActive ? 'var(--goat-bg-elevated)' : 'var(--goat-bg-input)',
                        border: `1px solid ${isActive ? 'var(--goat-primary)' : 'var(--goat-border)'}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--goat-text-heading)' }}>
                          {demo.title}
                        </span>
                        <Button
                          size="small"
                          type={isActive ? 'primary' : 'default'}
                          onClick={() => setActiveWidgetTab(demo.id as any)}
                        >
                          {isActive ? 'Active' : 'Open'}
                        </Button>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--goat-text-secondary)' }}>
                        {demo.desc}
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 8 }}>
                  <Button
                    block
                    onClick={() => setActiveWidgetTab('playground')}
                    type={activeWidgetTab === 'playground' ? 'primary' : 'dashed'}
                  >
                    Return to Mini-App Code
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div>
              <div className={styles.railPanelTitle}>
                <span>Hardware Mock State</span>
              </div>

              {/* Battery */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Battery Level</span>
                  <span>{hardware.battery.level}% {hardware.battery.charging ? '(Charging)' : ''}</span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  value={hardware.battery.level}
                  onChange={(val) => updateHardware('battery', { ...hardware.battery, level: val })}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 4 }}>
                  <span>Charging Cable</span>
                  <Switch
                    size="small"
                    checked={hardware.battery.charging}
                    onChange={(charging) => updateHardware('battery', { ...hardware.battery, charging })}
                  />
                </div>
              </div>

              {/* GPS Location */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>GPS Preset Location</div>
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={hardware.gps.name || 'San Francisco, CA'}
                  onChange={(val) => {
                    const preset = Object.values(GPS_PRESETS).find((p) => p.name === val) || GPS_PRESETS.sf;
                    updateHardware('gps', preset);
                  }}
                  options={Object.values(GPS_PRESETS).map((p) => ({ value: p.name, label: p.name }))}
                />
              </div>

              {/* Hostile Conditions Section */}
              <div className={styles.hostileSection}>
                <div className={styles.hostileTitle}>
                  <WifiOutlined style={{ marginRight: 6 }} />
                  Hostile Network Simulation
                </div>
                <Radio.Group
                  size="small"
                  value={hardware.network.type}
                  onChange={(e) => handleNetworkPreset(e.target.value)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}
                >
                  <Radio.Button value="wifi">WiFi (25ms)</Radio.Button>
                  <Radio.Button value="4g">4G (90ms)</Radio.Button>
                  <Radio.Button value="3g">Slow 3G (380ms)</Radio.Button>
                  <Radio.Button value="offline">Offline (0ms)</Radio.Button>
                </Radio.Group>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span>Injected Latency</span>
                  <span>{hardware.network.latencyMs}ms</span>
                </div>
                <Slider
                  min={0}
                  max={1500}
                  step={25}
                  value={hardware.network.latencyMs}
                  onChange={(val) => updateHardware('network', { ...hardware.network, latencyMs: val })}
                />
              </div>

              {/* Permissions Simulation */}
              <div className={styles.hostileSection}>
                <div className={styles.hostileTitle}>
                  <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                  OS Permissions Gate
                </div>
                {(['camera', 'location', 'contacts', 'bluetooth'] as PermissionType[]).map((perm) => {
                  const currentStatus = permissionDialog.statusMap[perm] || 'not_determined';
                  return (
                    <div key={perm} className={styles.hostileControlRow}>
                      <span style={{ textTransform: 'capitalize' }}>{perm}</span>
                      <Select
                        size="small"
                        style={{ width: 130 }}
                        value={currentStatus}
                        onChange={(val) => handlePermChange(perm, val)}
                        options={[
                          { value: 'granted', label: 'Granted' },
                          { value: 'denied', label: 'Denied' },
                          { value: 'permanently_denied', label: 'Perm Denied' },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Biometrics Hostile Presets */}
              <div className={styles.hostileSection}>
                <div className={styles.hostileTitle}>
                  <ThunderboltOutlined style={{ marginRight: 6 }} />
                  Biometrics Enclave Status
                </div>
                <Select
                  size="small"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={hardware.biometrics.mockResult}
                  onChange={(val) => handleBiometricPreset(val)}
                  options={[
                    { value: 'success', label: 'Success (Verified Match)' },
                    { value: 'fail', label: 'Mismatch / Rejected' },
                    { value: 'locked', label: 'Locked Out (>5 Failures)' },
                  ]}
                />
              </div>

              {/* Chaos Engineering Mode */}
              <div className={styles.hostileSection} style={{ background: 'var(--goat-bg-elevated)', padding: 10, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: 'var(--goat-error)' }}>
                    <BugOutlined />
                    <span>Chaos Mode</span>
                  </div>
                  <Switch
                    size="small"
                    checked={chaosConfig.enabled}
                    onChange={(enabled) => updateChaos(enabled, chaosConfig.failureRate)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span>Failure Rate</span>
                  <span>{chaosConfig.failureRate}%</span>
                </div>
                <Slider
                  min={5}
                  max={85}
                  step={5}
                  disabled={!chaosConfig.enabled}
                  value={chaosConfig.failureRate}
                  onChange={(rate) => updateChaos(chaosConfig.enabled, rate)}
                />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <div className={styles.railPanelTitle}>
                <span>Editor & Workspace Settings</span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Font Size</span>
                  <span>{fontSize}px</span>
                </div>
                <Slider
                  min={11}
                  max={18}
                  value={fontSize}
                  onChange={setFontSize}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontSize: 12 }}>
                <span>Word Wrap</span>
                <Switch size="small" checked={wordWrap} onChange={setWordWrap} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontSize: 12 }}>
                <span>Auto-run on Edit</span>
                <Switch size="small" checked={autoRun} onChange={setAutoRun} />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default LeftRail;
