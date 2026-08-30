/**
 * @goat/devtools - Unified Cross-Thread Console Component
 * Cross-thread log aggregator streaming [AppService], [AppView], [GoatHost], and [System] logs
 * with thread badges, level filters (all, info, warn, error, debug), search, and interactive command prompt.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Terminal,
  Search,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  ArrowDownCircle,
  CornerDownLeft,
  Copy,
  Check,
} from 'lucide-react';
import type { LogLevel, ThreadType } from '../../types/debugger.ts';

export const UnifiedConsole: React.FC = () => {
  const {
    logs: storeLogs,
    consoleLogs,
    addConsoleLog,
    clearLogs,
    clearConsoleLogs,
  } = useDevToolsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [threadFilter, setThreadFilter] = useState<string>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const logs = consoleLogs || storeLogs || [];

  const handleClear = () => {
    if (typeof clearConsoleLogs === 'function') clearConsoleLogs();
    if (typeof clearLogs === 'function') clearLogs();
  };

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyLog = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Auto-scroll on new logs
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    // Log the developer's command
    addConsoleLog({
      thread: 'System',
      level: 'log',
      message: `> ${cmd}`,
      timestamp: Date.now(),
    });

    // Execute simulated mini REPL evaluation
    try {
      if (cmd.startsWith('console.log(')) {
        const inner = cmd.slice(12, -1);
        addConsoleLog({
          thread: 'AppService',
          level: 'log',
          message: inner.replace(/^['"]|['"]$/g, ''),
          timestamp: Date.now(),
        });
      } else if (cmd.startsWith('GoatBridge.call(')) {
        addConsoleLog({
          thread: 'GoatHost',
          level: 'info',
          message: `Dispatched RPC: ${cmd}`,
          data: { status: 'mock_executed', timestamp: Date.now() },
          timestamp: Date.now(),
        });
      } else {
        // Safe evaluation
        const res = new Function(`return (${cmd})`)();
        addConsoleLog({
          thread: 'AppService',
          level: 'info',
          message: `< ${typeof res === 'object' ? JSON.stringify(res) : String(res)}`,
          data: typeof res === 'object' ? res : undefined,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      addConsoleLog({
        thread: 'AppService',
        level: 'error',
        message: `Evaluation Error: ${err.message}`,
        timestamp: Date.now(),
      });
    }

    setCommandInput('');
  };

  const filteredLogs = logs.filter((log: any) => {
    const thread = log.thread || log.source || 'AppService';
    if (threadFilter !== 'all' && thread !== threadFilter) return false;
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchMsg = (log.message || '').toLowerCase().includes(q);
      const matchData = log.data ? JSON.stringify(log.data).toLowerCase().includes(q) : false;
      if (!matchMsg && !matchData) return false;
    }
    return true;
  });

  const errorCount = logs.filter((l: any) => l.level === 'error').length;
  const warnCount = logs.filter((l: any) => l.level === 'warn').length;
  const infoCount = logs.filter((l: any) => l.level === 'info' || l.level === 'log').length;

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-neutral-950" data-testid="unified-console-panel">
      {/* Top Filter & Action Bar */}
      <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-neutral-300 shrink-0 bg-neutral-900/40">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80">
            <Search className="w-3 h-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter console..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white focus:outline-none w-36 text-[11px] placeholder:text-neutral-500"
            />
          </div>

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={() => setLevelFilter('all')}
              title="Filter All"
              className={`px-2 py-0.5 rounded transition-colors ${
                levelFilter === 'all'
                  ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/50'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setLevelFilter('error')}
              title="Filter Errors"
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                levelFilter === 'error'
                  ? 'bg-rose-600/30 text-rose-300 font-bold border border-rose-500/50'
                  : 'text-neutral-400 hover:text-rose-400'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>{errorCount}</span>
            </button>
            <button
              onClick={() => setLevelFilter('warn')}
              title="Filter Warnings"
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                levelFilter === 'warn'
                  ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/50'
                  : 'text-neutral-400 hover:text-amber-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>{warnCount}</span>
            </button>
            <button
              onClick={() => setLevelFilter('info')}
              title="Filter Info"
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                levelFilter === 'info'
                  ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/50'
                  : 'text-neutral-400 hover:text-emerald-400'
              }`}
            >
              <Info className="w-3 h-3 text-blue-400" />
              <span>{infoCount}</span>
            </button>
          </div>

          {/* Thread Filter Selector */}
          <select
            value={threadFilter}
            onChange={(e) => setThreadFilter(e.target.value)}
            className="bg-neutral-900 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700/80 text-[10px] focus:outline-none"
          >
            <option value="all">All Threads</option>
            <option value="AppService">AppService (Worker)</option>
            <option value="AppView">AppView (DOM)</option>
            <option value="GoatHost">GoatHost (Native)</option>
            <option value="System">System</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded transition-colors flex items-center gap-1 text-[10px] ${
              autoScroll ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 text-[10px]"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Log Output Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-neutral-600 text-xs">
            Console log stream is empty.
          </div>
        ) : (
          filteredLogs.map((log: any, idx: number) => {
            const thread = log.thread || log.source || 'AppService';
            const logId = log.id || `log-${idx}-${log.timestamp}`;
            const isExpanded = expandedLogIds[logId] ?? false;

            // Thread badge style
            let threadBadge = 'bg-blue-950/70 text-blue-300 border-blue-800/60';
            if (thread === 'AppView') threadBadge = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
            if (thread === 'GoatHost') threadBadge = 'bg-purple-950/70 text-purple-300 border-purple-800/60';
            if (thread === 'System') threadBadge = 'bg-neutral-800 text-neutral-300 border-neutral-700';

            // Message text color
            let textColor = 'text-neutral-200';
            let rowBg = 'hover:bg-neutral-900/50';
            if (log.level === 'warn') {
              textColor = 'text-amber-300';
              rowBg = 'bg-amber-950/10 hover:bg-amber-950/20';
            } else if (log.level === 'error') {
              textColor = 'text-rose-400 font-semibold';
              rowBg = 'bg-rose-950/15 hover:bg-rose-950/25';
            }

            return (
              <div
                key={logId}
                className={`py-1 px-1.5 rounded transition-colors border-b border-neutral-900/80 group ${rowBg}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-neutral-500 text-[10px] select-none shrink-0 pt-0.5">
                    {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                  </span>

                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono shrink-0 ${threadBadge}`}>
                    [{thread}]
                  </span>

                  <div className="flex-1 break-all text-[11px] flex items-baseline gap-1">
                    <span className={textColor}>{log.message}</span>
                    {log.data !== undefined && (
                      <button
                        onClick={() => toggleExpand(logId)}
                        className="text-neutral-500 hover:text-neutral-300 p-0.5"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />}
                      </button>
                    )}
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyLog(logId, log.message)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-200 transition-opacity p-0.5"
                    title="Copy Log"
                  >
                    {copiedId === logId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded JSON Data */}
                {isExpanded && log.data !== undefined && (
                  <div className="mt-1 ml-16 p-2 bg-black/60 rounded border border-neutral-800 text-[10px] text-neutral-300 overflow-x-auto">
                    <pre>{typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Command Prompt (REPL) */}
      <form
        onSubmit={handleCommandSubmit}
        className="h-8 border-t border-neutral-800 px-3 flex items-center gap-2 bg-neutral-900/60 shrink-0"
      >
        <span className="text-blue-400 font-bold text-xs">&gt;</span>
        <input
          type="text"
          placeholder="Evaluate JavaScript expression or bridge call..."
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          className="flex-1 bg-transparent text-white focus:outline-none text-[11px] placeholder:text-neutral-600 font-mono"
        />
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="p-1 text-neutral-500 hover:text-blue-400 disabled:opacity-30"
          title="Run Command"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
