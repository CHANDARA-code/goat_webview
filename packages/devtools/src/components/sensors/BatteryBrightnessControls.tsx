/**
 * @goat/devtools - BatteryBrightnessControls Component
 * Real-time battery percentage (0-100%), isCharging toggle, charging power source,
 * and screen brightness slider (0-100%) with visual backlight luminescence simulation.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { Battery, BatteryCharging, Sun, Zap, Power, Radio } from 'lucide-react';

export const BatteryBrightnessControls: React.FC = () => {
  const {
    battery = { level: 85, isCharging: false, chargingSource: 'usb', chargingTime: 0, dischargingTime: 18000 },
    brightness = { level: 0.8, autoAdjust: false },
    screenBrightness = 0.8,
    setBattery,
    setBrightness,
    setScreenBrightness,
  } = useDevToolsStore();

  const handleBatteryLevelChange = (level: number) => {
    setBattery({ level, isCharging: battery.isCharging });
  };

  const handleChargingToggle = () => {
    setBattery({ level: battery.level, isCharging: !battery.isCharging });
  };

  const handleChargingSource = (source: 'ac' | 'usb' | 'wireless') => {
    setBattery({ ...battery, isCharging: true, chargingSource: source });
  };

  const effectiveBrightness = screenBrightness ?? brightness?.level ?? 0.8;

  const handleBrightnessChange = (val: number) => {
    if (typeof setScreenBrightness === 'function') {
      setScreenBrightness(val);
    }
    if (typeof setBrightness === 'function') {
      setBrightness({ level: val });
    }
  };

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="battery-brightness-controls">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          {battery.isCharging ? (
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          ) : (
            <Battery className="w-4 h-4 text-amber-400" />
          )}
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Battery & Screen Backlight
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className={battery.isCharging ? 'text-emerald-400 font-bold' : 'text-neutral-400'}>
            {battery.isCharging ? '⚡ Plugged In' : 'Discharging'}
          </span>
        </div>
      </div>

      {/* Battery State Section */}
      <div className="space-y-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Battery Charge Level
          </div>
          <div className="font-mono text-sm font-bold text-amber-400">
            {battery.level}%
          </div>
        </div>

        {/* Battery Level Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={battery.level}
          onChange={(e) => handleBatteryLevelChange(Number(e.target.value))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        {/* Quick Battery Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[10, 20, 50, 100].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleBatteryLevelChange(lvl)}
              className={`py-1 rounded text-[10px] font-mono border transition-colors ${
                battery.level === lvl
                  ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-bold'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {lvl}%
            </button>
          ))}
        </div>

        {/* Charging Toggle & Sources */}
        <div className="pt-2 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Charging Power Source</span>
            <button
              onClick={handleChargingToggle}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                battery.isCharging
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{battery.isCharging ? 'Plugged In' : 'Unplugged'}</span>
            </button>
          </div>

          {battery.isCharging && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(['ac', 'usb', 'wireless'] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => handleChargingSource(source)}
                  className={`py-1 rounded text-[10px] font-mono border uppercase transition-colors ${
                    battery.chargingSource === source
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screen Brightness Section */}
      <div className="space-y-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5 text-yellow-400" />
            <span>Screen Brightness Backlight</span>
          </div>
          <div className="font-mono text-sm font-bold text-yellow-400">
            {Math.round(effectiveBrightness * 100)}%
          </div>
        </div>

        {/* Brightness Slider */}
        <input
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={effectiveBrightness}
          onChange={(e) => handleBrightnessChange(Number(e.target.value))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />

        {/* Visual Brightness Preview Simulation */}
        <div
          className="h-12 rounded-lg border border-neutral-700 flex flex-col items-center justify-center font-mono text-[10px] font-bold transition-all shadow-inner relative overflow-hidden"
          style={{
            backgroundColor: `rgba(255, 255, 255, ${Math.max(0.08, effectiveBrightness)})`,
            color: effectiveBrightness > 0.4 ? '#000000' : '#ffffff',
          }}
        >
          <span>Backlight Luminance: {Math.round(effectiveBrightness * 100)}%</span>
          <span className="text-[9px] opacity-75">
            {effectiveBrightness > 0.7 ? 'High Daylight' : effectiveBrightness > 0.3 ? 'Standard' : 'Night Dim'}
          </span>
        </div>
      </div>
    </div>
  );
};
