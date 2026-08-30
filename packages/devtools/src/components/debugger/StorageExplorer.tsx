/**
 * @goat/devtools - Sandboxed Key-Value Storage Explorer Component
 * Visual CRUD manager for Mini-App Sandboxed Key-Value Storage,
 * live key filtering, JSON & primitive value editing, storage quota calculator, and export/import.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Key,
  HardDrive,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Copy,
  Check,
  RefreshCw,
  Download,
  Upload,
  Database,
  FolderTree,
} from 'lucide-react';
import type { StorageItem } from '../../types/debugger.ts';

export const StorageExplorer: React.FC = () => {
  const {
    storageData = { kvStore: {}, sqliteTables: {}, fsTree: {} },
    storageItems = [],
    setStorageKv,
    deleteStorageKv,
    clearStorageKv,
  } = useDevToolsStore();

  const [kvSearch, setKvSearch] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newType, setNewType] = useState<'string' | 'number' | 'boolean' | 'json'>('string');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const kvEntries = Object.entries(storageData.kvStore || {});

  // Calculate storage usage
  const totalBytes = kvEntries.reduce((acc, [k, v]) => {
    const strVal = typeof v === 'string' ? v : JSON.stringify(v);
    return acc + k.length + (strVal ? strVal.length : 0);
  }, 0);
  const quotaBytes = 10 * 1024 * 1024; // 10 MB simulated quota
  const quotaPercent = Math.min(100, Math.round((totalBytes / quotaBytes) * 1000) / 10);

  const handleAddKv = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKey.trim();
    if (!key) return;

    let parsedVal: any = newVal;
    if (newType === 'number') {
      parsedVal = Number(newVal);
    } else if (newType === 'boolean') {
      parsedVal = newVal.toLowerCase() === 'true';
    } else if (newType === 'json') {
      try {
        parsedVal = JSON.parse(newVal);
      } catch {
        parsedVal = newVal;
      }
    }

    setStorageKv(key, parsedVal);
    setNewKey('');
    setNewVal('');
  };

  const handleSaveEdit = (key: string) => {
    let parsed: any = editingValue;
    try {
      parsed = JSON.parse(editingValue);
    } catch {
      parsed = editingValue;
    }
    setStorageKv(key, parsed);
    setEditingKey(null);
  };

  const copyValue = (key: string, val: any) => {
    if (navigator.clipboard) {
      const text = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  const exportStorage = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(storageData.kvStore, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'goat_storage_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredKv = kvEntries.filter(([k, v]) => {
    if (!kvSearch) return true;
    const q = kvSearch.toLowerCase();
    return k.toLowerCase().includes(q) || JSON.stringify(v).toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-neutral-950" data-testid="storage-explorer-panel">
      {/* Top Action & Quota Header */}
      <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-neutral-300 shrink-0 bg-neutral-900/40">
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700/80">
            <Search className="w-3 h-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search keys or values..."
              value={kvSearch}
              onChange={(e) => setKvSearch(e.target.value)}
              className="bg-transparent text-white focus:outline-none w-44 text-[11px] placeholder:text-neutral-500"
            />
          </div>

          {/* Quota Gauge */}
          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <span>Storage: {(totalBytes / 1024).toFixed(2)} KB / 10 MB</span>
            <div className="w-20 bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full"
                style={{ width: `${Math.max(4, quotaPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportStorage}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 text-[10px]"
            title="Export Storage as JSON"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          <button
            onClick={clearStorageKv}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors flex items-center gap-1 text-[10px]"
            title="Clear All Storage"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Storage</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-3 overflow-hidden p-3">
        {/* Left: Key-Value Table / List */}
        <div className="flex-1 flex flex-col space-y-1.5 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredKv.length === 0 ? (
              <div className="p-8 text-center text-neutral-600 text-xs">
                No keys found in sandbox storage. Use the form on the right to add a key.
              </div>
            ) : (
              filteredKv.map(([k, v]) => {
                const isEditing = editingKey === k;
                const strVal = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
                const valType = Array.isArray(v) ? 'array' : typeof v;

                return (
                  <div
                    key={k}
                    data-testid={`storage-item-${k}`}
                    className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80 flex flex-col space-y-1.5 hover:border-neutral-700 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-bold text-blue-400 text-xs truncate">{k}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 uppercase font-mono">
                          {valType}
                        </span>
                        <span className="text-[9px] text-neutral-500 font-mono">
                          {k.length + strVal.length} B
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyValue(k, v)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-200 transition-colors"
                          title="Copy Value"
                        >
                          {copiedKey === k ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => {
                            if (isEditing) {
                              setEditingKey(null);
                            } else {
                              setEditingKey(k);
                              setEditingValue(typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
                            }
                          }}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-blue-400 transition-colors"
                          title="Edit Value"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteStorageKv(k)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-rose-400 transition-colors"
                          title="Delete Key"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1 pt-1 border-t border-neutral-800">
                        <textarea
                          rows={3}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-full bg-neutral-950 text-neutral-200 p-1.5 rounded border border-blue-500/80 text-[11px] font-mono focus:outline-none"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-[10px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(k)}
                            className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 font-bold text-[10px] flex items-center gap-1"
                          >
                            <Save className="w-2.5 h-2.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-300 font-mono break-all max-h-20 overflow-y-auto bg-neutral-950/60 p-1.5 rounded border border-neutral-900">
                        {strVal}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Add Key-Value Form */}
        <div className="w-76 bg-neutral-900/40 p-3 rounded-lg border border-neutral-800 flex flex-col space-y-3 shrink-0">
          <div className="font-bold text-neutral-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>Add Storage Item</span>
          </div>

          <form onSubmit={handleAddKv} className="space-y-2.5">
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Key Name</label>
              <input
                type="text"
                placeholder="e.g. user_session_token"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full bg-neutral-950 text-neutral-200 px-2 py-1.5 rounded border border-neutral-700 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full bg-neutral-950 text-neutral-200 px-2 py-1.5 rounded border border-neutral-700 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON Object / Array</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Value</label>
              <textarea
                rows={4}
                placeholder={newType === 'json' ? '{\n  "role": "admin"\n}' : 'Value content...'}
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                className="w-full bg-neutral-950 text-neutral-200 p-2 rounded border border-neutral-700 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={!newKey.trim()}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save to Sandbox Storage</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
