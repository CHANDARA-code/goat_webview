import React, { useState, Suspense } from 'react';
import { useMockBridge } from './hooks/useMockBridge.js';
import { DeviceFrame } from './components/DeviceFrame.js';
import { BridgeTracePanel } from './components/BridgeTracePanel.js';
import { MockControlPanel } from './components/MockControlPanel.js';
import { ComponentShowcase } from './components/ComponentShowcase.js';

// Lazy-load Monaco to keep initial bundle lean
const Editor = React.lazy(() => import('@monaco-editor/react'));

const DEFAULT_CODE = `// 🐐 Goat Playground — bridge.callNative demo
// Click "Run" to execute this in the simulated environment

const result = await bridge.callNative('GET_DEVICE_INFO', {});
console.log('Device info:', result);
`;

type RightTab = 'bridge' | 'controls';

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    height: '52px',
    backgroundColor: '#111827',
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '-0.3px',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
  },
  headerPill: {
    padding: '3px 10px',
    borderRadius: '9999px',
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    color: '#9ca3af',
    fontSize: '12px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPane: {
    width: '40%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  editorTitle: {
    color: '#9cdcfe',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  runBtn: {
    padding: '5px 14px',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  editorArea: {
    flex: 1,
    overflow: 'hidden',
  },
  editorOutput: {
    height: '80px',
    borderTop: '1px solid #3c3c3c',
    backgroundColor: '#0d1117',
    padding: '8px 12px',
    color: '#7ee787',
    fontSize: '11px',
    fontFamily: 'monospace',
    overflowY: 'auto',
    flexShrink: 0,
  },
  centerPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #e5e7eb',
    backgroundColor: '#f0f2f5',
  },
  centerContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    justifyContent: 'center',
  },
  rightPane: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '10px',
    textAlign: 'center' as const,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6b7280',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: '#6366f1',
    borderBottom: '2px solid #6366f1',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

export function App() {
  const { mockState, setMockState, bridgeTraces, callBridge, clearTraces } = useMockBridge();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string>('');
  const [rightTab, setRightTab] = useState<RightTab>('bridge');

  async function handleRun() {
    try {
      const bridge = {
        callNative: (action: string, payload: Record<string, unknown>) =>
          callBridge(action, payload).then((t) => t.response),
      };
      // eslint-disable-next-line no-new-func
      const fn = new Function('bridge', `return (async () => { ${code} })()`);
      const result = await fn(bridge);
      setOutput(result !== undefined ? JSON.stringify(result, null, 2) : '// executed');
    } catch (e) {
      setOutput('Error: ' + String(e));
    }
  }

  return (
    <div style={styles.app} data-testid="app-root">
      <header style={styles.header}>
        <h1 style={styles.headerTitle} data-testid="app-heading">🐐 Goat Playground</h1>
        <div style={styles.headerRight}>
          <span style={styles.headerPill}>{mockState.platform === 'ios' ? '🍎 iOS' : '🤖 Android'}</span>
          <span style={styles.headerPill}>{mockState.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
        </div>
      </header>

      <div style={styles.body}>
        {/* Left: Monaco Editor */}
        <div style={styles.leftPane} data-testid="editor-pane">
          <div style={styles.editorHeader}>
            <span style={styles.editorTitle}>📄 mini-app.js</span>
            <button style={styles.runBtn} onClick={handleRun} aria-label="Run code">
              ▶ Run
            </button>
          </div>
          <div style={styles.editorArea}>
            <Suspense fallback={<div style={{ padding: 12, color: '#9cdcfe', fontSize: 12 }}>Loading editor…</div>}>
              <Editor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </Suspense>
          </div>
          {output && (
            <div style={styles.editorOutput} data-testid="editor-output">
              <pre style={{ margin: 0 }}>{output}</pre>
            </div>
          )}
        </div>

        {/* Center: Device Frame + Component Showcase */}
        <div style={styles.centerPane}>
          <div style={styles.centerContent}>
            <DeviceFrame platform={mockState.platform}>
              <ComponentShowcase callBridge={callBridge} />
            </DeviceFrame>
          </div>
        </div>

        {/* Right: Tabs — Bridge Inspector + Mock Controls */}
        <div style={styles.rightPane}>
          <div style={styles.tabBar} role="tablist">
            <button
              style={rightTab === 'bridge' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
              onClick={() => setRightTab('bridge')}
              role="tab"
              aria-selected={rightTab === 'bridge'}
              data-testid="tab-bridge"
            >
              🔌 Bridge Inspector
            </button>
            <button
              style={rightTab === 'controls' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
              onClick={() => setRightTab('controls')}
              role="tab"
              aria-selected={rightTab === 'controls'}
              data-testid="tab-controls"
            >
              🎛️ Mock Controls
            </button>
          </div>
          <div style={styles.tabContent}>
            {rightTab === 'bridge' ? (
              <BridgeTracePanel traces={bridgeTraces} onClear={clearTraces} />
            ) : (
              <MockControlPanel mockState={mockState} setMockState={setMockState} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
