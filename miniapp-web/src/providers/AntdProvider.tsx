import type { ReactNode } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';

const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

const BRAND_PRIMARY = '#0ea5e9';

interface AntdProviderProps {
  isDarkMode: boolean;
  children: ReactNode;
}

export function AntdProvider({ isDarkMode, children }: AntdProviderProps) {
  return (
    <ConfigProvider
      theme={{
        cssVar: true,
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: BRAND_PRIMARY,
          colorInfo: BRAND_PRIMARY,
          colorLink: BRAND_PRIMARY,
          borderRadius: 10,
          fontFamily: FONT_FAMILY,
        },
      }}
    >
      <AntdApp component={false}>{children}</AntdApp>
    </ConfigProvider>
  );
}
