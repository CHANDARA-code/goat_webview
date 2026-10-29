import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

export const BiometricsPlayground: React.FC = () => {
  const { hardware, updateHardware, triggerBiometrics, callBridge, triggerHaptic } = useSimulator();
  const [authReason, setAuthReason] = useState('Authorize high-value transaction of $250.00');
  const [lastAuthResult, setLastAuthResult] = useState<Record<string, any> | null>(null);
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleCheckSupport = async () => {
    triggerHaptic('selection');
    const trace = await callBridge('CHECK_BIOMETRIC_SUPPORT', {}, 'Biometrics');
    setLastAuthResult(trace.response);
  };

  const handleAuthenticate = async () => {
    triggerHaptic('medium');
    const result = await triggerBiometrics(authReason);
    setLastAuthResult(result);
  };

  const codeSnippets = {
    ts: `const goat = window.goatBridge;

// 1. Check Hardware Biometric Availability
const support = await goat.biometrics.checkSupport();
console.log('Biometry Type:', support.biometryType); // 'face' | 'fingerprint'

// 2. Request Secure Biometric Authentication
try {
  const authResult = await goat.biometrics.authenticate({
    promptTitle: 'Confirm Payment',
    promptSubtitle: 'High-security transaction',
    reason: '${authReason}',
    fallbackToPasscode: true
  });
  console.log('Auth Token:', authResult.token);
} catch (error) {
  console.error('Biometric Auth Error:', error.code); // 'AUTH_LOCKOUT' | 'AUTH_FAILED'
}`,
    kotlin: `// Android Host App: BiometricPrompt with Keystore CryptoObject
val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle("Confirm Payment")
    .setSubtitle("${authReason}")
    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    .setNegativeButtonText("Use PIN")
    .build()

biometricPrompt.authenticate(promptInfo)`,
    swift: `// iOS Host App: LocalAuthentication (Face ID / Touch ID)
let context = LAContext()
var error: NSError?

if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "${authReason}") { success, evalError in
        DispatchQueue.main.async {
            bridge.postMessage(action: "BIOMETRIC_RESULT", payload: ["success": success])
        }
    }
}`,
    dart: `// Flutter: GoatBiometrics Channel
final result = await GoatWebView.channel.invokeMethod<Map<String, dynamic>>('biometricAuth', {
  'reason': '${authReason}',
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="biometrics-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>GoatBiometrics Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            Secure biometric authentication invoking iOS LocalAuthentication (`LAContext`) and Android `BiometricPrompt` with hardware cryptographic token validation.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Auth Reason Input */}
        <div className={styles.formField} style={{ gridColumn: 'span 2' }}>
          <label className={styles.fieldLabel}>Authentication Prompt Reason</label>
          <input
            type="text"
            className={styles.textInput}
            value={authReason}
            onChange={(e) => setAuthReason(e.target.value)}
            placeholder="Reason displayed in system modal"
          />
        </div>

        {/* Biometric Mock State Controls */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Simulated Verification Outcome</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`${styles.secondaryButton} ${hardware.biometrics.mockResult === 'success' ? styles.actionButton : ''}`}
              onClick={() => updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'success' })}
            >
              Pass (Success)
            </button>
            <button
              className={`${styles.secondaryButton} ${hardware.biometrics.mockResult === 'fail' ? styles.actionButton : ''}`}
              style={hardware.biometrics.mockResult === 'fail' ? { background: 'var(--goat-error)', borderColor: 'var(--goat-error)' } : {}}
              onClick={() => updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'fail' })}
            >
              Fail (Mismatch)
            </button>
            <button
              className={`${styles.secondaryButton} ${hardware.biometrics.mockResult === 'locked' ? styles.actionButton : ''}`}
              style={hardware.biometrics.mockResult === 'locked' ? { background: 'var(--goat-warning)', borderColor: 'var(--goat-warning)' } : {}}
              onClick={() => updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'locked' })}
            >
              Lockout (5 Fails)
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={styles.actionButton} onClick={handleAuthenticate}>
          <span>Trigger Biometric Scan Modal</span>
        </button>
        <button className={styles.secondaryButton} onClick={handleCheckSupport}>
          Check Hardware Support
        </button>
      </div>

      {/* Result Display */}
      {lastAuthResult && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'var(--goat-bg-elevated)', border: '1px solid var(--goat-border)', fontSize: '11px', fontFamily: 'monospace' }}>
          <div style={{ fontWeight: 700, color: 'var(--goat-primary)', marginBottom: '4px' }}>Latest Biometric Return Envelope:</div>
          <pre style={{ margin: 0, color: lastAuthResult.success ? 'var(--goat-success)' : 'var(--goat-error)', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(lastAuthResult, null, 2)}
          </pre>
        </div>
      )}

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
                background: selectedLang === lang ? 'var(--goat-primary)' : 'var(--goat-fill-tertiary)',
                color: selectedLang === lang ? 'var(--goat-text-on-primary)' : 'var(--goat-text-secondary)',
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
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatBiometrics (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
