import React, { useEffect } from 'react';
import { MultiPanelLayout } from './components/layout/MultiPanelLayout.tsx';
import { useDevToolsStore } from './store/useDevToolsStore.ts';

export const App: React.FC = () => {
  const { theme } = useDevToolsStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden select-none ${theme === 'dark' ? 'dark bg-[#1e1e1e] text-gray-200' : 'bg-white text-gray-800'}`}>
      <MultiPanelLayout />
    </div>
  );
};

export default App;
