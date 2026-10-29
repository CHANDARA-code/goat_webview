import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import type { PermissionType } from '../../types/simulator';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

export const PermissionPrimingPlayground: React.FC = () => {
  const { permissionDialog, requestPermissionFlow, setPermissionDialog, callBridge, triggerHaptic } = useSimulator();
  const [selectedPerm, setSelectedPerm] = useState<PermissionType>('camera');
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleRequest = (perm: PermissionType) => {
    triggerHaptic('medium');
    requestPermissionFlow(perm);
  };

  const handleResetPermissions = () => {
    triggerHaptic('selection');
    setPermissionDialog({
      activePermission: null,
      stage: 'idle',
      statusMap: {
        camera: 'not_determined',
        location: 'not_determined',
        notifications: 'not_determined',
        contacts: 'not_determined',
        bluetooth: 'not_determined',
      },
    });
    callBridge('RESET_PERMISSIONS', {}, 'Permissions');
  };

  const codeSnippets = {
    ts: `const goat = window.goatBridge;

// 1. Request Permission with Pre-flight Rationale Priming
const result = await goat.permissions.requestWithPriming({
  permission: '${selectedPerm}',
  rationale: {
    title: 'Camera Access Required',
    description: 'We need camera access to scan QR codes for fast merchant payments.',
    confirmText: 'Enable Access',
    cancelText: 'Not Now'
  }
});

if (result.granted) {
  console.log('Permission granted by user!');
} else if (result.permanentlyDenied) {
  // Direct user to OS settings
  await goat.permissions.openAppSettings();
}`,
    kotlin: `// Android Host App: GoatPermissionPrimingDialog
val dialog = GoatPermissionPrimingDialog.newInstance(
    permission = Manifest.permission.CAMERA,
    rationaleTitle = "Camera Access Required",
    rationaleDesc = "Allow scanning payment QR codes"
)
dialog.show(supportFragmentManager, "permission_priming")`,
    swift: `// iOS Host App: GoatPermissionPrimingDialog
GoatPermissionPrimingDialog.request(
    for: .camera,
    rationale: "Camera access is needed to scan QR tickets."
) { granted, permanentlyDenied in
    if permanentlyDenied {
        UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
    }
}`,
    dart: `// Flutter: GoatPermissionPriming Channel
final granted = await GoatWebView.channel.invokeMethod<bool>('requestPermissionWithPriming', {
  'permission': '${selectedPerm}',
  'rationale': 'Allow location access to find nearby store branches.',
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="permission-priming-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>GoatPermissionPrimingDialog Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            2-stage rationale dialog preventing silent permanent OS denials. Explains business value before triggering the irreversible raw OS prompt.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Permission Selectors */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Select Permission Domain</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['camera', 'location', 'notifications', 'contacts', 'bluetooth'] as PermissionType[]).map((perm) => (
              <button
                key={perm}
                className={`${styles.secondaryButton} ${selectedPerm === perm ? styles.actionButton : ''}`}
                onClick={() => {
                  setSelectedPerm(perm);
                  handleRequest(perm);
                }}
                style={{ textTransform: 'capitalize' }}
              >
                {perm === 'camera' ? 'Camera' : perm === 'location' ? 'Location' : perm === 'notifications' ? 'Notifications' : perm === 'contacts' ? 'Contacts' : 'Bluetooth'}
              </button>
            ))}
          </div>
        </div>

        {/* Current Permissions Status Table */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Current Granted Status</label>
          <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(permissionDialog.statusMap).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                <span style={{ textTransform: 'capitalize' }}>{key}</span>
                <span style={{ fontWeight: 700, color: val === 'granted' ? 'var(--goat-success)' : val === 'denied' ? 'var(--goat-error)' : 'var(--goat-text-secondary)' }}>
                  {val.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={styles.actionButton} onClick={() => handleRequest(selectedPerm)}>
          <span>Launch 2-Stage Permission Flow</span>
        </button>
        <button className={styles.secondaryButton} onClick={handleResetPermissions}>
          Reset Permission State
        </button>
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
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatPermissionPrimingDialog (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
