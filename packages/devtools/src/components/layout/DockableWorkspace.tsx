/**
 * @goat/devtools - Master Dockable Workspace Component
 * Integrated multi-panel IDE shell connecting Editor, Simulator, Sensors, and Debugger.
 */

import React, { useState } from 'react';
import {
  Files,
  Database,
  Box,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';
import { TabBar } from './TabBar.tsx';
import { MonacoCodeEditor } from '../editor/MonacoCodeEditor.tsx';
import { FileTreeBrowser } from '../editor/FileTreeBrowser.tsx';

// Debugger Components
import { DebuggerPanel } from '../debugger/DebuggerPanel.tsx';
import { StorageExplorer } from '../debugger/StorageExplorer.tsx';

// Sensor Components
import { MotionSensorPanel } from '../sensors/MotionSensorPanel.tsx';
import { GeolocationPanel } from '../sensors/GeolocationPanel.tsx';
import { NetworkEmulationPanel } from '../sensors/NetworkEmulationPanel.tsx';
import { BatteryBrightnessPanel } from '../sensors/BatteryBrightnessPanel.tsx';
import { BleSimulatorPanel } from '../sensors/BleSimulatorPanel.tsx';
import { NfcTagGeneratorPanel } from '../sensors/NfcTagGeneratorPanel.tsx';
import { BiometricsModal } from '../sensors/BiometricsModal.tsx';

// Packaging Components
import { SubpackageVisualizer } from '../packaging/SubpackageVisualizer.tsx';

// Simulator Components
import { SimulatorViewport } from '../simulator/SimulatorViewport.tsx';

export const DockableWorkspace: React.FC = () => {
  const {
    isLeftSidebarOpen,
    isBottomDebuggerOpen,
    isRightSimulatorOpen,
    leftSidebarWidth,
    bottomDebuggerHeight,
    rightSimulatorWidth,
    activeLeftTab = 'files',
    setActiveLeftTab,
    setTemplateModalOpen,
  } = useDevToolsStore();

  const [activeSensorSubTab, setActiveSensorSubTab] = useState<
    'motion' | 'gps' | 'network' | 'battery' | 'ble' | 'nfc' | 'biometrics'
  >('motion');

  return (
    <div className="flex-1 flex overflow-hidden relative bg-ide-bg-dark dark:bg-ide-bg-dark bg-gray-100 select-none">
      {/* ========================================================================= */}
      {/* 1. LEFT ACTIVITY BAR & SIDEBAR                                            */}
      {/* ========================================================================= */}
      {isLeftSidebarOpen && (
        <div
          style={{ width: `${leftSidebarWidth || 300}px` }}
          className="h-full flex border-r border-ide-border-dark dark:border-ide-border-dark border-ide-border-light bg-ide-panel-dark dark:bg-ide-panel-dark bg-ide-panel-light shrink-0 z-10"
        >
          {/* Narrow Activity Icon Rail */}
          <div className="w-11 border-r border-ide-border-dark dark:border-ide-border-dark border-ide-border-light flex flex-col items-center py-2 space-y-3 bg-ide-bg-dark dark:bg-ide-bg-dark bg-gray-200 shrink-0">
            <button
              onClick={() => setActiveLeftTab('files')}
              className={`p-2 rounded-lg transition-colors ${
                activeLeftTab === 'files'
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Project Explorer (Files)"
            >
              <Files className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveLeftTab('sensors')}
              className={`p-2 rounded-lg transition-colors ${
                activeLeftTab === 'sensors'
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Sensors & Hardware Mocking Suite"
            >
              <Sliders className="w-5 h-5 text-emerald-400" />
            </button>

            <button
              onClick={() => setActiveLeftTab('storage')}
              className={`p-2 rounded-lg transition-colors ${
                activeLeftTab === 'storage'
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Sandbox Storage & SQLite"
            >
              <Database className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveLeftTab('packaging')}
              className={`p-2 rounded-lg transition-colors ${
                activeLeftTab === 'packaging'
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Subpackages & Bundle Visualizer"
            >
              <Box className="w-5 h-5 text-purple-400" />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setTemplateModalOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
              title="Starter Templates"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
            </button>
          </div>

          {/* Expanded Sidebar Content */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {activeLeftTab === 'files' && <FileTreeBrowser />}

            {activeLeftTab === 'sensors' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Sensors Sub-Nav Tabs */}
                <div className="h-8 border-b border-neutral-800 flex items-center px-2 space-x-1 overflow-x-auto shrink-0 bg-neutral-900/60 text-[10px]">
                  <button
                    onClick={() => setActiveSensorSubTab('motion')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'motion' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Motion
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('gps')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'gps' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    GPS
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('network')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'network' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Network
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('battery')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'battery' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Battery
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('ble')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'ble' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    BLE
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('nfc')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'nfc' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    NFC
                  </button>
                  <button
                    onClick={() => setActiveSensorSubTab('biometrics')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                      activeSensorSubTab === 'biometrics' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Biometrics
                  </button>
                </div>

                {/* Sensor Panel Views */}
                <div className="flex-1 overflow-y-auto">
                  {activeSensorSubTab === 'motion' && <MotionSensorPanel />}
                  {activeSensorSubTab === 'gps' && <GeolocationPanel />}
                  {activeSensorSubTab === 'network' && <NetworkEmulationPanel />}
                  {activeSensorSubTab === 'battery' && <BatteryBrightnessPanel />}
                  {activeSensorSubTab === 'ble' && <BleSimulatorPanel />}
                  {activeSensorSubTab === 'nfc' && <NfcTagGeneratorPanel />}
                  {activeSensorSubTab === 'biometrics' && <BiometricsModal isOpen={true} />}
                </div>
              </div>
            )}

            {activeLeftTab === 'storage' && (
              <div className="flex-1 overflow-hidden">
                <StorageExplorer />
              </div>
            )}

            {activeLeftTab === 'packaging' && (
              <div className="flex-1 overflow-y-auto">
                <SubpackageVisualizer />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CENTER WORKSPACE: CODE EDITOR & MULTI-LANE DEBUGGER                   */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabBar />
          <MonacoCodeEditor />
        </div>

        {/* Bottom Multi-Lane Debugger */}
        {isBottomDebuggerOpen && (
          <DebuggerPanel initialHeight={bottomDebuggerHeight || 280} />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT DUAL-THREAD DEVICE SIMULATOR VIEWPORT                            */}
      {/* ========================================================================= */}
      {isRightSimulatorOpen && (
        <div
          style={{ width: `${rightSimulatorWidth || 420}px` }}
          className="h-full border-l border-ide-border-dark dark:border-ide-border-dark border-ide-border-light bg-ide-panel-dark dark:bg-ide-panel-dark bg-ide-panel-light flex flex-col shrink-0 z-10"
        >
          <SimulatorViewport />
        </div>
      )}
    </div>
  );
};
