/**
 * @goat/devtools - Debugger Zustand Slice
 * Central state management for Multi-Lane Debugger:
 * - Elements / DOM Inspector
 * - Unified Console (multi-thread log streaming)
 * - Bridge Waterfall (IPC telemetry & latency tracking)
 * - Sandboxed KV Storage, SQLite Database & FileSystem
 */

import type { StateCreator } from 'zustand';
import type { DevToolsStore } from '../types/index.ts';
import type {
  LogEntry,
  WaterfallSpan,
  StorageItem,
  SqliteTable,
  DomNodeInfo,
} from '../types/debugger.ts';
import { mockState } from '@goat/bridge-mock';

export interface DebuggerSliceState {
  logs: LogEntry[];
  consoleLogs: LogEntry[];
  waterfallSpans: WaterfallSpan[];
  bridgeTraces: any[];
  storageItems: StorageItem[];
  storageData: {
    kvStore: Record<string, any>;
    sqliteTables: Record<string, any[]>;
    fsTree: Record<string, any>;
  };
  sqliteTables: SqliteTable[];
  selectedDomNodeId: string | null;
  selectedNodeId: string | null;
  selectedTraceId: string | null;
  hoveredDomNodeId: string | null;
  hoveredNodeId: string | null;
  domTree: DomNodeInfo | any | null;
  vdomTree: any;
  domElements: {
    vdomTree: any;
    domTree: any;
    selectedNodeId: string | null;
    hoveredNodeId: string | null;
    computedStyles: Record<string, string>;
  };
}

export interface DebuggerSliceActions {
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  addConsoleLog: (log: any) => void;
  clearLogs: () => void;
  clearConsoleLogs: () => void;
  addWaterfallSpan: (span: Omit<WaterfallSpan, 'id' | 'startTime'> & { id?: string; startTime?: number }) => void;
  addBridgeTrace: (trace: any) => void;
  updateBridgeTrace: (id: string, update: any) => void;
  updateWaterfallSpan: (callId: string, update: Partial<WaterfallSpan>) => void;
  clearWaterfall: () => void;
  clearBridgeTraces: () => void;
  setSelectedTraceId: (id: string | null) => void;
  setStorageItems: (items: StorageItem[]) => void;
  setStorageItem: (key: string, value: string, type?: 'local' | 'secure' | 'cookie') => void;
  setStorageKv: (key: string, value: any) => void;
  deleteStorageKv: (key: string) => void;
  clearStorageKv: () => void;
  removeStorageItem: (key: string) => void;
  clearStorage: () => void;
  setSqliteTables: (tables: SqliteTable[] | any) => void;
  setSqliteTableData: (table: string, rows: any[]) => void;
  setFsTree: (fsTree: Record<string, any>) => void;
  setFsItem: (dirPath: string, file: any) => void;
  deleteFsItem: (dirPath: string, fileName: string) => void;
  setSelectedDomNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredDomNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setDomTree: (tree: DomNodeInfo | any | null) => void;
  setVdomTree: (tree: DomNodeInfo | any | null) => void;
  setComputedStyles: (styles: Record<string, string>) => void;
}

export type DebuggerSlice = DebuggerSliceState & DebuggerSliceActions;

let logSeq = 0;
let spanSeq = 0;

export const createDebuggerSlice: StateCreator<DevToolsStore, [], [], DebuggerSlice> = (set, get) => {
  const initialLogs: LogEntry[] = [
    {
      id: 'log-init-1',
      timestamp: Date.now() - 300,
      source: 'System',
      thread: 'System',
      level: 'info',
      message: 'Goat DevTools Studio Engine Initialized.',
    },
    {
      id: 'log-init-2',
      timestamp: Date.now() - 100,
      source: 'AppService',
      thread: 'AppService',
      level: 'info',
      message: 'Dual-Thread AppService worker mounted.',
    },
  ];

  const initialKvStore: Record<string, any> = {
    app_theme: 'dark',
    session_id: 'sess_98231_goat',
    user_settings: { autoPlay: true, volume: 80 },
  };

  const initialStorageItems: StorageItem[] = Object.entries(initialKvStore).map(([key, val]) => {
    const strVal = typeof val === 'string' ? val : JSON.stringify(val);
    return {
      key,
      value: strVal,
      type: key.includes('session') ? 'secure' : 'local',
      sizeBytes: typeof Blob !== 'undefined' ? new Blob([key, strVal]).size : key.length + strVal.length,
      updatedAt: Date.now(),
    };
  });

  const initialSqliteTables: SqliteTable[] = [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'username', type: 'TEXT' },
        { name: 'role', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
        { name: 'balance', type: 'REAL' },
      ],
      rows: [
        { id: 1, username: 'goat_admin', role: 'developer', email: 'admin@goat.dev', balance: 1250.0 },
        { id: 2, username: 'tester_alice', role: 'qa', email: 'alice@test.org', balance: 95.5 },
        { id: 3, username: 'user_bob', role: 'user', email: 'bob@example.com', balance: 42.0 },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'order_id', type: 'TEXT', primaryKey: true },
        { name: 'user_id', type: 'INTEGER' },
        { name: 'product', type: 'TEXT' },
        { name: 'amount', type: 'REAL' },
        { name: 'status', type: 'TEXT' },
      ],
      rows: [
        { order_id: 'ord_1001', user_id: 1, product: 'DevTools Pro License', amount: 99.0, status: 'COMPLETED' },
        { order_id: 'ord_1002', user_id: 2, product: 'Mini-App Fast Pass', amount: 19.99, status: 'COMPLETED' },
        { order_id: 'ord_1003', user_id: 3, product: 'Cloud Storage 10GB', amount: 4.99, status: 'PENDING' },
      ],
    },
  ];

  const initialSqliteTablesMap: Record<string, any[]> = {};
  for (const table of initialSqliteTables) {
    initialSqliteTablesMap[table.name] = table.rows;
  }

  const initialFsTree: Record<string, any> = {
    '/data/user/files': [
      { name: 'avatar.png', type: 'image/png', size: 24576, mtime: Date.now() - 3600000 },
      { name: 'app_config.json', type: 'application/json', size: 512, mtime: Date.now() - 60000, content: '{\n  "theme": "dark",\n  "debug": true\n}' },
    ],
    '/data/user/storage': [
      { name: 'cache_manifest.json', type: 'application/json', size: 1240, mtime: Date.now() - 7200000, content: '{\n  "version": "1.0.0",\n  "cacheKey": "v1_release"\n}' },
      { name: 'user_settings.sqlite', type: 'application/x-sqlite3', size: 65536, mtime: Date.now() - 1800000 },
    ],
    '/data/user/temp': [
      { name: 'upload_temp_01.tmp', type: 'application/octet-stream', size: 8192, mtime: Date.now() - 300000 },
    ],
  };

  // Sync initial seed data with bridge-mock if available
  try {
    if (mockState) {
      const appStorage = mockState.getAppStorage();
      for (const [k, v] of Object.entries(initialKvStore)) {
        appStorage.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    }
  } catch {
    // Ignore in non-mock environments
  }

  return {
    logs: initialLogs,
    consoleLogs: initialLogs,
    waterfallSpans: [],
    bridgeTraces: [],
    selectedTraceId: null,
    storageItems: initialStorageItems,
    storageData: {
      kvStore: initialKvStore,
      sqliteTables: initialSqliteTablesMap,
      fsTree: initialFsTree,
    },
    sqliteTables: initialSqliteTables,
    selectedDomNodeId: null,
    selectedNodeId: null,
    hoveredDomNodeId: null,
    hoveredNodeId: null,
    domTree: null,
    vdomTree: null,
    domElements: {
      vdomTree: null,
      domTree: null,
      selectedNodeId: null,
      hoveredNodeId: null,
      computedStyles: {},
    },

    addLog: (log) => {
      const thread = (log.thread || log.source || 'AppService') as any;
      const entry: LogEntry = {
        id: log.id || `log-${Date.now()}-${++logSeq}`,
        timestamp: log.timestamp || Date.now(),
        source: thread,
        thread: thread,
        level: log.level || 'info',
        message: log.message,
        data: log.data,
      };
      set((state) => {
        const next = [...(state.logs || []).slice(-9999), entry];
        return { logs: next, consoleLogs: next };
      });
    },

    addConsoleLog: (log) => {
      const thread = (log.thread || log.source || 'AppService') as any;
      const entry: LogEntry = {
        id: log.id || `log-${Date.now()}-${++logSeq}`,
        timestamp: log.timestamp || Date.now(),
        source: thread,
        thread: thread,
        level: log.level || 'info',
        message: log.message || '',
        data: log.data,
      };
      set((state) => {
        const next = [...(state.consoleLogs || []).slice(-9999), entry];
        return { logs: next, consoleLogs: next };
      });
    },

    clearLogs: () => {
      set({ logs: [], consoleLogs: [] });
    },

    clearConsoleLogs: () => {
      set({ logs: [], consoleLogs: [] });
    },

    addWaterfallSpan: (span) => {
      const entry: WaterfallSpan = {
        id: span.id || `span-${Date.now()}-${++spanSeq}`,
        callId: span.callId || `call-${Date.now()}`,
        action: span.action,
        domain: span.domain || 'Core',
        threadLane: span.threadLane || 'AppService',
        status: span.status || 'pending',
        startTime: span.startTime || Date.now(),
        payload: span.payload,
        reply: span.reply,
        error: span.error,
        durationMs: span.durationMs ?? 0,
      };
      set((state) => {
        const next = [...(state.waterfallSpans || []).slice(-499), entry];
        return { waterfallSpans: next, bridgeTraces: next };
      });
    },

    addBridgeTrace: (trace) => {
      const entry: WaterfallSpan = {
        id: trace.id || `span-${Date.now()}-${++spanSeq}`,
        callId: trace.callId || `call-${Date.now()}`,
        action: trace.action || 'BRIDGE_ACTION',
        domain: trace.domain || 'Core',
        threadLane: trace.threadLane || 'AppService',
        status: trace.status || 'success',
        startTime: trace.startTime || trace.timestamp || Date.now(),
        durationMs: trace.durationMs ?? 0,
        payload: trace.payload,
        reply: trace.response || trace.reply,
      };
      set((state) => {
        const next = [...(state.bridgeTraces || []).slice(-499), entry];
        return { waterfallSpans: next, bridgeTraces: next };
      });
    },

    updateWaterfallSpan: (callId, update) => {
      set((state) => {
        const updated = (state.waterfallSpans || []).map((s) => {
          if (s.callId === callId || s.id === callId) {
            const endTime = update.endTime || Date.now();
            const durationMs = update.durationMs ?? (endTime - s.startTime);
            return { ...s, ...update, endTime, durationMs };
          }
          return s;
        });
        return { waterfallSpans: updated, bridgeTraces: updated };
      });
    },

    updateBridgeTrace: (id, update) => {
      set((state) => {
        const updated = (state.bridgeTraces || []).map((s) => {
          if (s.id === id || s.callId === id) {
            return { ...s, ...update };
          }
          return s;
        });
        return { waterfallSpans: updated, bridgeTraces: updated };
      });
    },

    clearWaterfall: () => {
      set({ waterfallSpans: [], bridgeTraces: [] });
    },

    clearBridgeTraces: () => {
      set({ waterfallSpans: [], bridgeTraces: [] });
    },

    setSelectedTraceId: (id) => {
      set({ selectedTraceId: id });
    },

    setStorageItems: (items) => {
      const kvStore: Record<string, any> = {};
      for (const item of items) {
        kvStore[item.key] = item.value;
      }
      set((state) => ({
        storageItems: items,
        storageData: { ...state.storageData, kvStore },
      }));
    },

    setStorageItem: (key, value, type = 'local') => {
      set((state) => {
        const currentItems = state.storageItems || [];
        const existingIdx = currentItems.findIndex((i) => i.key === key);
        const item: StorageItem = {
          key,
          value,
          type,
          sizeBytes: typeof Blob !== 'undefined' ? new Blob([key, value]).size : key.length + value.length,
          updatedAt: Date.now(),
        };

        const nextItems =
          existingIdx >= 0
            ? currentItems.map((it, idx) => (idx === existingIdx ? item : it))
            : [...currentItems, item];

        return {
          storageItems: nextItems,
          storageData: {
            ...state.storageData,
            kvStore: { ...state.storageData.kvStore, [key]: value },
          },
        };
      });

      try {
        if (mockState) {
          mockState.getAppStorage().set(key, value);
        }
      } catch {
        // Ignore in tests
      }
    },

    setStorageKv: (key, value) => {
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      set((state) => {
        const item: StorageItem = {
          key,
          value: strVal,
          type: 'local',
          sizeBytes: typeof Blob !== 'undefined' ? new Blob([key, strVal]).size : key.length + strVal.length,
          updatedAt: Date.now(),
        };
        const currentItems = state.storageItems || [];
        const existingIdx = currentItems.findIndex((i) => i.key === key);
        const nextItems =
          existingIdx >= 0
            ? currentItems.map((it, idx) => (idx === existingIdx ? item : it))
            : [...currentItems, item];

        return {
          storageItems: nextItems,
          storageData: {
            ...state.storageData,
            kvStore: { ...state.storageData.kvStore, [key]: value },
          },
        };
      });

      try {
        if (mockState) {
          mockState.getAppStorage().set(key, strVal);
        }
      } catch {
        // Ignore in tests
      }
    },

    deleteStorageKv: (key) => {
      set((state) => {
        const nextKv = { ...state.storageData.kvStore };
        delete nextKv[key];
        return {
          storageItems: (state.storageItems || []).filter((i) => i.key !== key),
          storageData: { ...state.storageData, kvStore: nextKv },
        };
      });

      try {
        if (mockState) {
          mockState.getAppStorage().delete(key);
        }
      } catch {
        // Ignore in tests
      }
    },

    clearStorageKv: () => {
      set((state) => ({
        storageItems: [],
        storageData: { ...state.storageData, kvStore: {} },
      }));

      try {
        if (mockState) {
          mockState.getAppStorage().clear();
        }
      } catch {
        // Ignore in tests
      }
    },

    removeStorageItem: (key) => {
      get().deleteStorageKv(key);
    },

    clearStorage: () => {
      get().clearStorageKv();
    },

    setSqliteTables: (tables: any) => {
      let sqliteTablesDict: Record<string, any[]> = {};
      if (Array.isArray(tables)) {
        for (const t of tables) {
          sqliteTablesDict[t.name] = t.rows || [];
        }
      } else if (tables && typeof tables === 'object') {
        sqliteTablesDict = tables;
      }
      set((state) => ({
        sqliteTables: Array.isArray(tables) ? tables : state.sqliteTables,
        storageData: {
          ...state.storageData,
          sqliteTables: sqliteTablesDict,
        },
      }));
    },

    setSqliteTableData: (table, rows) => {
      set((state) => {
        const nextDict = { ...state.storageData.sqliteTables, [table]: rows };
        const nextTables = (state.sqliteTables || []).map((t) =>
          t.name === table ? { ...t, rows } : t
        );
        return {
          sqliteTables: nextTables,
          storageData: {
            ...state.storageData,
            sqliteTables: nextDict,
          },
        };
      });
    },

    setFsTree: (fsTree: Record<string, any>) => {
      set((state) => ({
        storageData: {
          ...state.storageData,
          fsTree,
        },
      }));
    },

    setFsItem: (dirPath: string, file: any) => {
      set((state) => {
        const currentFiles = state.storageData.fsTree[dirPath] || [];
        const existingIdx = currentFiles.findIndex((f: any) => f.name === file.name);
        const nextFiles =
          existingIdx >= 0
            ? currentFiles.map((f: any, idx: number) => (idx === existingIdx ? file : f))
            : [...currentFiles, file];

        return {
          storageData: {
            ...state.storageData,
            fsTree: {
              ...state.storageData.fsTree,
              [dirPath]: nextFiles,
            },
          },
        };
      });
    },

    deleteFsItem: (dirPath: string, fileName: string) => {
      set((state) => {
        const currentFiles = state.storageData.fsTree[dirPath] || [];
        const nextFiles = currentFiles.filter((f: any) => f.name !== fileName);
        return {
          storageData: {
            ...state.storageData,
            fsTree: {
              ...state.storageData.fsTree,
              [dirPath]: nextFiles,
            },
          },
        };
      });
    },

    setSelectedDomNodeId: (id) => {
      set((state) => ({
        selectedDomNodeId: id,
        selectedNodeId: id,
        domElements: { ...state.domElements, selectedNodeId: id },
      }));
    },

    setSelectedNodeId: (id) => {
      set((state) => ({
        selectedDomNodeId: id,
        selectedNodeId: id,
        domElements: { ...state.domElements, selectedNodeId: id },
      }));
    },

    setHoveredDomNodeId: (id) => {
      set((state) => ({
        hoveredDomNodeId: id,
        hoveredNodeId: id,
        domElements: { ...state.domElements, hoveredNodeId: id },
      }));
    },

    setHoveredNodeId: (id) => {
      set((state) => ({
        hoveredDomNodeId: id,
        hoveredNodeId: id,
        domElements: { ...state.domElements, hoveredNodeId: id },
      }));
    },

    setDomTree: (tree) => {
      set((state) => ({
        domTree: tree,
        vdomTree: tree,
        domElements: { ...state.domElements, domTree: tree, vdomTree: tree },
      }));
    },

    setVdomTree: (tree) => {
      set((state) => ({
        domTree: tree,
        vdomTree: tree,
        domElements: { ...state.domElements, domTree: tree, vdomTree: tree },
      }));
    },

    setComputedStyles: (styles) => {
      set((state) => ({
        domElements: { ...state.domElements, computedStyles: styles },
      }));
    },
  };
};
