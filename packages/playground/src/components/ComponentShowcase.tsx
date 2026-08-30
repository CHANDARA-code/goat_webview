import React, { useState } from 'react';

interface CallBridgeFn {
  (action: string, payload: Record<string, unknown>): Promise<{ response: Record<string, unknown> | null }>;
}

interface ShowcaseCardProps {
  title: string;
  icon: string;
  description: string;
  actions: Array<{ label: string; action: string; payload: Record<string, unknown> }>;
  callBridge: CallBridgeFn;
}

const styles: Record<string, React.CSSProperties> = {
  showcase: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    height: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  heading: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#374151',
    margin: '0 0 4px 0',
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '10px 12px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  cardIcon: {
    fontSize: '18px',
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#111827',
  },
  cardDesc: {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '8px',
  },
  btnRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  btn: {
    padding: '5px 10px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  result: {
    marginTop: '6px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    fontSize: '10px',
    color: '#15803d',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
  },
};

function ShowcaseCard({ title, icon, description, actions, callBridge }: ShowcaseCardProps) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string, payload: Record<string, unknown>) {
    setLoading(true);
    setResult(null);
    try {
      const trace = await callBridge(action, payload);
      setResult(JSON.stringify(trace.response));
    } catch (e) {
      setResult('error: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card} data-testid={`showcase-card-${title.replace(/\s+/g, '-')}`}>
      <div style={styles.cardHeader}>
        <span style={styles.cardIcon}>{icon}</span>
        <span style={styles.cardTitle}>{title}</span>
      </div>
      <p style={styles.cardDesc}>{description}</p>
      <div style={styles.btnRow}>
        {actions.map(({ label, action, payload }) => (
          <button
            key={label}
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
            onClick={() => handleAction(action, payload)}
            disabled={loading}
            data-testid={`showcase-btn-${action}`}
            aria-label={label}
          >
            {loading ? '…' : label}
          </button>
        ))}
      </div>
      {result !== null && (
        <div style={styles.result} data-testid={`showcase-result-${title.replace(/\s+/g, '-')}`}>
          {result}
        </div>
      )}
    </div>
  );
}

interface ComponentShowcaseProps {
  callBridge: CallBridgeFn;
}

const SHOWCASE_ITEMS: Array<Omit<ShowcaseCardProps, 'callBridge'>> = [
  {
    title: 'GoatNavigationBar',
    icon: '🔝',
    description: 'Set the native navigation bar title and background color.',
    actions: [
      { label: 'Set Title', action: 'NAV_BAR_SET_TITLE', payload: { title: 'My Mini App' } },
      { label: 'Set Color', action: 'NAV_BAR_SET_COLOR', payload: { color: '#6366f1' } },
    ],
  },
  {
    title: 'GoatBottomSheet',
    icon: '⬆️',
    description: 'Open and close a native bottom sheet overlay.',
    actions: [
      { label: 'Open', action: 'BOTTOM_SHEET_OPEN', payload: { height: 400 } },
      { label: 'Close', action: 'BOTTOM_SHEET_CLOSE', payload: {} },
    ],
  },
  {
    title: 'GoatHaptics',
    icon: '📳',
    description: 'Trigger haptic feedback with different intensity types.',
    actions: [
      { label: 'Light', action: 'HAPTIC_FEEDBACK', payload: { type: 'light' } },
      { label: 'Medium', action: 'HAPTIC_FEEDBACK', payload: { type: 'medium' } },
      { label: 'Heavy', action: 'HAPTIC_FEEDBACK', payload: { type: 'heavy' } },
    ],
  },
  {
    title: 'GoatBiometrics',
    icon: '🔐',
    description: 'Authenticate with device biometrics (mock state controlled in panel).',
    actions: [
      { label: 'Authenticate', action: 'BIOMETRIC_AUTH', payload: { reason: 'Confirm identity' } },
    ],
  },
  {
    title: 'GoatPermissionPriming',
    icon: '🔔',
    description: 'Request native device permissions with a priming dialog.',
    actions: [
      { label: 'Camera', action: 'REQUEST_PERMISSION', payload: { permission: 'camera' } },
      { label: 'Location', action: 'REQUEST_PERMISSION', payload: { permission: 'location' } },
    ],
  },
  {
    title: 'GoatStorage',
    icon: '💾',
    description: 'Read and write key-value data to native encrypted storage.',
    actions: [
      { label: 'Set', action: 'STORAGE_SET', payload: { key: 'user.pref', value: '{"theme":"dark"}' } },
      { label: 'Get', action: 'STORAGE_GET', payload: { key: 'user.pref' } },
    ],
  },
];

export function ComponentShowcase({ callBridge }: ComponentShowcaseProps) {
  return (
    <div style={styles.showcase} data-testid="component-showcase">
      <h3 style={styles.heading}>🧩 Component Showcase</h3>
      {SHOWCASE_ITEMS.map((item) => (
        <ShowcaseCard key={item.title} {...item} callBridge={callBridge} />
      ))}
    </div>
  );
}

export default ComponentShowcase;
