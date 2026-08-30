import React, { useState } from 'react';
import { ApiAction } from '../../data/api-matrix';
import { CodeSnippetTabs } from './CodeSnippetTabs';
import styles from './styles.module.css';

interface ActionModalProps {
  action: ApiAction;
  onClose: () => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({ action, onClose }) => {
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
        // fallback to default
        parsedPayload = action.defaultPayload || {};
      }

      // Simulate native bridge response
      await new Promise(r => setTimeout(r, 200));
      setSimulatorResult({
        id: `call_${Date.now()}`,
        action: action.action,
        status: 'SUCCESS',
        latencyMs: 1.8,
        payload: parsedPayload,
        response: action.returns.schema,
      });
      setSimulatorState('success');
    } catch (e: any) {
      setSimulatorResult({ error: e.message || 'Execution error' });
      setSimulatorState('error');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <span className={styles.domainBadge}>{action.domain}</span>
            <h2 className={styles.modalTitle}>{action.action}</h2>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.actionDesc}>{action.description}</p>
          <div className={styles.purposeBox}>
            <strong>🎯 Purpose:</strong> {action.purpose}
          </div>

          {/* Badges */}
          <div className={styles.badgeRow}>
            <div className={styles.badgeGroup}>
              <strong>Permission:</strong>
              <span className={action.permissions.scope === 'none' ? styles.badgeGreen : styles.badgeOrange}>
                {action.permissions.scope}
              </span>
            </div>
            {action.permissions.manifest.length > 0 && (
              <div className={styles.badgeGroup}>
                <strong>Manifest:</strong>
                {action.permissions.manifest.map(m => (
                  <span key={m} className={styles.badgeCode}>{m}</span>
                ))}
              </div>
            )}
            {action.permissions.requiresGesture && (
              <span className={styles.badgeWarning}>⚠️ Active User Gesture Required</span>
            )}
          </div>

          {/* Platform support */}
          <div className={styles.platformRow}>
            <strong>Platforms:</strong>
            <span className={action.platforms.android ? styles.platformOk : styles.platformNo}>Android</span>
            <span className={action.platforms.ios ? styles.platformOk : styles.platformNo}>iOS</span>
            <span className={action.platforms.reactNative ? styles.platformOk : styles.platformNo}>React Native</span>
            <span className={action.platforms.flutter ? styles.platformOk : styles.platformNo}>Flutter</span>
            <span className={action.platforms.web ? styles.platformOk : styles.platformNo}>Web Simulator</span>
          </div>

          {/* Parameters */}
          <h4 className={styles.sectionHeader}>Input Parameters</h4>
          {action.params.length === 0 ? (
            <p className={styles.mutedText}>No parameters required (empty payload <code>{'{}'}</code>).</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.paramTable}>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Default</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {action.params.map(p => (
                    <tr key={p.name}>
                      <td><code>{p.name}</code></td>
                      <td><code>{p.type}</code></td>
                      <td>{p.required ? <span className={styles.reqBadge}>Required</span> : 'Optional'}</td>
                      <td>{p.defaultValue ? <code>{p.defaultValue}</code> : '-'}</td>
                      <td>{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Return Value */}
          <h4 className={styles.sectionHeader}>Return Schema</h4>
          <p className={styles.mutedText}>
            <strong>Type:</strong> <code>{action.returns.type}</code> — {action.returns.description}
          </p>
          <pre className={styles.schemaBlock}>
            <code>{JSON.stringify(action.returns.schema, null, 2)}</code>
          </pre>

          {/* Error Codes */}
          {action.errors.length > 0 && (
            <>
              <h4 className={styles.sectionHeader}>Error Taxonomy</h4>
              <div className={styles.tableWrapper}>
                <table className={styles.paramTable}>
                  <thead>
                    <tr>
                      <th>Error Code</th>
                      <th>Meaning</th>
                      <th>Troubleshooting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {action.errors.map(err => (
                      <tr key={err.code}>
                        <td><code className={styles.errorCode}>{err.code}</code></td>
                        <td>{err.meaning}</td>
                        <td>{err.troubleshooting}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Code Snippets */}
          <h4 className={styles.sectionHeader}>Multi-Framework Implementation</h4>
          <CodeSnippetTabs snippets={action.snippets} />

          {/* Try in Simulator */}
          <h4 className={styles.sectionHeader}>Try in Simulator</h4>
          <div className={styles.simulatorBox}>
            <div className={styles.simInputGroup}>
              <label className={styles.simLabel}>Simulation Payload (JSON):</label>
              <textarea
                className={styles.simTextarea}
                rows={3}
                value={payloadInput}
                onChange={e => setPayloadInput(e.target.value)}
              />
            </div>
            <div className={styles.simBtnRow}>
              <button
                className={styles.simulateBtn}
                onClick={handleSimulate}
                disabled={simulatorState === 'executing'}
              >
                {simulatorState === 'executing' ? '⚡ Executing in Mock Bridge...' : '▶️ Execute Action in Simulator'}
              </button>
            </div>

            {simulatorResult && (
              <div className={styles.simResultBox}>
                <div className={styles.simResultHeader}>
                  <span>Telemetry Result:</span>
                  <span className={styles.simLatency}>⚡ 1.8ms (Mock IPC)</span>
                </div>
                <pre className={styles.simJsonBlock}>
                  <code>{JSON.stringify(simulatorResult, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <a
            href={`/docs/api/${action.domainSlug}#${action.action.toLowerCase().replace(/_/g, '-')}`}
            className={styles.fullDocLink}
          >
            📖 View Full Domain Article →
          </a>
          <button className={styles.closeBtnFooter} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
