/**
 * @goat/devtools - Multi-Panel Layout Component
 * IDE layout shell with resizable panes, integrated debugger drawers, simulator, and global modals.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { HeaderBar } from './HeaderBar.tsx';
import { Sidebar } from './Sidebar.tsx';
import { TabBar } from './TabBar.tsx';
import { StatusBar } from './StatusBar.tsx';
import { MonacoCodeEditor } from '../editor/MonacoCodeEditor.tsx';
import { SchemaValidationBanner } from '../editor/SchemaValidationBanner.tsx';
import { TemplateSwitcherModal } from '../editor/TemplateSwitcherModal.tsx';
import { DeviceSimulator } from '../simulator/DeviceSimulator.tsx';
import { DebuggerPanel } from '../debugger/DebuggerPanel.tsx';
import { CdpPairingModal } from '../packaging/CdpPairingModal.tsx';
import { BytecodePreviewModal } from '../packaging/BytecodePreviewModal.tsx';
import { BiometricsModal } from '../sensors/BiometricsModal.tsx';
import {
  Smartphone,
  EyeOff,
} from 'lucide-react';

export const MultiPanelLayout: React.FC = () => {
  const {
    panelSizes,
    setPanelSizes,
    collapsedPanels,
    togglePanelCollapse,
    biometrics,
    isCdpModalOpen,
    isBytecodeModalOpen,
    setBiometrics,
  } = useDevToolsStore();

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [showCdpModal, setShowCdpModal] = useState(false);
  const [showBytecodeModal, setShowBytecodeModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Splitter Handlers
  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const newWidth = Math.max(180, Math.min(500, moveEvent.clientX));
      if (typeof setPanelSizes === 'function') {
        setPanelSizes({ sidebarWidth: newWidth });
      }
    };

    const onMouseUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setPanelSizes]);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const newWidth = Math.max(280, Math.min(650, containerWidth - moveEvent.clientX));
      if (typeof setPanelSizes === 'function') {
        setPanelSizes({ simulatorWidth: newWidth });
      }
    };

    const onMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setPanelSizes]);

  return (
    <div
      ref={containerRef}
      className={`h-screen w-screen flex flex-col overflow-hidden bg-[#1e1e1e] dark:bg-[#1e1e1e] light:bg-[#ffffff] text-gray-200 ${
        isResizingLeft || isResizingRight ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* 1. Top Navigation & Studio Toolbar */}
      <HeaderBar />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Panel */}
        <div
          style={{
            width: collapsedPanels?.sidebar ? 48 : (panelSizes?.sidebarWidth || 280),
          }}
          className="h-full flex-shrink-0 transition-all duration-75 relative z-10"
        >
          <Sidebar />
        </div>

        {/* Left Splitter */}
        {!collapsedPanels?.sidebar && (
          <div
            onMouseDown={startResizeLeft}
            className={`w-1 bg-[#3c3c3c] dark:bg-[#3c3c3c] light:bg-[#e5e5e5] hover:bg-blue-500 cursor-col-resize z-10 transition-colors ${
              isResizingLeft ? 'bg-blue-500' : ''
            }`}
          />
        )}

        {/* Center Editor & Bottom Debugger Column */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e] dark:bg-[#1e1e1e] light:bg-white relative min-w-0">
          {/* Tab Bar */}
          <TabBar />

          {/* Validation Banner */}
          <SchemaValidationBanner />

          {/* Monaco Editor Container */}
          <div className="flex-1 overflow-hidden relative min-h-0">
            <MonacoCodeEditor />
          </div>

          {/* Bottom Multi-Lane Debugger Drawer */}
          <DebuggerPanel />
        </div>

        {/* Right Splitter */}
        {!collapsedPanels?.simulator && (
          <div
            onMouseDown={startResizeRight}
            className={`w-1 bg-[#3c3c3c] dark:bg-[#3c3c3c] light:bg-[#e5e5e5] hover:bg-blue-500 cursor-col-resize z-10 transition-colors ${
              isResizingRight ? 'bg-blue-500' : ''
            }`}
          />
        )}

        {/* Right Simulator Viewport Panel */}
        <div
          style={{
            width: collapsedPanels?.simulator ? 36 : (panelSizes?.simulatorWidth || 420),
          }}
          className="h-full bg-[#181818] dark:bg-[#181818] light:bg-gray-100 border-l border-[#3c3c3c] dark:border-[#3c3c3c] light:border-[#e5e5e5] flex flex-col flex-shrink-0 transition-all duration-75 relative z-10"
        >
          {/* Simulator Header */}
          <div className="h-9 px-3 border-b border-[#3c3c3c] dark:border-[#3c3c3c] light:border-gray-300 flex items-center justify-between text-xs font-semibold text-gray-400 select-none">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              {!collapsedPanels?.simulator && <span>Device Simulator</span>}
            </div>
            <button
              onClick={() => typeof togglePanelCollapse === 'function' && togglePanelCollapse('simulator')}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
              title={collapsedPanels?.simulator ? 'Show Simulator' : 'Hide Simulator'}
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simulator Frame Slot */}
          {!collapsedPanels?.simulator ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <DeviceSimulator />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <span className="rotate-90 text-[10px] tracking-widest uppercase">Simulator</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar />

      {/* 4. Global Modals */}
      <TemplateSwitcherModal />
      {(isCdpModalOpen || showCdpModal) && (
        <CdpPairingModal isOpen={true} onClose={() => setShowCdpModal(false)} />
      )}
      {(isBytecodeModalOpen || showBytecodeModal) && (
        <BytecodePreviewModal isOpen={true} onClose={() => setShowBytecodeModal(false)} />
      )}
      {biometrics?.isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <BiometricsModal
              isOpen={true}
              onClose={() => setBiometrics({ ...biometrics, isModalOpen: false })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
