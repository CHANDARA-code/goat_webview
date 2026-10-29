import React, { useState } from 'react';
import {
  CodeOutlined,
  SendOutlined,
  DatabaseOutlined,
  WarningOutlined,
  ClearOutlined,
  UpOutlined,
  DownOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Input, Button, Badge, Tag, Table } from 'antd';
import { useSimulator } from '../../context/SimulatorContext';
import styles from './Workspace.module.css';

interface BottomDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: 'console' | 'inspector' | 'storage' | 'problems';
  setActiveTab: (tab: 'console' | 'inspector' | 'storage' | 'problems') => void;
  height: number;
  onResizeHeight: (newHeight: number) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  collapsed,
  onToggleCollapse,
  activeTab,
  setActiveTab,
  height,
  onResizeHeight,
}) => {
  const {
    consoleLogs,
    clearConsoleLogs,
    traces,
    clearTraces,
    getStorageSnapshot,
    clearStorageType,
  } = useSimulator();

  const [consoleFilterLevel, setConsoleFilterLevel] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const [consoleSearch, setConsoleSearch] = useState('');
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [storageSubTab, setStorageSubTab] = useState<'storage' | 'secure' | 'cookies' | 'fs'>('storage');
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);

  // Keyboard resizer
  const handleKeyDownResizer = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onResizeHeight(Math.min(500, height + 20));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onResizeHeight(Math.max(120, height - 20));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onResizeHeight(140);
    } else if (e.key === 'End') {
      e.preventDefault();
      onResizeHeight(450);
    }
  };

  // Pointer drag resizer
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = startY - moveEvt.clientY;
      const nextH = Math.max(120, Math.min(500, startH + delta));
      onResizeHeight(nextH);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Problems calculation
  const bridgeErrors = traces.filter((t) => t.status === 'error');
  const consoleErrors = consoleLogs.filter((l) => l.level === 'error');
  const problemCount = bridgeErrors.length + consoleErrors.length;
  const consoleErrorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const consoleWarnCount = consoleLogs.filter((l) => l.level === 'warn').length;

  // Filtered console logs
  const filteredConsoleLogs = consoleLogs.filter((log) => {
    if (consoleFilterLevel !== 'all' && log.level !== consoleFilterLevel) return false;
    if (consoleSearch) {
      const q = consoleSearch.toLowerCase();
      return log.messages.some((m) => m.toLowerCase().includes(q));
    }
    return true;
  });

  // Filtered traces
  const filteredTraces = traces.filter((t) => {
    if (!inspectorSearch) return true;
    const q = inspectorSearch.toLowerCase();
    return (
      t.action.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q) ||
      (t.errorMessage && t.errorMessage.toLowerCase().includes(q))
    );
  });

  const storageData = getStorageSnapshot();

  return (
    <div
      className={styles.bottomDock}
      style={{ height: collapsed ? 36 : height }}
    >
      {/* Resizer Splitter */}
      {!collapsed && (
        <div
          className={styles.splitterVertical}
          role="separator"
          tabIndex={0}
          aria-label="Resize bottom dock"
          aria-valuenow={height}
          aria-valuemin={120}
          aria-valuemax={500}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDownResizer}
        />
      )}

      {/* Dock Header Tab Bar */}
      <div className={styles.dockTabBar}>
        <div className={styles.dockTabs}>
          <button
            type="button"
            className={`${styles.dockTabButton} ${!collapsed && activeTab === 'console' ? styles.dockTabButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('console');
            }}
            aria-label="Console Tab"
          >
            <CodeOutlined />
            <span>Console</span>
            {consoleErrorCount > 0 && <span className={`${styles.badge} ${styles.badgeError}`}>{consoleErrorCount}</span>}
          </button>

          <button
            type="button"
            className={`${styles.dockTabButton} ${!collapsed && activeTab === 'inspector' ? styles.dockTabButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('inspector');
            }}
            aria-label="Bridge Inspector Tab"
          >
            <SendOutlined />
            <span>Bridge Inspector</span>
            <span className={styles.badge}>{traces.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.dockTabButton} ${!collapsed && activeTab === 'storage' ? styles.dockTabButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('storage');
            }}
            aria-label="Storage Inspector Tab"
          >
            <DatabaseOutlined />
            <span>Storage</span>
          </button>

          <button
            type="button"
            className={`${styles.dockTabButton} ${!collapsed && activeTab === 'problems' ? styles.dockTabButtonActive : ''}`}
            onClick={() => {
              if (collapsed) onToggleCollapse();
              setActiveTab('problems');
            }}
            aria-label="Problems Tab"
          >
            <WarningOutlined />
            <span>Problems</span>
            {problemCount > 0 && <span className={`${styles.badge} ${styles.badgeError}`}>{problemCount}</span>}
          </button>
        </div>

        {/* Right Dock Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={styles.iconActionButton}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand Dock (Cmd/Ctrl + J)' : 'Collapse Dock (Cmd/Ctrl + J)'}
            style={{ padding: '2px 8px', height: 24 }}
          >
            {collapsed ? <UpOutlined /> : <DownOutlined />}
            <span style={{ fontSize: 11 }}>{collapsed ? 'Dock' : 'Hide'}</span>
          </button>
        </div>
      </div>

      {/* Dock Content */}
      {!collapsed && (
        <div className={styles.dockContent}>
          {/* TAB 1: Console */}
          {activeTab === 'console' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(['all', 'log', 'warn', 'error'] as const).map((lvl) => (
                    <Button
                      key={lvl}
                      size="small"
                      type={consoleFilterLevel === lvl ? 'primary' : 'default'}
                      onClick={() => setConsoleFilterLevel(lvl)}
                      style={{ textTransform: 'capitalize', fontSize: 11, height: 24, padding: '0 8px' }}
                    >
                      {lvl === 'all' ? 'All' : `${lvl}s`}
                    </Button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Input
                    size="small"
                    placeholder="Filter console output…"
                    prefix={<SearchOutlined style={{ color: 'var(--goat-text-secondary)' }} />}
                    value={consoleSearch}
                    onChange={(e) => setConsoleSearch(e.target.value)}
                    style={{ width: 180, height: 24, fontSize: 11 }}
                    allowClear
                  />
                  <Button
                    size="small"
                    icon={<ClearOutlined />}
                    onClick={clearConsoleLogs}
                    style={{ height: 24, fontSize: 11 }}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: 12 }}>
                {filteredConsoleLogs.length === 0 ? (
                  <div style={{ color: 'var(--goat-text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                    No console output captured yet. Console logs from inside the preview iframe will appear here.
                  </div>
                ) : (
                  filteredConsoleLogs.map((log) => {
                    const isErr = log.level === 'error';
                    const isWarn = log.level === 'warn';
                    const color = isErr ? 'var(--goat-error)' : isWarn ? 'var(--goat-warning)' : 'var(--goat-text)';
                    const bg = isErr ? 'var(--goat-error-bg)' : isWarn ? 'var(--goat-warning-bg)' : 'transparent';
                    return (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--goat-border)',
                          background: bg,
                          color,
                          borderRadius: 4,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontSize: 10, color: 'var(--goat-text-tertiary)', flexShrink: 0 }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <Tag
                          color={isErr ? 'error' : isWarn ? 'warning' : 'default'}
                          style={{ margin: 0, fontSize: 9, padding: '0 4px', lineHeight: '16px' }}
                        >
                          {log.level.toUpperCase()}
                        </Tag>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', background: 'transparent' }}>
                          {log.messages.join(' ')}
                        </pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Bridge Inspector */}
          {activeTab === 'inspector' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Input
                  size="small"
                  placeholder="Filter bridge calls…"
                  prefix={<SearchOutlined style={{ color: 'var(--goat-text-secondary)' }} />}
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                  style={{ width: 220, height: 24, fontSize: 11 }}
                  allowClear
                />
                <Button size="small" icon={<ClearOutlined />} onClick={clearTraces} style={{ height: 24, fontSize: 11 }}>
                  Clear Traces
                </Button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--goat-border)', textAlign: 'left', color: 'var(--goat-text-secondary)' }}>
                      <th style={{ padding: '4px 8px' }}>Status</th>
                      <th style={{ padding: '4px 8px' }}>Action</th>
                      <th style={{ padding: '4px 8px' }}>Domain</th>
                      <th style={{ padding: '4px 8px' }}>Latency</th>
                      <th style={{ padding: '4px 8px' }}>Payload / Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTraces.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--goat-text-secondary)' }}>
                          No bridge traces recorded.
                        </td>
                      </tr>
                    ) : (
                      filteredTraces.map((trace) => {
                        const isErr = trace.status === 'error';
                        return (
                          <tr
                            key={trace.id}
                            style={{
                              borderBottom: '1px solid var(--goat-border)',
                              background: isErr ? 'var(--goat-error-bg)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '4px 8px' }}>
                              <Tag color={isErr ? 'error' : trace.status === 'pending' ? 'processing' : 'success'}>
                                {trace.status.toUpperCase()}
                              </Tag>
                            </td>
                            <td style={{ padding: '4px 8px', fontWeight: 600, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                              {trace.action}
                            </td>
                            <td style={{ padding: '4px 8px', color: 'var(--goat-text-secondary)' }}>{trace.domain}</td>
                            <td style={{ padding: '4px 8px' }}>{trace.latencyMs}ms</td>
                            <td style={{ padding: '4px 8px', fontFamily: 'var(--ifm-font-family-monospace)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isErr
                                ? trace.errorMessage
                                : JSON.stringify(trace.response || trace.payload)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Storage */}
          {activeTab === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    size="small"
                    type={storageSubTab === 'storage' ? 'primary' : 'default'}
                    onClick={() => setStorageSubTab('storage')}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Mini-App Storage ({Object.keys(storageData.storage).length})
                  </Button>
                  <Button
                    size="small"
                    type={storageSubTab === 'secure' ? 'primary' : 'default'}
                    onClick={() => setStorageSubTab('secure')}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Secure Enclave ({Object.keys(storageData.secureStorage).length})
                  </Button>
                  <Button
                    size="small"
                    type={storageSubTab === 'cookies' ? 'primary' : 'default'}
                    onClick={() => setStorageSubTab('cookies')}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Cookies ({storageData.cookies.length})
                  </Button>
                  <Button
                    size="small"
                    type={storageSubTab === 'fs' ? 'primary' : 'default'}
                    onClick={() => setStorageSubTab('fs')}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Sandboxed FS ({storageData.files.length})
                  </Button>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => setStorageRefreshKey((k) => k + 1)}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Refresh
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      clearStorageType(storageSubTab === 'secure' ? 'secureStorage' : storageSubTab);
                      setStorageRefreshKey((k) => k + 1);
                    }}
                    style={{ fontSize: 11, height: 24 }}
                  >
                    Clear Current
                  </Button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: 12, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                {storageSubTab === 'storage' && (
                  <div>
                    {Object.keys(storageData.storage).length === 0 ? (
                      <div style={{ color: 'var(--goat-text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                        No tenant key-value storage records found. Invoke STORAGE_SET to populate.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--goat-border)', textAlign: 'left', color: 'var(--goat-text-secondary)' }}>
                            <th style={{ padding: '4px 8px' }}>Key</th>
                            <th style={{ padding: '4px 8px' }}>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(storageData.storage).map(([k, v]) => (
                            <tr key={k} style={{ borderBottom: '1px solid var(--goat-border)' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--goat-primary)' }}>{k}</td>
                              <td style={{ padding: '4px 8px' }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {storageSubTab === 'secure' && (
                  <div>
                    {Object.keys(storageData.secureStorage).length === 0 ? (
                      <div style={{ color: 'var(--goat-text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                        No secure storage secrets found. Invoke SECURE_STORAGE_SET to write to Keystore.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--goat-border)', textAlign: 'left', color: 'var(--goat-text-secondary)' }}>
                            <th style={{ padding: '4px 8px' }}>Secret Key</th>
                            <th style={{ padding: '4px 8px' }}>Encrypted Enclave Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(storageData.secureStorage).map(([k, v]) => (
                            <tr key={k} style={{ borderBottom: '1px solid var(--goat-border)' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--goat-warning)' }}>{k}</td>
                              <td style={{ padding: '4px 8px' }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {storageSubTab === 'cookies' && (
                  <div>
                    {storageData.cookies.length === 0 ? (
                      <div style={{ color: 'var(--goat-text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                        No cookies stored for this tenant.
                      </div>
                    ) : (
                      <pre>{JSON.stringify(storageData.cookies, null, 2)}</pre>
                    )}
                  </div>
                )}

                {storageSubTab === 'fs' && (
                  <div>
                    {storageData.files.length === 0 ? (
                      <div style={{ color: 'var(--goat-text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                        No sandboxed files found. Invoke FS_WRITE_FILE to create files.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--goat-border)', textAlign: 'left', color: 'var(--goat-text-secondary)' }}>
                            <th style={{ padding: '4px 8px' }}>Path</th>
                            <th style={{ padding: '4px 8px' }}>Size</th>
                            <th style={{ padding: '4px 8px' }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storageData.files.map((f) => (
                            <tr key={f.path} style={{ borderBottom: '1px solid var(--goat-border)' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{f.path}</td>
                              <td style={{ padding: '4px 8px' }}>{f.size} B</td>
                              <td style={{ padding: '4px 8px' }}>{f.isDir ? 'Directory' : 'File'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Problems */}
          {activeTab === 'problems' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {problemCount === 0 ? (
                  <div style={{ color: 'var(--goat-success)', padding: '16px 0', textAlign: 'center', fontSize: 13, fontWeight: 500 }}>
                    No problems or rejected bridge actions detected.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Bridge Rejections */}
                    {bridgeErrors.map((err) => {
                      const code = err.response?.code || 'BRIDGE_ERROR';
                      const apiLink = `/goat_webview/api#action-${err.action}`;
                      return (
                        <div
                          key={err.id}
                          style={{
                            padding: '8px 10px',
                            background: 'var(--goat-error-bg)',
                            border: '1px solid var(--goat-error-border)',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <Tag color="error">{code}</Tag>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--ifm-font-family-monospace)', fontSize: 12 }}>
                                {err.action}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--goat-text-secondary)' }}>
                                ({err.domain})
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--goat-error)' }}>
                              {err.errorMessage || err.response?.message || 'Action execution failed'}
                            </div>
                          </div>

                          <a
                            href={apiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--goat-primary)',
                              textDecoration: 'underline',
                              flexShrink: 0,
                            }}
                          >
                            View /api Doc →
                          </a>
                        </div>
                      );
                    })}

                    {/* Console Errors */}
                    {consoleErrors.map((err) => (
                      <div
                        key={err.id}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--goat-error-bg)',
                          border: '1px solid var(--goat-error-border)',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <Tag color="error">JAVASCRIPT_RUNTIME_ERROR</Tag>
                          <span style={{ fontSize: 10, color: 'var(--goat-text-secondary)' }}>
                            {new Date(err.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre style={{ margin: 0, fontSize: 11, color: 'var(--goat-error)', whiteSpace: 'pre-wrap', background: 'transparent' }}>
                          {err.messages.join(' ')}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BottomDock;
