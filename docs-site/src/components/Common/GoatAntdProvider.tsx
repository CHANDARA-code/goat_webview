import React from 'react';
import { ConfigProvider, App, theme } from 'antd';
import { useColorMode } from '@docusaurus/theme-common';

export interface GoatAntdProviderProps {
  children: React.ReactNode;
}

function useSafeColorMode(): 'dark' | 'light' {
  try {
    const { colorMode } = useColorMode();
    return colorMode === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const GoatAntdProvider: React.FC<GoatAntdProviderProps> = ({ children }) => {
  const colorMode = useSafeColorMode();
  const isDark = colorMode === 'dark';

  const themeConfig = {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#6366f1',
      colorSuccess: '#10b981',
      colorError: '#ef4444',
      colorWarning: '#f59e0b',
      colorInfo: '#38bdf8',
      colorBgBase: isDark ? '#0f172a' : '#ffffff',
      colorBgContainer: isDark ? '#1e293b' : '#ffffff',
      colorBorder: isDark ? '#334155' : '#e2e8f0',
      colorText: isDark ? '#f8fafc' : '#0f172a',
      borderRadius: 8,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <App>{children}</App>
    </ConfigProvider>
  );
};

export default GoatAntdProvider;
