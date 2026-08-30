/**
 * @goat/devtools - Bridge IPC & Network Waterfall Component
 * Chronological multi-lane trace timeline with round-trip latency measurements,
 * status codes, payload inspector drawer, domain filtering, and search.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Activity,
  Search,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { BridgeTraceEntry, WaterfallSpan } from '../../types/debugger.ts';

const BRIDGE_DOMAINS = [
  'All',
  'Core',
  'Storage',
  'FileSystem',
  'Network',
  'Sensors',
  'Location',
  'Biometrics',
  'Media',
  'Contacts',
  'Push',
  'BLE/NFC',
  'Web3',
  'UI',
  'Navigation',
  'Subpackages',
  'APM',
];

export const BridgeWaterfall: React.FC = () => {
  const {
    bridgeTraces,
    waterfallSpans,
    selectedTraceId,
    setSelectedTraceId,
    clearBridgeTraces,
    clearWaterfall,
  } = useDevToolsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);

  const traces = bridgeTraces || waterfallSpans || [];

  const handleClear = () => {
    if (typeof clearBridgeTraces === 'function') clearBridgeTraces();
    if (typeof clearWaterfall === 'function') clearWaterfall();
  };

  const copyText = (label: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPayload(label);
      setTimeout(() => setCopiedPayload(null), 1500);
    }
  };

  const filteredTraces = traces.filter((t: any) => {
    if (selectedDomain !== 'All') {
      const domain = (t.domain || '').toLowerCase();
      if (!domain.includes(selectedDomain.toLowerCase())) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAction = (t.action || '').toLowerCase().includes(q);
      const matchDomain = (t.domain || '').toLowerCase().includes(q);
      const matchPayload = t.payload ? JSON.stringify(t.payload).toLowerCase().includes(q) : false;
      if (!matchAction && !matchDomain && !matchPayload) return false;
    }
    return true;
  });

  const selectedTrace = traces.find(
    (t: any) => t.id === selectedTraceId || t.callId === selectedTraceId
  );

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-neutral-950" data-testid="bridge-waterfall-panel">
      {/* Filter & Action Header Bar */}
      <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-neutral-300 shrink-0 bg-neutral-900/40">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80">
            <Search className="w-3 h-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter actions, domains, payloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white focus:outline-none w-48 text-[11px] placeholder:text-neutral-500"
            />
          </div>

          {/* Domain Filter Dropdown */}
          <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80 text-[10px]">
            <Filter className="w-3 h-3 text-neutral-400" />
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-transparent text-neutral-300 focus:outline-none"
            >
              {BRIDGE_DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {domain === 'All' ? 'All Domains' : domain}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[10px] text-neutral-500">
            {filteredTraces.length} recorded IPC traces
          </span>
        </div>

        <button
          onClick={handleClear}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 text-[10px]"
          title="Clear traces"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      {/* Main Waterfall Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Waterfall Table */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-neutral-500 pb-1.5 border-b border-neutral-800 select-none">
            <span className="col-span-2">Timestamp</span>
            <span className="col-span-4">Bridge Action & Domain</span>
            <span className="col-span-2">Lane / Route</span>
            <span className="col-span-2">Round-Trip Latency</span>
            <span className="col-span-2">Status</span>
          </div>

          {/* Trace Rows */}
          {filteredTraces.length === 0 ? (
            <div className="p-8 text-center text-neutral-600 text-xs">
              No bridge IPC traces recorded yet. Invoke a bridge action in the simulator to inspect waterfall.
            </div>
          ) : (
            filteredTraces.map((trace: any) => {
              const traceKey = trace.id || trace.callId;
              const isSelected = selectedTraceId === trace.id || selectedTraceId === trace.callId;
              const duration = trace.durationMs ?? 0;
              const isSuccess = trace.status === 'success' || !trace.status;

              // Latency color code
              let latencyColor = 'text-emerald-400 bg-emerald-500';
              if (duration > 50) latencyColor = 'text-rose-400 bg-rose-500';
              else if (duration > 15) latencyColor = 'text-amber-400 bg-amber-500';

              return (
                <div
                  key={traceKey || Math.random()}
                  data-testid={`trace-row-${traceKey}`}
                  onClick={() => setSelectedTraceId(isSelected ? null : traceKey)}
                  className={`grid grid-cols-12 gap-2 items-center py-1.5 px-2 rounded cursor-pointer transition-colors border-b border-neutral-900/60 ${
                    isSelected
                      ? 'bg-blue-900/40 border border-blue-500/80 text-blue-200'
                      : 'hover:bg-neutral-900/50 text-neutral-300'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="col-span-2 text-neutral-500 text-[10px]">
                    {new Date(trace.timestamp || trace.startTime || Date.now()).toLocaleTimeString()}
                  </span>

                  {/* Action & Domain */}
                  <div className="col-span-4 flex flex-col min-w-0">
                    <span className="font-bold text-blue-400 truncate">{trace.action}</span>
                    <span className="text-[9px] text-neutral-500 truncate">{trace.domain || 'Native Bridge'}</span>
                  </div>

                  {/* Lane */}
                  <div className="col-span-2 flex items-center gap-1 text-[10px] text-neutral-400">
                    <ArrowRightLeft className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate">Worker ⇄ Host</span>
                  </div>

                  {/* Latency Bar & Value */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-neutral-300 w-12 text-right">
                      {duration.toFixed(1)}ms
                    </span>
                    <div className="flex-1 bg-neutral-900 h-1.5 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${latencyColor.split(' ')[1]}`}
                        style={{ width: `${Math.min(100, Math.max(6, duration * 3))}%` }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center gap-1">
                    {isSuccess ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-bold text-[9px] flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>200 OK</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-rose-950/70 text-rose-400 border border-rose-800/60 font-bold text-[9px] flex items-center gap-1">
                        <XCircle className="w-2.5 h-2.5" />
                        <span>ERROR</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Trace Payload Inspector Drawer */}
        {selectedTrace && (
          <div className="w-84 border-l border-neutral-800 p-3 overflow-y-auto flex flex-col space-y-3 bg-neutral-900/30">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="font-bold text-neutral-200 text-[11px] truncate mr-2">
                Trace: {selectedTrace.action}
              </div>
              <button
                onClick={() => setSelectedTraceId(null)}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Trace Meta */}
            <div className="space-y-1 bg-neutral-950 p-2.5 rounded border border-neutral-800 text-[10px]">
              <div className="flex justify-between">
                <span className="text-neutral-500">Domain:</span>
                <span className="text-neutral-300 font-bold">{selectedTrace.domain || 'Core'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Call ID:</span>
                <span className="text-neutral-400 font-mono">{selectedTrace.callId || selectedTrace.id || 'n/a'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Round-Trip Duration:</span>
                <span className="text-amber-300 font-bold">{selectedTrace.durationMs || 0} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Status:</span>
                <span className={selectedTrace.status === 'error' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {selectedTrace.status || 'success'}
                </span>
              </div>
            </div>

            {/* IPC Round-Trip Lane Breakdown */}
            <div className="bg-neutral-950 p-2 rounded border border-neutral-800 text-[10px] space-y-1">
              <div className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] mb-1">
                Telemetry Lane Pipeline
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-blue-400">1. AppService (Worker)</span>
                <span className="text-neutral-500">Dispatch</span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-emerald-400">2. AppView (DOM Relay)</span>
                <span className="text-neutral-500">IPC Channel</span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-purple-400">3. GoatHost (Native)</span>
                <span className="text-neutral-500">Mock Handlers</span>
              </div>
            </div>

            {/* Request Payload */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Request Payload
                </span>
                <button
                  onClick={() => copyText('req', JSON.stringify(selectedTrace.payload || {}, null, 2))}
                  className="text-[9px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                >
                  {copiedPayload === 'req' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-2 bg-neutral-950 rounded border border-neutral-800 text-[10px] text-neutral-300 overflow-x-auto max-h-36 font-mono">
                {JSON.stringify(selectedTrace.payload || {}, null, 2)}
              </pre>
            </div>

            {/* Response / Reply Data */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Host Response / Reply
                </span>
                <button
                  onClick={() => copyText('res', JSON.stringify(selectedTrace.response || selectedTrace.reply || selectedTrace.data || {}, null, 2))}
                  className="text-[9px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                >
                  {copiedPayload === 'res' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-2 bg-neutral-950 rounded border border-neutral-800 text-[10px] text-emerald-300 overflow-x-auto max-h-36 font-mono">
                {JSON.stringify(selectedTrace.response || selectedTrace.reply || selectedTrace.data || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
