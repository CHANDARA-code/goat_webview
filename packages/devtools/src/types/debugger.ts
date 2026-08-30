/**
 * @goat/devtools - Debugger Type Definitions
 */

export type LogSource = "AppService" | "AppView" | "GoatHost" | "System";
export type ThreadType = "AppService" | "AppView" | "GoatHost" | "System";
export type LogLevel = "debug" | "info" | "warn" | "error" | "log";

export interface LogEntry {
  id: string;
  timestamp: number;
  source: LogSource;
  thread?: ThreadType;
  level: LogLevel;
  message: string;
  data?: any;
}

export interface ConsoleLogEntry {
  id?: string;
  thread: ThreadType;
  level: LogLevel;
  message: string;
  timestamp?: number;
  data?: any;
}

export interface WaterfallSpan {
  id: string;
  callId: string;
  action: string;
  domain?: string;
  threadLane: "AppService" | "AppView" | "GoatHost";
  direction?: "worker-to-host" | "host-to-worker" | "bridge";
  startTime: number;
  endTime?: number;
  durationMs?: number;
  payload?: any;
  reply?: any;
  response?: any;
  error?: string;
  status: "pending" | "success" | "error";
  timestamp?: number;
}

export interface BridgeTraceEntry {
  id?: string;
  action: string;
  domain: string;
  direction?: "worker-to-host" | "host-to-worker" | "bridge";
  payload?: any;
  response?: any;
  durationMs: number;
  status: "pending" | "success" | "error";
  timestamp?: number;
}

export interface StorageItem {
  key: string;
  value: string;
  type: "local" | "secure" | "cookie";
  sizeBytes: number;
  updatedAt: number;
}

export interface SqliteColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
}

export interface SqliteTable {
  name: string;
  columns: SqliteColumn[];
  rows: Array<Record<string, any>>;
}

export interface DomNodeInfo {
  vnodeId: string;
  tag: string;
  classes?: string[];
  attributes: Record<string, string>;
  textContent?: string;
  computedStyles?: Record<string, string>;
  bounds?: { x: number; y: number; width: number; height: number };
  children?: DomNodeInfo[];
}

export interface DebuggerSlice {
  logs: LogEntry[];
  consoleLogs: ConsoleLogEntry[] | LogEntry[];
  waterfallSpans: WaterfallSpan[];
  bridgeTraces: BridgeTraceEntry[] | any[];
  selectedTraceId: string | null;
  storageItems: StorageItem[];
  storageData: {
    kvStore: Record<string, any>;
    sqliteTables: Record<string, any[]>;
    fsTree?: Record<string, any>;
  };
  sqliteTables: SqliteTable[];
  selectedDomNodeId: string | null;
  selectedNodeId: string | null;
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

  addLog: (
    log: Omit<LogEntry, "id" | "timestamp"> &
      Partial<Pick<LogEntry, "id" | "timestamp">>,
  ) => void;
  addConsoleLog: (log: ConsoleLogEntry | any) => void;
  clearLogs: () => void;
  clearConsoleLogs: () => void;
  addWaterfallSpan: (
    span: Omit<WaterfallSpan, "id" | "startTime"> & {
      id?: string;
      startTime?: number;
    },
  ) => void;
  addBridgeTrace: (trace: BridgeTraceEntry | any) => void;
  updateBridgeTrace: (id: string, update: any) => void;
  updateWaterfallSpan: (callId: string, update: Partial<WaterfallSpan>) => void;
  clearWaterfall: () => void;
  clearBridgeTraces: () => void;
  setSelectedTraceId: (id: string | null) => void;
  setStorageItems: (items: StorageItem[]) => void;
  setStorageItem: (
    key: string,
    value: string,
    type?: "local" | "secure" | "cookie",
  ) => void;
  setStorageKv: (key: string, value: any) => void;
  deleteStorageKv: (key: string) => void;
  clearStorageKv: () => void;
  removeStorageItem: (key: string) => void;
  clearStorage: () => void;
  setSqliteTables: (tables: SqliteTable[] | any) => void;
  setSqliteTableData: (table: string, rows: any[]) => void;
  setFsTree?: (fsTree: Record<string, any>) => void;
  setFsItem?: (dirPath: string, file: any) => void;
  deleteFsItem?: (dirPath: string, fileName: string) => void;
  setSelectedDomNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredDomNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setDomTree: (tree: DomNodeInfo | any | null) => void;
  setVdomTree: (tree: DomNodeInfo | any | null) => void;
  setComputedStyles: (styles: Record<string, string>) => void;
}
