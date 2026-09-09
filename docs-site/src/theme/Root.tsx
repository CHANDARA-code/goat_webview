import React from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { GoatAntdProvider } from '../components/Common/GoatAntdProvider';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider hashPriority="high">
      <GoatAntdProvider>
        {children}
      </GoatAntdProvider>
    </StyleProvider>
  );
}
