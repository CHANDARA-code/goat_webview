import React from 'react';
import { useSimulator, ActiveWidgetTab } from '../../context/SimulatorContext';
import { NavigationBarPlayground } from './NavigationBarPlayground';
import { BottomSheetPlayground } from './BottomSheetPlayground';
import { PermissionPrimingPlayground } from './PermissionPrimingPlayground';
import { ExternalLinkWarningPlayground } from './ExternalLinkWarningPlayground';
import { HapticsPlayground } from './HapticsPlayground';
import { BiometricsPlayground } from './BiometricsPlayground';
import styles from './ComponentShowcase.module.css';

const SHOWCASE_TABS: Array<{ id: ActiveWidgetTab; label: string; icon: string }> = [
  { id: 'navbar', label: 'GoatNavigationBar', icon: '🔝' },
  { id: 'bottomsheet', label: 'GoatBottomSheet', icon: '📦' },
  { id: 'permission', label: 'GoatPermissionPriming', icon: '🔔' },
  { id: 'externallink', label: 'GoatExternalLinkWarning', icon: '🛡️' },
  { id: 'haptics', label: 'GoatHaptics', icon: '📳' },
  { id: 'biometrics', label: 'GoatBiometrics', icon: '🔐' },
];

export const ComponentShowcase: React.FC = () => {
  const { activeWidgetTab, setActiveWidgetTab, triggerHaptic } = useSimulator();

  const handleTabSelect = (tabId: ActiveWidgetTab) => {
    triggerHaptic('selection');
    setActiveWidgetTab(tabId);
  };

  return (
    <div className={styles.showcaseWrapper} data-testid="component-showcase-matrix">
      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        {SHOWCASE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabItem} ${activeWidgetTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => handleTabSelect(tab.id)}
            data-testid={`showcase-tab-${tab.id}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Component Playground */}
      <div data-testid={`active-playground-${activeWidgetTab}`}>
        {activeWidgetTab === 'navbar' && <NavigationBarPlayground />}
        {activeWidgetTab === 'bottomsheet' && <BottomSheetPlayground />}
        {activeWidgetTab === 'permission' && <PermissionPrimingPlayground />}
        {activeWidgetTab === 'externallink' && <ExternalLinkWarningPlayground />}
        {activeWidgetTab === 'haptics' && <HapticsPlayground />}
        {activeWidgetTab === 'biometrics' && <BiometricsPlayground />}
      </div>
    </div>
  );
};

export default ComponentShowcase;
