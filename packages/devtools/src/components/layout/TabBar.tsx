import React from 'react';
import { X, FileCode, FileJson, FileText, Layers, Plus } from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';

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
  if (filePath.endsWith('.html') || filePath.endsWith('.vue')) {
    return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
  }
  return <FileText className="w-3.5 h-3.5 text-gray-400" />;
}

export const TabBar: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    activeFilePath,
    setActiveTab,
    closeTab,
    createFile,
  } = useDevToolsStore();

  const handleCreateNewFile = () => {
    const fileName = prompt('Enter new file name (e.g. src/utils.ts):');
    if (fileName && fileName.trim()) {
      createFile(fileName.trim(), '');
    }
  };

  return (
    <div className="h-9 bg-[#252526] dark:bg-[#252526] light:bg-[#ececec] border-b border-[#3c3c3c] dark:border-[#3c3c3c] light:border-[#e5e5e5] flex items-center overflow-x-auto select-none">
      <div className="flex items-center h-full flex-1 overflow-x-auto no-scrollbar">
        {openTabs.map((tab: any) => {
          const isActive = tab.id === activeTabId || tab.filePath === activeFilePath;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group h-full flex items-center gap-2 px-3 border-r border-[#3c3c3c] dark:border-[#3c3c3c] light:border-[#e5e5e5] cursor-pointer text-xs transition-colors ${
                isActive
                  ? 'bg-[#1e1e1e] dark:bg-[#1e1e1e] light:bg-white text-white dark:text-white light:text-gray-900 border-t-2 border-t-blue-500 font-medium'
                  : 'bg-[#2d2d2d] dark:bg-[#2d2d2d] light:bg-[#ececec] text-gray-400 hover:text-gray-200 light:text-gray-600 light:hover:text-gray-900 hover:bg-[#282828]'
              }`}
            >
              {getTabIcon(tab.filePath)}
              <span className="truncate max-w-[140px]">{tab.title}</span>
              {tab.isDirty && (
                <span className="w-2 h-2 rounded-full bg-blue-400 group-hover:hidden" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`p-0.5 rounded hover:bg-white/20 text-gray-400 hover:text-white ${
                  tab.isDirty ? 'hidden group-hover:inline-block' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleCreateNewFile}
        className="p-1.5 mx-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="New File"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
