import React from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { GoatAntdProvider } from '../components/Common/GoatAntdProvider';
import { SearchDialog } from '../components/SearchDialog/SearchDialog';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider hashPriority="high">
      <GoatAntdProvider>
        {children}
        <SearchDialog />
      </GoatAntdProvider>
    </StyleProvider>
  );
}
