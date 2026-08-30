/**
 * @goat/devtools - Sidebar Activity Bar & Panel Component
 */

import React from 'react';
import {
  FolderTree,
  Layers,
  Sliders,
  Terminal,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';
import { FileTreeBrowser } from '../editor/FileTreeBrowser.tsx';
import { SensorSuitePanel } from '../sensors/SensorSuitePanel.tsx';
import { SubpackageVisualizer } from '../packaging/SubpackageVisualizer.tsx';
import { StorageExplorer } from '../debugger/StorageExplorer.tsx';

export const Sidebar: React.FC = () => {
  const {
    activeSidebarView,
    setActiveSidebarView,
    collapsedPanels,
    togglePanelCollapse,
    setTemplateModalOpen,
  } = useDevToolsStore();

  const isCollapsed = collapsedPanels.sidebar;

  const activityItems = [
    { id: 'explorer', label: 'File Explorer', icon: FolderTree },
    { id: 'sensors', label: 'Sensors & Hardware Suite', icon: Sliders },
    { id: 'packaging', label: 'Bundle & Subpackages', icon: Package },
    { id: 'storage', label: 'Storage & Database', icon: Database },
    { id: 'templates', label: 'Project Templates', icon: Layers },
    { id: 'settings', label: 'Studio Preferences', icon: Settings },
  ];

  return (
    <div className="h-full flex bg-[#252526] dark:bg-[#252526] light:bg-[#f3f3f3] border-r border-[#3c3c3c] dark:border-[#3c3c3c] light:border-[#e5e5e5] select-none">
      {/* Activity Bar (Fixed narrow column) */}
      <div className="w-12 h-full bg-[#333333] dark:bg-[#333333] light:bg-[#2c2c2c] flex flex-col items-center py-2 justify-between z-10 shrink-0">
        <div className="flex flex-col items-center gap-2 w-full">
          {activityItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSidebarView === item.id && !isCollapsed;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'templates') {
                    setTemplateModalOpen(true);
                  } else {
                    if (activeSidebarView === item.id && !isCollapsed) {
                      togglePanelCollapse('sidebar');
                    } else {
                      setActiveSidebarView(item.id as any);
                      if (isCollapsed) togglePanelCollapse('sidebar');
                    }
                  }
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-md transition-all relative ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
                title={item.label}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-r" />
                )}
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => togglePanelCollapse('sidebar')}
          className="w-10 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded transition"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Sidebar Content Pane */}
      {!isCollapsed && (
        <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#252526] dark:bg-[#252526] light:bg-[#f3f3f3]">
          {activeSidebarView === 'explorer' && <FileTreeBrowser />}

          {activeSidebarView === 'sensors' && <SensorSuitePanel />}

          {activeSidebarView === 'packaging' && (
            <div className="flex-1 overflow-y-auto">
              <SubpackageVisualizer />
            </div>
          )}

          {activeSidebarView === 'storage' && (
            <div className="flex-1 overflow-hidden">
              <StorageExplorer />
            </div>
          )}

          {activeSidebarView === 'settings' && (
            <div className="p-4 text-xs text-gray-400 flex flex-col gap-3">
              <h3 className="font-semibold text-gray-200 uppercase tracking-wider text-[11px]">
                Studio Preferences
              </h3>
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-2 text-neutral-300">
                <div className="font-bold text-white">Goat Mini-App DevTools Studio</div>
                <div className="text-[10px] text-neutral-400 font-mono">Version: 1.0.0</div>
                <div className="text-[10px] text-neutral-400 font-mono">Engine: Dual-Thread V8 + AppView</div>
                <div className="text-[10px] text-neutral-400 font-mono">Canonical Actions: 203 GoatBridge APIs</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
