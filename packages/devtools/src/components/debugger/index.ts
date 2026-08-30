/**
 * @goat/devtools - Debugger & Storage Components Export
 * Full suite of Multi-Lane Debugger tools with clean alias exports.
 */

export * from './ElementsInspector.tsx';
export { ElementsInspector as DomInspector } from './ElementsInspector.tsx';

export * from './UnifiedConsole.tsx';

export * from './BridgeWaterfall.tsx';
export { BridgeWaterfall as IpcWaterfall } from './BridgeWaterfall.tsx';

export * from './StorageExplorer.tsx';
export { StorageExplorer as KvStorageExplorer } from './StorageExplorer.tsx';

export * from './SqliteViewer.tsx';
export { SqliteViewer as SqliteExplorer } from './SqliteViewer.tsx';

export * from './FileSystemBrowser.tsx';
export { FileSystemBrowser as SandboxedFsBrowser } from './FileSystemBrowser.tsx';

export * from './DebuggerPanel.tsx';
export { DebuggerPanel as MultiLaneDebugger } from './DebuggerPanel.tsx';
