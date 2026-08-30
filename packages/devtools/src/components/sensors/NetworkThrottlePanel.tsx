/**
 * @goat/devtools - NetworkThrottlePanel Component
 * Presets (Online, 5G, 4G, 3G, 2G, High Latency, Packet Loss, Offline)
 * + custom download/upload/latency/packet loss sliders.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { Wifi, WifiOff, Sliders, ArrowDownCircle, ArrowUpCircle, Clock, AlertOctagon } from 'lucide-react';
import type { NetworkPreset } from '../../types/index.ts';

export const NetworkThrottlePanel: React.FC = () => {
  const {
    networkThrottling = {
      preset: 'online',
      latencyMs: 0,
      downloadKbps: 100000,
      uploadKbps: 50000,
      packetLossRate: 0,
      isOffline: false,
    },
    setNetworkPreset,
    setNetworkCustom,
    setCustomNetworkThrottling,
  } = useDevToolsStore();

  const presets: Array<{
    id: NetworkPreset | string;
    label: string;
    latency: number;
    download: string;
    upload: string;
    packetLoss: string;
  }> = [
    { id: 'online', label: 'Online (No Throttle)', latency: 0, download: '100 Mbps', upload: '50 Mbps', packetLoss: '0%' },
    { id: '5g', label: '5G High-Speed Mobile', latency: 10, download: '100 Mbps', upload: '50 Mbps', packetLoss: '0%' },
    { id: '4g', label: '4G LTE Standard', latency: 40, download: '20 Mbps', upload: '10 Mbps', packetLoss: '0%' },
    { id: '3g', label: 'Fast 3G', latency: 150, download: '750 Kbps', upload: '250 Kbps', packetLoss: '1%' },
    { id: '2g', label: 'Slow 2G GPRS', latency: 400, download: '250 Kbps', upload: '50 Kbps', packetLoss: '2%' },
    { id: 'high-latency', label: 'High Latency Satellite', latency: 800, download: '1 Mbps', upload: '500 Kbps', packetLoss: '5%' },
    { id: 'packet-loss', label: 'Packet Loss Simulation', latency: 80, download: '5 Mbps', upload: '2 Mbps', packetLoss: '25%' },
    { id: 'offline', label: 'Offline Mode', latency: 0, download: '0 Kbps', upload: '0 Kbps', packetLoss: '100%' },
  ];

  const handlePresetSelect = (preset: NetworkPreset | string) => {
    setNetworkPreset(preset as any);
  };

  const handleCustomChange = (field: string, val: number) => {
    const next = {
      latencyMs: networkThrottling.latencyMs || 0,
      downloadKbps: networkThrottling.downloadKbps || 10000,
      uploadKbps: networkThrottling.uploadKbps || 5000,
      packetLossRate: networkThrottling.packetLossRate || 0,
      isOffline: false,
      [field]: val,
    };
    if (typeof setNetworkCustom === 'function') {
      setNetworkCustom(next);
    } else if (typeof setCustomNetworkThrottling === 'function') {
      setCustomNetworkThrottling(next);
    }
  };

  const currentPreset = String(networkThrottling.preset || 'online');

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="network-throttle-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          {networkThrottling.isOffline ? (
            <WifiOff className="w-4 h-4 text-rose-400" />
          ) : (
            <Wifi className="w-4 h-4 text-blue-400" />
          )}
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Network Throttling & Profiles
          </h3>
        </div>
        <div
          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
            networkThrottling.isOffline
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
              : currentPreset === 'online'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
              : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
          }`}
        >
          {currentPreset.toUpperCase()}
        </div>
      </div>

      {/* Preset Profiles List */}
      <div>
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Throttling Profiles
        </div>
        <div className="space-y-1.5">
          {presets.map((p) => {
            const isSelected =
              currentPreset === p.id ||
              (p.id === 'high-latency' && currentPreset === 'high_latency') ||
              (p.id === 'packet-loss' && currentPreset === 'packet_loss');

            return (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`w-full p-2 rounded-lg border flex items-center justify-between text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60'
                }`}
              >
                <div>
                  <div className="font-semibold text-[11px]">{p.label}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    {p.download} ↓ / {p.upload} ↑
                  </div>
                </div>
                <div className="font-mono text-[10px] text-right text-neutral-400">
                  <div>{p.latency > 0 ? `${p.latency}ms delay` : '0ms'}</div>
                  {p.packetLoss !== '0%' && (
                    <div className="text-rose-400 font-semibold">{p.packetLoss} loss</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Slider Controls */}
      <div className="space-y-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Custom Throttling Parameters</span>
        </div>

        {/* Latency Slider */}
        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              Round-Trip Latency:
            </span>
            <span className="text-amber-400 font-bold">{networkThrottling.latencyMs || 0} ms</span>
          </div>
          <input
            type="range"
            min="0"
            max="2000"
            step="25"
            value={networkThrottling.latencyMs || 0}
            onChange={(e) => handleCustomChange('latencyMs', Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Download Bandwidth Slider */}
        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span className="flex items-center gap-1">
              <ArrowDownCircle className="w-3 h-3 text-emerald-400" />
              Download Bandwidth:
            </span>
            <span className="text-emerald-400 font-bold">
              {(networkThrottling.downloadKbps || 0) >= 1000
                ? `${((networkThrottling.downloadKbps || 0) / 1000).toFixed(1)} Mbps`
                : `${networkThrottling.downloadKbps || 0} Kbps`}
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="100000"
            step="250"
            value={networkThrottling.downloadKbps || 100000}
            onChange={(e) => handleCustomChange('downloadKbps', Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Upload Bandwidth Slider */}
        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span className="flex items-center gap-1">
              <ArrowUpCircle className="w-3 h-3 text-blue-400" />
              Upload Bandwidth:
            </span>
            <span className="text-blue-400 font-bold">
              {(networkThrottling.uploadKbps || 0) >= 1000
                ? `${((networkThrottling.uploadKbps || 0) / 1000).toFixed(1)} Mbps`
                : `${networkThrottling.uploadKbps || 0} Kbps`}
            </span>
          </div>
          <input
            type="range"
            min="25"
            max="50000"
            step="100"
            value={networkThrottling.uploadKbps || 50000}
            onChange={(e) => handleCustomChange('uploadKbps', Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Packet Loss Slider */}
        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono mb-1">
            <span className="flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-rose-400" />
              Packet Loss Rate:
            </span>
            <span className="text-rose-400 font-bold">
              {Math.round(
                (networkThrottling.packetLossRate > 1
                  ? networkThrottling.packetLossRate
                  : networkThrottling.packetLossRate * 100) || 0
              )}
              %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(
              (networkThrottling.packetLossRate > 1
                ? networkThrottling.packetLossRate
                : networkThrottling.packetLossRate * 100) || 0
            )}
            onChange={(e) => {
              const val = Number(e.target.value);
              handleCustomChange('packetLossRate', val > 1 ? val / 100 : val);
            }}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
        </div>
      </div>
    </div>
  );
};
