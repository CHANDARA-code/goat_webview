/**
 * @goat/devtools - Master Debugger Panel Component
 * Bottom dock multi-lane developer tools host integrating:
 * - Elements & DOM Inspector (ElementsInspector)
 * - Unified Multi-Thread Console (UnifiedConsole)
 * - Bridge IPC & Network Waterfall (BridgeWaterfall)
 * - Sandboxed Key-Value Storage Manager (StorageExplorer)
 * - SQLite Database Explorer & Query Runner (SqliteViewer)
 * - Sandboxed FileSystem Browser (FileSystemBrowser)
 * Complete with draggable height resizing, minimize/maximize toggling, and telemetry badges.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Terminal,
  Activity,
  Layers,
  Key,
  Database,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Trash2,
  X,
} from 'lucide-react';

import { ElementsInspector } from './ElementsInspector.tsx';
import { UnifiedConsole } from './UnifiedConsole.tsx';
import { BridgeWaterfall } from './BridgeWaterfall.tsx';
import { StorageExplorer } from './StorageExplorer.tsx';
import { SqliteViewer } from './SqliteViewer.tsx';
import { FileSystemBrowser } from './FileSystemBrowser.tsx';

export type DebuggerTab =
  | 'elements'
  | 'console'
  | 'waterfall'
  | 'bridge'
  | 'storage'
  | 'sqlite'
  | 'fs'
  | 'filesystem';

interface DebuggerPanelProps {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DebuggerPanel: React.FC<DebuggerPanelProps> = ({
  initialHeight = 280,
  minHeight = 140,
  maxHeight = 650,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
}) => {
  const {
    activeDebuggerTab = 'console',
    activeBottomTab = 'console',
    setActiveDebuggerTab,
    setActiveBottomTab,
    collapsedPanels,
    togglePanelCollapse,
    panelSizes,
    setPanelSizes,
    logs,
    consoleLogs,
    clearLogs,
    clearConsoleLogs,
    waterfallSpans,
    bridgeTraces,
    clearWaterfall,
    clearBridgeTraces,
    storageData,
    clearStorageKv,
    sqliteTables,
  } = useDevToolsStore();

  const [panelHeight, setPanelHeight] = useState(panelSizes?.debuggerHeight || initialHeight);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const activeTab = (activeDebuggerTab || activeBottomTab || 'console').toLowerCase() as DebuggerTab;
  const isCollapsed =
    propIsCollapsed !== undefined
      ? propIsCollapsed
      : collapsedPanels?.debugger ?? false;

  const totalLogs = (consoleLogs || logs || []).length;
  const totalTraces = (bridgeTraces || waterfallSpans || []).length;
  const totalKvKeys = Object.keys(storageData?.kvStore || {}).length;
  const totalSqliteTables = (sqliteTables || []).length;

  const handleSelectTab = (tab: DebuggerTab) => {
    if (typeof setActiveDebuggerTab === 'function') setActiveDebuggerTab(tab);
    if (typeof setActiveBottomTab === 'function') setActiveBottomTab(tab);
    if (isCollapsed) {
      if (onToggleCollapse) onToggleCollapse();
      else if (typeof togglePanelCollapse === 'function') togglePanelCollapse('debugger');
    }
  };

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else if (typeof togglePanelCollapse === 'function') {
      togglePanelCollapse('debugger');
    }
  };

  const handleClearActiveTab = () => {
    if (activeTab === 'console') {
      if (typeof clearConsoleLogs === 'function') clearConsoleLogs();
      if (typeof clearLogs === 'function') clearLogs();
    } else if (activeTab === 'waterfall' || activeTab === 'bridge') {
      if (typeof clearBridgeTraces === 'function') clearBridgeTraces();
      if (typeof clearWaterfall === 'function') clearWaterfall();
    } else if (activeTab === 'storage') {
      if (typeof clearStorageKv === 'function') clearStorageKv();
    }
  };

  // Drag Resize Handler
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startH = panelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startH + deltaY));
      setPanelHeight(newHeight);
      if (typeof setPanelSizes === 'function') {
        setPanelSizes({ debuggerHeight: newHeight });
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelHeight, minHeight, maxHeight, setPanelSizes]);

  const effectiveHeight = isCollapsed ? 32 : isMaximized ? 600 : panelHeight;

  return (
    <div
      data-testid="master-debugger-panel"
      style={{ height: `${effectiveHeight}px` }}
      className={`border-t border-neutral-800 bg-neutral-950 text-neutral-200 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-75 ${
        isResizing ? 'cursor-row-resize select-none' : ''
      }`}
    >
      {/* Draggable Resizer Bar */}
      {!isCollapsed && !isMaximized && (
        <div
          onMouseDown={startResize}
          className="h-1 w-full bg-neutral-800 hover:bg-blue-500 cursor-row-resize transition-colors z-20"
          title="Drag to resize debugger panel height"
        />
      )}

      {/* Tab Navigation Header Bar */}
      <div className="h-8 border-b border-neutral-800 px-2 flex items-center justify-between bg-neutral-900/60 text-xs shrink-0 select-none">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          {/* Elements */}
          <button
            onClick={() => handleSelectTab('elements')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              activeTab === 'elements' && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Elements</span>
          </button>

          {/* Console */}
          <button
            onClick={() => handleSelectTab('console')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              activeTab === 'console' && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Console</span>
            {totalLogs > 0 && (
              <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
                {totalLogs}
              </span>
            )}
          </button>

          {/* Bridge Waterfall */}
          <button
            onClick={() => handleSelectTab('waterfall')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              (activeTab === 'waterfall' || activeTab === 'bridge') && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span>Waterfall</span>
            {totalTraces > 0 && (
              <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
                {totalTraces}
              </span>
            )}
          </button>

          {/* KV Storage */}
          <button
            onClick={() => handleSelectTab('storage')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              activeTab === 'storage' && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Storage</span>
            {totalKvKeys > 0 && (
              <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
                {totalKvKeys}
              </span>
            )}
          </button>

          {/* SQLite */}
          <button
            onClick={() => handleSelectTab('sqlite')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              activeTab === 'sqlite' && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>SQLite</span>
            {totalSqliteTables > 0 && (
              <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full font-mono">
                {totalSqliteTables}
              </span>
            )}
          </button>

          {/* FileSystem */}
          <button
            onClick={() => handleSelectTab('fs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
              (activeTab === 'fs' || activeTab === 'filesystem') && !isCollapsed
                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
            <span>FileSystem</span>
          </button>
        </div>

        {/* Panel Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Quick Clear button for Console/Waterfall */}
          {(activeTab === 'console' || activeTab === 'waterfall' || activeTab === 'bridge') && !isCollapsed && (
            <button
              onClick={handleClearActiveTab}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[10px] flex items-center gap-1"
              title="Clear Active Stream"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}

          {/* Maximize / Restore Toggle */}
          {!isCollapsed && (
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              title={isMaximized ? 'Restore Height' : 'Maximize Panel'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Collapse / Expand Toggle */}
          <button
            onClick={handleToggleCollapse}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title={isCollapsed ? 'Expand Debugger Panel' : 'Minimize Debugger Panel'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'elements' && <ElementsInspector />}
          {activeTab === 'console' && <UnifiedConsole />}
          {(activeTab === 'waterfall' || activeTab === 'bridge') && <BridgeWaterfall />}
          {activeTab === 'storage' && <StorageExplorer />}
          {activeTab === 'sqlite' && <SqliteViewer />}
          {(activeTab === 'fs' || activeTab === 'filesystem') && <FileSystemBrowser />}
        </div>
      )}
    </div>
  );
};
