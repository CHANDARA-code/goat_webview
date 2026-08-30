import React from 'react';
import { X, FileCode, FileJson, FileText, Layers, MoreHorizontal } from 'lucide-react';
import { useDevToolsStore } from '../../store/useDevToolsStore.js';
import { EditorTab } from '../../types/index.js';

export function getTabIcon(filePath: string) {
  if (filePath.endsWith('.json')) {
    return <FileJson className="w-3.5 h-3.5 text-yellow-400" />;
  }
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return <FileCode className="w-3.5 h-3.5 text-amber-300" />;
  }
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
  }
  if (filePath.endsWith('.css')) {
    return <FileText className="w-3.5 h-3.5 text-sky-400" />;
  }
  if (filePath.endsWith('.html') || filePath.endsWith('.gxml') || filePath.endsWith('.wxml')) {
    return <Layers className="w-3.5 h-3.5 text-orange-400" />;
  }
  return <FileText className="w-3.5 h-3.5 text-gray-400" />;
}

export const TabBar: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
  } = useDevToolsStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 bg-ide-panel-dark dark:bg-ide-panel-dark bg-ide-panel-light border-b border-ide-border-dark dark:border-ide-border-dark border-ide-border-light flex items-center justify-between overflow-x-auto select-none no-scrollbar">
      {/* Scrollable Tabs */}
      <div className="flex items-center h-full overflow-x-auto">
        {openTabs.map((tab: any) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center space-x-2 px-3 h-full border-r border-ide-border-dark dark:border-ide-border-dark border-ide-border-light cursor-pointer text-xs font-mono transition-colors relative ${
                isActive
                  ? 'bg-ide-bg-dark dark:bg-ide-bg-dark bg-white text-blue-400 font-medium'
                  : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
              }`}
            >
              {/* Active top accent bar */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />
              )}

              {/* File Icon */}
              {getTabIcon(tab.filePath)}

              {/* Title */}
              <span className="truncate max-w-[140px]">{tab.title}</span>

              {/* Dirty indicator / Close button */}
              <div className="flex items-center">
                {tab.isDirty ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="w-2 h-2 rounded-full bg-blue-400 group-hover:hidden"
                  />
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`p-0.5 rounded hover:bg-gray-700/80 hover:text-red-400 transition-colors ${
                    tab.isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Context Action Menu */}
      <div className="flex items-center px-2 space-x-1">
        <button
          onClick={() => activeTabId && closeOtherTabs(activeTabId)}
          className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
          title="Close Other Tabs"
        >
          Close Others
        </button>
        <button
          onClick={closeAllTabs}
          className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-red-400 hover:bg-gray-700/50"
          title="Close All Tabs"
        >
          Close All
        </button>
      </div>
    </div>
  );
};
