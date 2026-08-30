/**
 * @goat/devtools - SensorSuitePanel Component
 * Master panel organizing all hardware controls (Motion 3D, Geolocation GPX,
 * Network Throttling, Battery & Screen Brightness, BLE & NFC, Biometrics)
 * with responsive tabs and state reset.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Sliders,
  Activity,
  MapPin,
  Wifi,
  Battery,
  Bluetooth,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MotionController } from './MotionController.tsx';
import { GeolocationPicker } from './GeolocationPicker.tsx';
import { NetworkThrottlePanel } from './NetworkThrottlePanel.tsx';
import { BatteryBrightnessControls } from './BatteryBrightnessControls.tsx';
import { BleNfcSimulator } from './BleNfcSimulator.tsx';
import { BiometricsModal } from './BiometricsModal.tsx';

export type SensorTabId = 'motion' | 'gps' | 'network' | 'battery' | 'ble_nfc' | 'biometrics';

export const SensorSuitePanel: React.FC = () => {
  const { resetSensors } = useDevToolsStore();
  const [activeTab, setActiveTab] = useState<SensorTabId>('motion');

  const tabs: Array<{ id: SensorTabId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'motion', label: 'Motion', icon: Activity },
    { id: 'gps', label: 'GPS', icon: MapPin },
    { id: 'network', label: 'Network', icon: Wifi },
    { id: 'battery', label: 'Battery', icon: Battery },
    { id: 'ble_nfc', label: 'BLE & NFC', icon: Bluetooth },
    { id: 'biometrics', label: 'Biometrics', icon: ShieldCheck },
  ];

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-200 select-none overflow-hidden" data-testid="sensor-suite-panel">
      {/* Master Panel Header Bar */}
      <div className="h-10 px-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-xs tracking-tight text-neutral-100 uppercase">
            Hardware & Sensor Suite
          </span>
        </div>

        <button
          onClick={() => {
            if (typeof resetSensors === 'function') resetSensors();
          }}
          className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-[10px] font-medium transition-colors"
          title="Reset all simulated hardware sensors to default"
        >
          <RotateCcw className="w-3 h-3 text-neutral-400" />
          <span>Reset All</span>
        </button>
      </div>

      {/* Sensor Navigation Tab Bar */}
      <div className="h-9 border-b border-neutral-800 bg-neutral-900/40 flex items-center px-1.5 gap-1 overflow-x-auto shrink-0 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Sensor Control Pane */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'motion' && <MotionController />}
        {activeTab === 'gps' && <GeolocationPicker />}
        {activeTab === 'network' && <NetworkThrottlePanel />}
        {activeTab === 'battery' && <BatteryBrightnessControls />}
        {activeTab === 'ble_nfc' && <BleNfcSimulator />}
        {activeTab === 'biometrics' && <BiometricsModal isOpen={true} />}
      </div>
    </div>
  );
};
