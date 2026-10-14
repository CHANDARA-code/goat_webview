import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import type { HapticEvent } from '../../types/simulator';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

export const HapticsPlayground: React.FC = () => {
  const { triggerHaptic, lastHaptic } = useSimulator();
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleTrigger = (type: HapticEvent['type']) => {
    triggerHaptic(type);
  };

  const codeSnippets = {
    ts: `const goat = window.goatBridge;

// 1. Impact Feedback Triggers
await goat.haptics.impact({ style: 'light' });  // 10ms light pulse
await goat.haptics.impact({ style: 'medium' }); // 25ms medium pulse
await goat.haptics.impact({ style: 'heavy' });  // 50ms heavy pulse

// 2. Notification Feedback Patterns
await goat.haptics.notification({ type: 'success' }); // double high pulse
await goat.haptics.notification({ type: 'warning' }); // alert pulse
await goat.haptics.notification({ type: 'error' });   // triple alert pulse

// 3. Selection Tick
await goat.haptics.selection(); // micro tick for scroll pickers`,
    kotlin: `// Android Host App: GoatHaptics (Vibrator / VibrationEffect)
val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
}`,
    swift: `// iOS Host App: GoatHaptics
let impact = UIImpactFeedbackGenerator(style: .medium)
impact.prepare()
impact.impactOccurred()

let notification = UINotificationFeedbackGenerator()
notification.notificationOccurred(.success)`,
    dart: `// Flutter: GoatHaptics Channel
await GoatWebView.channel.invokeMethod('hapticFeedback', {
  'type': 'medium',
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="haptics-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>GoatHaptics Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            High-precision tactile feedback generator invoking iOS Taptic Engine and Android Haptic Feedback APIs with subtle physical response simulation.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Impact Styles */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Physical Impact Feedback</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className={styles.actionButton} onClick={() => handleTrigger('light')}>
              Light (10ms)
            </button>
            <button className={styles.actionButton} onClick={() => handleTrigger('medium')}>
              Medium (25ms)
            </button>
            <button className={styles.actionButton} onClick={() => handleTrigger('heavy')}>
              Heavy (50ms)
            </button>
            <button className={styles.secondaryButton} onClick={() => handleTrigger('rigid')}>
              Rigid (15ms Sharp)
            </button>
            <button className={styles.secondaryButton} onClick={() => handleTrigger('soft')}>
              Soft (35ms Dampened)
            </button>
          </div>
        </div>

        {/* Notification Haptics */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Notification Haptic Sequences</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={styles.actionButton}
              style={{ background: '#059669' }}
              onClick={() => handleTrigger('success')}
            >
              Success Pattern
            </button>
            <button
              className={styles.actionButton}
              style={{ background: '#d97706' }}
              onClick={() => handleTrigger('warning')}
            >
              Warning Pattern
            </button>
            <button
              className={styles.actionButton}
              style={{ background: '#dc2626' }}
              onClick={() => handleTrigger('error')}
            >
              Error Pattern
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => handleTrigger('selection')}
            >
              Selection Tick (5ms)
            </button>
          </div>
        </div>

        {/* Last Triggered Status */}
        {lastHaptic && (
          <div style={{ gridColumn: 'span 2', padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '11px' }}>
            <span>Last Haptic Event: </span>
            <strong style={{ color: '#818cf8', textTransform: 'uppercase' }}>{lastHaptic.type}</strong>
            <span style={{ color: '#94a3b8', marginLeft: '8px' }}>
              ({new Date(lastHaptic.timestamp).toLocaleTimeString()})
            </span>
          </div>
        )}
      </div>

      {/* Code Snippets */}
      <div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {(['ts', 'kotlin', 'swift', 'dart'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: selectedLang === lang ? '#6366f1' : '#1e293b',
                color: selectedLang === lang ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {lang}
            </button>
          ))}
        </div>
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatHaptics (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
