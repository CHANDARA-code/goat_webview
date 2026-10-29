import React, { useState, useEffect, useCallback } from 'react';
import { Segmented } from 'antd';
import {
  CodeOutlined,
  MobileOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CenterEditor } from './CenterEditor';
import { RightPreview } from './RightPreview';
import { BottomDock } from './BottomDock';
import { StatusBar } from './StatusBar';
import { PLAYGROUND_TEMPLATES } from '../CodePlayground/templates';
import { loadWorkspaceLayout, saveWorkspaceLayout } from '../../utils/workspaceStorage';
import { decodeProjectState } from '../../utils/projectState';
import styles from './Workspace.module.css';

export const Workspace: React.FC = () => {
  const {
    runPlayground,
    setPlaygroundCode,
    updateHardware,
    updateChaos,
    setActiveWidgetTab,
  } = useSimulator();

  // Layout states initialized from localStorage (all guarded by try/catch)
  const initialLayout = loadWorkspaceLayout();

  const [projectName, setProjectName] = useState('My Goat Mini-App');
  const [activeTemplateId, setActiveTemplateId] = useState('hello-bridge');

  const [railCollapsed, setRailCollapsed] = useState(initialLayout.railCollapsed);
  const [activeRailTab, setActiveRailTab] = useState(initialLayout.activeRailTab);

  const [dockCollapsed, setDockCollapsed] = useState(initialLayout.dockCollapsed);
  const [activeDockTab, setActiveDockTab] = useState(initialLayout.activeDockTab);
  const [dockHeight, setDockHeight] = useState(initialLayout.dockHeight);

  const [previewWidth, setPreviewWidth] = useState(420);
  const [platform, setPlatform] = useState(initialLayout.platform);
  const [device, setDevice] = useState(initialLayout.device);
  const [deviceColor, setDeviceColor] = useState(initialLayout.deviceColor);
  const [landscape, setLandscape] = useState(initialLayout.landscape);
  const [zoom, setZoom] = useState(initialLayout.zoom);

  const [autoRun, setAutoRun] = useState(initialLayout.autoRun);
  const [fontSize, setFontSize] = useState(initialLayout.fontSize);
  const [wordWrap, setWordWrap] = useState(initialLayout.wordWrap);

  // Mobile Tab view mode (< 996px)
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview' | 'dock'>('editor');

  // Hydrate from URL hash if shared project state exists
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash) {
      const decoded = decodeProjectState(hash);
      if (decoded) {
        if (decoded.name) setProjectName(decoded.name);
        if (decoded.code) setPlaygroundCode(decoded.code);
        if (decoded.template) setActiveTemplateId(decoded.template);
        if (decoded.platform) setPlatform(decoded.platform);
        if (decoded.device) setDevice(decoded.device);
        if (decoded.deviceColor) setDeviceColor(decoded.deviceColor);
        if (decoded.chaos) {
          updateChaos(decoded.chaos.enabled, decoded.chaos.rate);
        }
        if (decoded.hardware) {
          if (decoded.hardware.batteryLevel !== undefined) {
            updateHardware('battery', { level: decoded.hardware.batteryLevel, charging: false, isLow: false });
          }
          if (decoded.hardware.networkType) {
            updateHardware('network', { type: decoded.hardware.networkType as any, latencyMs: 35 });
          }
        }
        if (decoded.code) {
          setActiveWidgetTab('playground');
          runPlayground();
        }
      }
    }
  }, [setPlaygroundCode, updateChaos, updateHardware, setActiveWidgetTab, runPlayground]);

  // Persist layout state updates
  useEffect(() => {
    saveWorkspaceLayout({
      railCollapsed,
      activeRailTab,
      dockCollapsed,
      activeDockTab,
      dockHeight,
      platform,
      device,
      deviceColor,
      landscape,
      zoom,
      autoRun,
      fontSize,
      wordWrap,
    });
  }, [
    railCollapsed,
    activeRailTab,
    dockCollapsed,
    activeDockTab,
    dockHeight,
    platform,
    device,
    deviceColor,
    landscape,
    zoom,
    autoRun,
    fontSize,
    wordWrap,
  ]);

  // Global Keyboard Shortcuts
  // Cmd/Ctrl+Enter -> Run
  // Cmd/Ctrl+B -> Toggle Rail
  // Cmd/Ctrl+J -> Toggle Dock
  // DOES NOT INTERCEPT Cmd/Ctrl+K or '/'
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        runPlayground();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setRailCollapsed((prev) => !prev);
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      }
    },
    [runPlayground]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSelectTemplate = (templateId: string) => {
    setActiveTemplateId(templateId);
    const tmpl = PLAYGROUND_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setPlaygroundCode(tmpl.code);
      setActiveWidgetTab('playground');
      runPlayground();
    }
  };

  const handleReset = () => {
    const tmpl = PLAYGROUND_TEMPLATES.find((t) => t.id === activeTemplateId) || PLAYGROUND_TEMPLATES[0];
    setPlaygroundCode(tmpl.code);
    setActiveWidgetTab('playground');
    runPlayground();
  };

  return (
    <div className={styles.workspaceContainer}>
      {/* Top Action Bar */}
      <TopBar
        projectName={projectName}
        setProjectName={setProjectName}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={handleSelectTemplate}
        autoRun={autoRun}
        setAutoRun={setAutoRun}
        onReset={handleReset}
        platform={platform}
        setPlatform={setPlatform}
        device={device}
        deviceColor={deviceColor}
      />

      {/* Mobile (< 996px) Navigation Pills */}
      <div className={styles.mobileNavPills}>
        <Segmented
          value={mobileTab}
          onChange={(val) => setMobileTab(val as any)}
          options={[
            { value: 'editor', icon: <CodeOutlined />, label: 'Editor' },
            { value: 'preview', icon: <MobileOutlined />, label: 'Preview' },
            { value: 'dock', icon: <AppstoreOutlined />, label: 'Dock' },
          ]}
        />
      </div>

      {/* Main Resizable Body: Left Rail | Center Editor | Right Preview */}
      <div className={styles.mainWorkspaceBody}>
        {/* Left Rail (Desktop or via Drawer) */}
        <LeftRail
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed((prev) => !prev)}
          activeTab={activeRailTab}
          setActiveTab={setActiveRailTab}
          onSelectTemplate={handleSelectTemplate}
          fontSize={fontSize}
          setFontSize={setFontSize}
          wordWrap={wordWrap}
          setWordWrap={setWordWrap}
          autoRun={autoRun}
          setAutoRun={setAutoRun}
        />

        {/* Center Editor (Visible on Desktop, or when mobileTab === 'editor') */}
        <div style={{ display: 'flex', flex: 1, minWidth: 0, height: '100%' }}>
          <CenterEditor
            fontSize={fontSize}
            wordWrap={wordWrap}
            autoRun={autoRun}
          />
        </div>

        {/* Right Device Preview (Visible on Desktop, or when mobileTab === 'preview') */}
        <RightPreview
          platform={platform}
          setPlatform={setPlatform}
          device={device}
          setDevice={setDevice}
          deviceColor={deviceColor}
          setDeviceColor={setDeviceColor}
          landscape={landscape}
          setLandscape={setLandscape}
          zoom={zoom}
          setZoom={setZoom}
          width={previewWidth}
          onResizeWidth={setPreviewWidth}
        />
      </div>

      {/* Collapsible & Resizable Bottom Dock */}
      <BottomDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        activeTab={activeDockTab}
        setActiveTab={setActiveDockTab}
        height={dockHeight}
        onResizeHeight={setDockHeight}
      />

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
};

export default Workspace;
