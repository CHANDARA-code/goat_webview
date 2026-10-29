import React, { useSyncExternalStore } from 'react';
import { ConfigProvider, App } from 'antd';
import { getAntdTheme } from '../../theme/goatTheme';
import type { ThemeMode } from '../../theme/goatTheme';

export interface GoatAntdProviderProps {
  children: React.ReactNode;
}

function readColorMode(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function subscribeColorMode(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function useHtmlColorMode(): ThemeMode {
  return useSyncExternalStore(subscribeColorMode, readColorMode, () => 'light');
}

export const GoatAntdProvider: React.FC<GoatAntdProviderProps> = ({ children }) => {
  const colorMode = useHtmlColorMode();

  return (
    <ConfigProvider theme={getAntdTheme(colorMode)}>
      <App>{children}</App>
    </ConfigProvider>
  );
};

export default GoatAntdProvider;
