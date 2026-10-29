import React, { useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { CodeBlockCopy } from '../Common/CodeBlockCopy';
import styles from './ComponentShowcase.module.css';

export const BottomSheetPlayground: React.FC = () => {
  const { bottomSheet, setBottomSheet, callBridge, triggerHaptic } = useSimulator();
  const [selectedLang, setSelectedLang] = useState<'ts' | 'kotlin' | 'swift' | 'dart'>('ts');

  const handleOpen = async (snapIndex = 1) => {
    triggerHaptic('medium');
    await callBridge('BOTTOM_SHEET_OPEN', { height: 380, snapIndex }, 'UI Sheet');
  };

  const handleClose = async () => {
    triggerHaptic('light');
    await callBridge('BOTTOM_SHEET_CLOSE', {}, 'UI Sheet');
  };

  const handleSnapChange = async (index: number) => {
    triggerHaptic('selection');
    const snap = bottomSheet.snapPoints[index];
    await callBridge('SET_SHEET_SNAP_POINTS', { snapPoints: bottomSheet.snapPoints, initialSnap: snap }, 'UI Sheet');
    setBottomSheet((prev) => ({ ...prev, currentSnapIndex: index, isOpen: true }));
  };

  const codeSnippets = {
    ts: `const goat = window.goatBridge;

// 1. Open Draggable Native Bottom Sheet
await goat.ui.openBottomSheet({
  snapPoints: [0.25, 0.5, 0.9],
  initialSnap: ${bottomSheet.snapPoints[bottomSheet.currentSnapIndex]},
  isDismissible: ${bottomSheet.isDismissible},
  tabs: [
    { id: 'cart', title: 'Shopping Cart' },
    { id: 'delivery', title: 'Delivery Info' },
    { id: 'voucher', title: 'Coupons' }
  ]
});

// 2. Listen to Snap & Dismiss Events
goat.ui.onBottomSheetSnap((snapIndex) => {
  console.log('Sheet snapped to index:', snapIndex);
});

goat.ui.onBottomSheetDismiss(() => {
  console.log('User dismissed bottom sheet');
});`,
    kotlin: `// Android Host App: GoatBottomSheet Integration
val bottomSheet = GoatBottomSheet(context).apply {
    setSnapPoints(listOf(0.25f, 0.50f, 0.90f))
    setDismissible(${bottomSheet.isDismissible})
    show(fragmentManager, "goat_bottom_sheet")
}

bottomSheet.addOnSnapListener { snapRatio ->
    bridge.dispatchAction("ON_SHEET_SNAP", mapOf("ratio" to snapRatio))
}`,
    swift: `// iOS Host App: GoatBottomSheet with UISheetPresentationController
let sheetController = GoatBottomSheetController()
if let sheet = sheetController.sheetPresentationController {
    sheet.detents = [.medium(), .large(), .custom { _ in 200 }]
    sheet.prefersGrabberVisible = true
    sheet.prefersScrollingExpandsWhenScrolledToEdge = false
}
present(sheetController, animated: true)`,
    dart: `// Flutter: GoatBottomSheet PlatformView Channel
await GoatWebView.channel.invokeMethod('openBottomSheet', {
  'snapPoints': [0.25, 0.5, 0.9],
  'initialSnap': 0.5,
  'isDismissible': ${bottomSheet.isDismissible},
});`,
  };

  return (
    <div className={styles.playgroundCard} data-testid="bottom-sheet-playground">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            <span>GoatBottomSheet Component Playground</span>
          </div>
          <div className={styles.cardDesc}>
            Draggable native modal sheet hosting mini-app content or secondary sub-routes with fluid gesture snapping and multi-tab overlay stacking.
          </div>
        </div>
      </div>

      <div className={styles.formGrid}>
        {/* Sheet Controls */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Sheet Visibility</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={styles.actionButton}
              onClick={() => handleOpen(1)}
              style={{ flex: 1 }}
            >
              Open Sheet (50%)
            </button>
            <button
              className={styles.secondaryButton}
              onClick={handleClose}
              style={{ flex: 1 }}
              disabled={!bottomSheet.isOpen}
            >
              Close Sheet
            </button>
          </div>
        </div>

        {/* Snap Point Selector */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Snap Point Target</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`${styles.secondaryButton} ${bottomSheet.currentSnapIndex === 0 && bottomSheet.isOpen ? styles.actionButton : ''}`}
              onClick={() => handleSnapChange(0)}
              style={{ flex: 1 }}
            >
              25% Peek
            </button>
            <button
              className={`${styles.secondaryButton} ${bottomSheet.currentSnapIndex === 1 && bottomSheet.isOpen ? styles.actionButton : ''}`}
              onClick={() => handleSnapChange(1)}
              style={{ flex: 1 }}
            >
              50% Half
            </button>
            <button
              className={`${styles.secondaryButton} ${bottomSheet.currentSnapIndex === 2 && bottomSheet.isOpen ? styles.actionButton : ''}`}
              onClick={() => handleSnapChange(2)}
              style={{ flex: 1 }}
            >
              90% Full
            </button>
          </div>
        </div>

        {/* Dismissible Toggle */}
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Dismiss Configuration</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bottomSheet.isDismissible}
              onChange={(e) => setBottomSheet((prev) => ({ ...prev, isDismissible: e.target.checked }))}
            />
            <span>Allow swipe down & backdrop dismiss</span>
          </label>
        </div>
      </div>

      {/* Code Snippet Tabs */}
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
        <CodeBlockCopy code={codeSnippets[selectedLang]} language={selectedLang} title={`GoatBottomSheet (${selectedLang.toUpperCase()})`} />
      </div>
    </div>
  );
};
