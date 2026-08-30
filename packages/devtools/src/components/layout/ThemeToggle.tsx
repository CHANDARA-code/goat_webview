import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useDevToolsStore();

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors flex items-center justify-center"
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
    </button>
  );
};
