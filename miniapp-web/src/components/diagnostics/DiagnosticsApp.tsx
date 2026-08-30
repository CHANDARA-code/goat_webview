import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Zap,
  Activity,
  Copy,
  CheckCircle2,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { bridge } from '../../miniapp-bridge';
import { DeviceInfo, BridgeLogEntry } from '../../types';

interface DiagnosticsAppProps {
  logs: BridgeLogEntry[];
  fps?: number;
}

export const DiagnosticsApp: React.FC<DiagnosticsAppProps> = ({ logs, fps = 60 }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customAction, setCustomAction] = useState('GET_DEVICE_INFO');
  const [customPayload, setCustomPayload] = useState('{}');
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [latencyBenchResult, setLatencyBenchResult] = useState<number | null>(null);

  useEffect(() => {
    bridge.setNavBar({
      title: 'Bridge Diagnostics Console',
      subtitle: '18 Domains • 197 Actions',
      backgroundColor: '#0c1a2e',
      textColor: '#38bdf8',
      isDark: true
    }).catch(() => {});

    fetchDevice();
  }, []);

  const fetchDevice = async () => {
    setLoadingDevice(true);
    try {
      const info = await bridge.getDeviceInfo();
      setDeviceInfo(info);
    } catch (e) {
      console.warn('Get device info error:', e);
    } finally {
      setLoadingDevice(false);
    }
  };

  const runCustomAction = async () => {
    try {
      await bridge.triggerImpact('light');
      const start = performance.now();
      let parsed = {};
      try {
        parsed = JSON.parse(customPayload);
      } catch {
        parsed = {};
      }
      const res = await bridge.callNative(customAction.trim(), parsed);
      const duration = performance.now() - start;
      setLatencyBenchResult(Number(duration.toFixed(2)));
      setActionResult(JSON.stringify(res, null, 2));
      await bridge.triggerNotification('success');
    } catch (err: any) {
      setActionResult(`Error: ${err.message}`);
      await bridge.triggerNotification('error');
    }
  };

  const copyLog = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-sky-950/70 via-slate-900/80 to-slate-950 border border-sky-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 mb-2">
            <Terminal className="w-3.5 h-3.5" />
            Developer Diagnostics & IPC Trace
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Universal Bridge Diagnostics
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Real-time IPC telemetry, sub-millisecond warm-path benchmarking (&lt;5ms), and live payload introspection.
          </p>
        </div>
      </div>

      {/* Hardware Telemetry & Device Info */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-white text-base">Host Device Telemetry</h2>
          </div>
          <button
            onClick={fetchDevice}
            disabled={loadingDevice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDevice ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {deviceInfo ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
              <div className="text-slate-400">Device Model</div>
              <div className="text-white font-bold">{deviceInfo.manufacturer} {deviceInfo.model}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
              <div className="text-slate-400">Platform OS</div>
              <div className="text-white font-bold">{deviceInfo.platform || 'Android'} ({deviceInfo.androidVersion})</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
              <div className="text-slate-400">Screen Bounds</div>
              <div className="text-white font-bold">{deviceInfo.screenWidthDp} × {deviceInfo.screenHeightDp} dp</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
              <div className="text-slate-400">Battery Level</div>
              <div className="text-emerald-400 font-bold">{Math.round(deviceInfo.batteryLevel * 100)}% {deviceInfo.isCharging ? '⚡' : ''}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 col-span-2 sm:col-span-4 flex items-center justify-between">
              <div className="text-slate-400">Render Pipeline Refresh Rate</div>
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {fps} FPS (Smooth V-Sync)
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-950 text-xs font-mono text-slate-400">
            Querying native device context...
          </div>
        )}
      </div>

      {/* Interactive Action Dispatcher */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-white text-base">Direct IPC Action Dispatcher</h2>
          </div>
          {latencyBenchResult !== null && (
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
              latencyBenchResult < 5
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : latencyBenchResult < 15
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-red-500/20 text-red-300 border-red-500/30'
            }`}>
              Round-Trip: {latencyBenchResult} ms {latencyBenchResult < 5 ? '⚡ WARM-PATH' : ''}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              placeholder="Action Name (e.g. REQUEST_PAYMENT, BLE_START_SCAN)"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono"
            />
            <input
              type="text"
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
              placeholder='Payload JSON (e.g. {"key": "val"})'
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono"
            />
            <button
              onClick={runCustomAction}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 hover:brightness-110 active:scale-95 transition-all touch-press"
            >
              Dispatch Action
            </button>
          </div>

          {actionResult && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1 animate-fade-in">
              <div className="text-[10px] text-slate-400 font-mono">Response Payload:</div>
              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto max-h-48">
                {actionResult}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time IPC Log Stream */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-white text-base">Real-Time IPC Message Log</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {logs.length} events captured
          </span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-500 font-mono">
              No bridge messages dispatched yet. Trigger an action above to view traces.
            </div>
          ) : (
            logs.slice(-20).map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      log.type === 'req'
                        ? 'bg-sky-500/20 text-sky-400'
                        : log.type === 'res'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span className="text-white font-bold">{log.action}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                    <button
                      onClick={() => copyLog(JSON.stringify(log.details, null, 2), log.id || `${idx}`)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Copy payload"
                    >
                      {copiedId === (log.id || `${idx}`) ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <pre className="text-[11px] text-slate-400 truncate">
                  {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
