import React, { useEffect } from 'react';
import { Tabs } from 'antd';
import {
  VerticalAlignTopOutlined,
  InboxOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
  MobileOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useSimulator, ActiveWidgetTab } from '../../context/SimulatorContext';
import { NavigationBarPlayground } from './NavigationBarPlayground';
import { BottomSheetPlayground } from './BottomSheetPlayground';
import { PermissionPrimingPlayground } from './PermissionPrimingPlayground';
import { ExternalLinkWarningPlayground } from './ExternalLinkWarningPlayground';
import { HapticsPlayground } from './HapticsPlayground';
import { BiometricsPlayground } from './BiometricsPlayground';
import styles from './ComponentShowcase.module.css';

const SHOWCASE_TABS: Array<{ id: ActiveWidgetTab; label: string; icon: React.ReactNode }> = [
  { id: 'navbar', label: 'Navigation Bar', icon: <VerticalAlignTopOutlined /> },
  { id: 'bottomsheet', label: 'Bottom Sheet', icon: <InboxOutlined /> },
  { id: 'permission', label: 'Permission Priming', icon: <BellOutlined /> },
  { id: 'externallink', label: 'External Link', icon: <SafetyCertificateOutlined /> },
  { id: 'haptics', label: 'Haptics', icon: <MobileOutlined /> },
  { id: 'biometrics', label: 'Biometrics', icon: <LockOutlined /> },
];

export const ComponentShowcase: React.FC = () => {
  const { activeWidgetTab, setActiveWidgetTab, triggerHaptic } = useSimulator();

  useEffect(() => {
    if (!SHOWCASE_TABS.some((tab) => tab.id === activeWidgetTab)) {
      setActiveWidgetTab('navbar');
    }
  }, [activeWidgetTab, setActiveWidgetTab]);

  const handleTabChange = (key: string) => {
    triggerHaptic('selection');
    setActiveWidgetTab(key as ActiveWidgetTab);
  };

  const tabItems = SHOWCASE_TABS.map((tab) => ({
    key: tab.id,
    label: (
      <span data-testid={`showcase-tab-${tab.id}`}>
        {tab.icon} <span style={{ marginLeft: 6 }}>{tab.label}</span>
      </span>
    ),
    children: (
      <div
        role="tabpanel"
        id={`showcase-tabpanel-${tab.id}`}
        aria-labelledby={`showcase-tab-${tab.id}`}
        data-testid={`active-playground-${tab.id}`}
      >
        {tab.id === 'navbar' && <NavigationBarPlayground />}
        {tab.id === 'bottomsheet' && <BottomSheetPlayground />}
        {tab.id === 'permission' && <PermissionPrimingPlayground />}
        {tab.id === 'externallink' && <ExternalLinkWarningPlayground />}
        {tab.id === 'haptics' && <HapticsPlayground />}
        {tab.id === 'biometrics' && <BiometricsPlayground />}
      </div>
    ),
  }));

  return (
    <div className={styles.showcaseWrapper} data-testid="component-showcase-matrix">
      <Tabs
        activeKey={activeWidgetTab}
        onChange={handleTabChange}
        items={tabItems}
      />
    </div>
  );
};

export default ComponentShowcase;
