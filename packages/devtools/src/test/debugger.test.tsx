/**
 * @goat/devtools - Multi-Lane Debugger & Storage Test Suite
 * Comprehensive component and unit tests covering:
 * - ElementsInspector / DomInspector
 * - UnifiedConsole (Multi-Thread Log Aggregator)
 * - BridgeWaterfall (IPC Latency & Trace Inspector)
 * - StorageExplorer (Sandboxed KV Storage CRUD)
 * - SqliteViewer (SQLite Schemas, Rows & SQL Runner)
 * - FileSystemBrowser (Sandboxed FS Tree & Previewer)
 * - DebuggerPanel (Master 6-Tab Bottom Panel)
 * - debuggerSlice Zustand Store
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDevToolsStore } from '../store/index.ts';

import {
  ElementsInspector,
  DomInspector,
  UnifiedConsole,
  BridgeWaterfall,
  IpcWaterfall,
  StorageExplorer,
  KvStorageExplorer,
  SqliteViewer,
  SqliteExplorer,
  FileSystemBrowser,
  SandboxedFsBrowser,
  DebuggerPanel,
  MultiLaneDebugger,
} from '../components/debugger/index.ts';

describe('Milestone 4: Multi-Lane Debugger & Storage Suite', () => {
  beforeEach(() => {
    const store = useDevToolsStore.getState();
    store.clearLogs?.();
    store.clearConsoleLogs?.();
    store.clearWaterfall?.();
    store.clearBridgeTraces?.();
    store.clearStorageKv?.();

    // Reset default mock state in store
    store.setStorageKv('user_id', '9988');
    store.setStorageKv('theme', 'dark');

    store.setVdomTree({
      vnodeId: 'root',
      tag: 'page',
      classes: ['root-view'],
      attributes: { id: 'root' },
      computedStyles: {
        display: 'flex',
        flexDirection: 'column',
        width: '393px',
        height: '852px',
        padding: '16px',
        backgroundColor: '#09090b',
      },
      bounds: { x: 0, y: 0, width: 393, height: 852 },
      children: [
        {
          vnodeId: 'header-1',
          tag: 'view',
          classes: ['header-bar'],
          attributes: { id: 'header-1' },
          computedStyles: {
            height: '60px',
            backgroundColor: '#18181b',
          },
          bounds: { x: 0, y: 0, width: 393, height: 60 },
          children: [
            {
              vnodeId: 'title-1',
              tag: 'text',
              textContent: 'Goat Mini-App Studio',
              attributes: { id: 'title-1' },
              computedStyles: { fontSize: '18px', color: '#ffffff' },
              bounds: { x: 16, y: 16, width: 200, height: 28 },
            },
          ],
        },
        {
          vnodeId: 'btn-submit',
          tag: 'button',
          textContent: 'Submit Action',
          attributes: { id: 'btn-submit', type: 'button' },
          computedStyles: { backgroundColor: '#2563eb', color: '#ffffff' },
          bounds: { x: 16, y: 80, width: 361, height: 44 },
        },
      ],
    });

    store.setComputedStyles({
      display: 'flex',
      flexDirection: 'column',
      width: '393px',
      height: '852px',
      padding: '16px',
      backgroundColor: '#09090b',
    });

    if (store.setSqliteTables) {
      store.setSqliteTables([
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'username', type: 'TEXT' },
            { name: 'role', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
          ],
          rows: [
            { id: 1, username: 'goat_admin', role: 'developer', email: 'admin@goat.dev' },
            { id: 2, username: 'tester_alice', role: 'qa', email: 'alice@test.org' },
          ],
        },
        {
          name: 'orders',
          columns: [
            { name: 'order_id', type: 'TEXT', primaryKey: true },
            { name: 'amount', type: 'REAL' },
          ],
          rows: [
            { order_id: 'ord_1', amount: 99.0 },
          ],
        },
      ]);
    }
  });

  // =========================================================================
  // 1. Elements & DOM Inspector Tests
  // =========================================================================
  describe('1. ElementsInspector Component', () => {
    it('renders DOM tree hierarchy with tags, classes, and text contents', () => {
      render(<ElementsInspector />);
      expect(screen.getByTestId('elements-inspector-panel')).toBeInTheDocument();
      expect(screen.getByText(/<page/)).toBeInTheDocument();
      expect(screen.getByText(/<button/)).toBeInTheDocument();
      expect(screen.getByText(/"Submit Action"/)).toBeInTheDocument();
    });

    it('supports selecting and hovering over DOM nodes and updates store', () => {
      render(<ElementsInspector />);
      const btnNode = screen.getByTestId('dom-node-btn-submit');
      expect(btnNode).toBeInTheDocument();

      // Click node to select
      fireEvent.click(btnNode);
      expect(useDevToolsStore.getState().selectedDomNodeId).toBe('btn-submit');
      expect(useDevToolsStore.getState().domElements.selectedNodeId).toBe('btn-submit');

      // Mouse enter to hover
      fireEvent.mouseEnter(btnNode);
      expect(useDevToolsStore.getState().hoveredDomNodeId).toBe('btn-submit');
      expect(useDevToolsStore.getState().domElements.hoveredNodeId).toBe('btn-submit');

      // Mouse leave
      fireEvent.mouseLeave(btnNode);
      expect(useDevToolsStore.getState().hoveredDomNodeId).toBeNull();
    });

    it('displays computed styles and box model dimensions', () => {
      useDevToolsStore.getState().setSelectedDomNodeId('root');
      render(<ElementsInspector />);
      // Switch to Computed tab
      const computedTabBtn = screen.getByRole('button', { name: 'Computed' });
      fireEvent.click(computedTabBtn);

      expect(screen.getByText('padding:')).toBeInTheDocument();
      expect(screen.getByText('16px')).toBeInTheDocument();
      expect(screen.getByText('display:')).toBeInTheDocument();
      expect(screen.getByText('flex')).toBeInTheDocument();

      // Switch to Box Model tab
      const boxModelTabBtn = screen.getByRole('button', { name: 'Box Model' });
      fireEvent.click(boxModelTabBtn);
      expect(screen.getByText(/padding: 16px/)).toBeInTheDocument();
    });

    it('allows adding inline styles dynamically', () => {
      render(<ElementsInspector />);
      const propInput = screen.getByPlaceholderText('property');
      const valInput = screen.getByPlaceholderText('value');
      const submitBtn = screen.getByTitle('Add Style');

      fireEvent.change(propInput, { target: { value: 'opacity' } });
      fireEvent.change(valInput, { target: { value: '0.85' } });
      fireEvent.click(submitBtn);

      expect(useDevToolsStore.getState().domElements.computedStyles.opacity).toBe('0.85');
    });

    it('exports DomInspector alias correctly', () => {
      expect(DomInspector).toBe(ElementsInspector);
    });
  });

  // =========================================================================
  // 2. Unified Console Tests
  // =========================================================================
  describe('2. UnifiedConsole Component', () => {
    it('aggregates logs streaming from [AppService], [AppView], [GoatHost], and [System]', () => {
      const store = useDevToolsStore.getState();
      store.addConsoleLog({
        thread: 'AppService',
        level: 'log',
        message: 'Worker mounted and reactive state initialized',
      });
      store.addConsoleLog({
        thread: 'AppView',
        level: 'info',
        message: 'DOM tree diff applied 2 mutations',
      });
      store.addConsoleLog({
        thread: 'GoatHost',
        level: 'warn',
        message: 'Low memory warning from host',
      });
      store.addConsoleLog({
        thread: 'System',
        level: 'error',
        message: 'Bundle reload failed',
      });

      render(<UnifiedConsole />);
      expect(screen.getByTestId('unified-console-panel')).toBeInTheDocument();
      expect(screen.getByText(/\[AppService\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[AppView\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[GoatHost\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[System\]/)).toBeInTheDocument();

      expect(screen.getByText('Worker mounted and reactive state initialized')).toBeInTheDocument();
      expect(screen.getByText('DOM tree diff applied 2 mutations')).toBeInTheDocument();
    });

    it('filters logs by log level and thread origin', () => {
      const store = useDevToolsStore.getState();
      store.addConsoleLog({ thread: 'AppService', level: 'error', message: 'Fatal crash in worker' });
      store.addConsoleLog({ thread: 'AppView', level: 'info', message: 'Render finished' });

      render(<UnifiedConsole />);

      // Filter by error level
      const errorBtn = screen.getByTitle('Filter Errors');
      fireEvent.click(errorBtn);
      expect(screen.getByText('Fatal crash in worker')).toBeInTheDocument();
      expect(screen.queryByText('Render finished')).not.toBeInTheDocument();
    });

    it('clears console logs when clear button is clicked', () => {
      const store = useDevToolsStore.getState();
      store.addConsoleLog({ thread: 'AppService', level: 'log', message: 'Test message' });

      render(<UnifiedConsole />);
      expect(screen.getByText('Test message')).toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearBtn);

      expect(screen.getByText(/Console log stream is empty/i)).toBeInTheDocument();
      expect(useDevToolsStore.getState().consoleLogs.length).toBe(0);
    });

    it('evaluates REPL command expressions in console prompt', () => {
      render(<UnifiedConsole />);
      const input = screen.getByPlaceholderText(/Evaluate JavaScript expression/i);
      fireEvent.change(input, { target: { value: '2 + 3' } });
      fireEvent.submit(input.closest('form')!);

      expect(screen.getByText('> 2 + 3')).toBeInTheDocument();
      expect(screen.getByText('< 5')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Bridge IPC Waterfall Tests
  // =========================================================================
  describe('3. BridgeWaterfall Component', () => {
    it('renders chronological timeline of IPC traces with delta t latency', () => {
      const store = useDevToolsStore.getState();
      store.addBridgeTrace({
        id: 'trace-1',
        callId: 'call-101',
        action: 'STORAGE_GET',
        domain: 'Storage',
        durationMs: 4.2,
        status: 'success',
        payload: { key: 'user_id' },
        response: { value: '9988' },
        timestamp: Date.now(),
      });
      store.addBridgeTrace({
        id: 'trace-2',
        callId: 'call-102',
        action: 'GET_DEVICE_INFO',
        domain: 'Core',
        durationMs: 12.8,
        status: 'success',
        payload: {},
        response: { model: 'Pixel 9 Pro' },
        timestamp: Date.now(),
      });

      render(<BridgeWaterfall />);
      expect(screen.getByTestId('bridge-waterfall-panel')).toBeInTheDocument();
      expect(screen.getByText('STORAGE_GET')).toBeInTheDocument();
      expect(screen.getByText('GET_DEVICE_INFO')).toBeInTheDocument();
      expect(screen.getByText('4.2ms')).toBeInTheDocument();
      expect(screen.getByText('12.8ms')).toBeInTheDocument();
    });

    it('opens payload inspector drawer when a trace row is clicked', () => {
      const store = useDevToolsStore.getState();
      store.addBridgeTrace({
        id: 'trace-inspect',
        callId: 'call-inspect-1',
        action: 'API_REQUEST',
        domain: 'Network',
        durationMs: 48.5,
        status: 'success',
        payload: { url: 'https://api.goat.dev/data', method: 'GET' },
        response: { statusCode: 200, data: { ok: true } },
      });

      render(<BridgeWaterfall />);
      const traceRow = screen.getByTestId('trace-row-trace-inspect');
      fireEvent.click(traceRow);

      expect(screen.getByText('Trace: API_REQUEST')).toBeInTheDocument();
      expect(screen.getByText(/https:\/\/api.goat.dev\/data/)).toBeInTheDocument();
      expect(screen.getByText(/"statusCode": 200/)).toBeInTheDocument();
    });

    it('clears waterfall traces', () => {
      const store = useDevToolsStore.getState();
      store.addBridgeTrace({ id: 'trace-del', action: 'TEST_ACTION', domain: 'Core', durationMs: 1 });

      render(<BridgeWaterfall />);
      expect(screen.getByText('TEST_ACTION')).toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearBtn);

      expect(screen.getByText(/No bridge IPC traces recorded yet/i)).toBeInTheDocument();
      expect(useDevToolsStore.getState().bridgeTraces.length).toBe(0);
    });

    it('exports IpcWaterfall alias correctly', () => {
      expect(IpcWaterfall).toBe(BridgeWaterfall);
    });
  });

  // =========================================================================
  // 4. Sandboxed Storage Explorer Tests
  // =========================================================================
  describe('4. StorageExplorer Component', () => {
    it('renders key-value items with keys, values, and byte sizes', () => {
      render(<StorageExplorer />);
      expect(screen.getByTestId('storage-explorer-panel')).toBeInTheDocument();
      expect(screen.getByText('user_id')).toBeInTheDocument();
      expect(screen.getByText('9988')).toBeInTheDocument();
      expect(screen.getByText('theme')).toBeInTheDocument();
      expect(screen.getByText('dark')).toBeInTheDocument();
    });

    it('adds new key-value pair and synchronizes with store', () => {
      render(<StorageExplorer />);
      const keyInput = screen.getByPlaceholderText('e.g. user_session_token');
      const valInput = screen.getByPlaceholderText('Value content...');
      const saveBtn = screen.getByRole('button', { name: /Save to Sandbox Storage/i });

      fireEvent.change(keyInput, { target: { value: 'auth_jwt' } });
      fireEvent.change(valInput, { target: { value: 'jwt_token_sample_123' } });
      fireEvent.click(saveBtn);

      expect(useDevToolsStore.getState().storageData.kvStore.auth_jwt).toBe('jwt_token_sample_123');
      expect(screen.getByText('auth_jwt')).toBeInTheDocument();
      expect(screen.getByText('jwt_token_sample_123')).toBeInTheDocument();
    });

    it('deletes key from storage', () => {
      render(<StorageExplorer />);
      expect(screen.getByText('user_id')).toBeInTheDocument();

      const deleteBtn = screen.getByTestId('storage-item-user_id').querySelector('button[title="Delete Key"]')!;
      fireEvent.click(deleteBtn);

      expect(useDevToolsStore.getState().storageData.kvStore.user_id).toBeUndefined();
      expect(screen.queryByText('user_id')).not.toBeInTheDocument();
    });

    it('clears all storage when Clear Storage button is clicked', () => {
      render(<StorageExplorer />);
      const clearBtn = screen.getByRole('button', { name: /Clear Storage/i });
      fireEvent.click(clearBtn);

      expect(screen.getByText(/No keys found in sandbox storage/i)).toBeInTheDocument();
      expect(Object.keys(useDevToolsStore.getState().storageData.kvStore).length).toBe(0);
    });

    it('exports KvStorageExplorer alias correctly', () => {
      expect(KvStorageExplorer).toBe(StorageExplorer);
    });
  });

  // =========================================================================
  // 5. SQLite Viewer Tests
  // =========================================================================
  describe('5. SqliteViewer Component', () => {
    it('renders SQLite tables, column schemas, and paginated rows', () => {
      render(<SqliteViewer />);
      expect(screen.getByTestId('sqlite-viewer-panel')).toBeInTheDocument();
      expect(screen.getByText(/Table: users/)).toBeInTheDocument();
      expect(screen.getByText('goat_admin')).toBeInTheDocument();
      expect(screen.getByText('admin@goat.dev')).toBeInTheDocument();
      expect(screen.getByText('tester_alice')).toBeInTheDocument();
    });

    it('displays table schema definitions', () => {
      render(<SqliteViewer />);
      const schemaTabBtn = screen.getByRole('button', { name: 'Table Schema' });
      fireEvent.click(schemaTabBtn);

      expect(screen.getByText('PRIMARY KEY')).toBeInTheDocument();
      expect(screen.getByText('username')).toBeInTheDocument();
      expect(screen.getByText('role')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('executes custom SQL queries and returns results', () => {
      render(<SqliteViewer />);
      const sqlTabBtn = screen.getByRole('button', { name: 'SQL Query Runner' });
      fireEvent.click(sqlTabBtn);

      const queryTextarea = screen.getByPlaceholderText(/Enter SQL query/i);
      fireEvent.change(queryTextarea, { target: { value: 'SELECT * FROM users WHERE role = "developer";' } });

      const runBtn = screen.getByRole('button', { name: /Run Query/i });
      fireEvent.click(runBtn);

      expect(screen.getByText(/Query OK: 1 row\(s\) returned/i)).toBeInTheDocument();
      expect(screen.getByText('goat_admin')).toBeInTheDocument();
    });

    it('exports SqliteExplorer alias correctly', () => {
      expect(SqliteExplorer).toBe(SqliteViewer);
    });
  });

  // =========================================================================
  // 6. Sandboxed FileSystem Browser Tests
  // =========================================================================
  describe('6. FileSystemBrowser Component', () => {
    it('renders sandboxed directories and file list with metadata', () => {
      render(<FileSystemBrowser />);
      expect(screen.getByTestId('fs-browser-panel')).toBeInTheDocument();
      expect(screen.getByText('avatar.png')).toBeInTheDocument();
      expect(screen.getByText('app_config.json')).toBeInTheDocument();
    });

    it('allows previewing text and JSON files', () => {
      render(<FileSystemBrowser />);
      const configFileRow = screen.getByText('app_config.json');
      fireEvent.click(configFileRow);

      expect(screen.getByText(/Preview: app_config.json/i)).toBeInTheDocument();
      expect(screen.getByText(/"theme": "dark"/)).toBeInTheDocument();
    });

    it('creates new files and deletes existing files in sandbox', () => {
      render(<FileSystemBrowser />);
      const newFileBtn = screen.getByRole('button', { name: /New File/i });
      fireEvent.click(newFileBtn);

      const nameInput = screen.getByPlaceholderText('filename.json');
      const contentTextarea = screen.getByPlaceholderText(/Initial file content/i);
      const createSubmitBtn = screen.getByRole('button', { name: 'Create' });

      fireEvent.change(nameInput, { target: { value: 'settings.json' } });
      fireEvent.change(contentTextarea, { target: { value: '{"mode": "test"}' } });
      fireEvent.click(createSubmitBtn);

      expect(screen.getByText('settings.json')).toBeInTheDocument();
    });

    it('exports SandboxedFsBrowser alias correctly', () => {
      expect(SandboxedFsBrowser).toBe(FileSystemBrowser);
    });
  });

  // =========================================================================
  // 7. Master DebuggerPanel Tests
  // =========================================================================
  describe('7. DebuggerPanel Component', () => {
    it('renders master tabbed panel with all 6 debugger tabs', () => {
      render(<DebuggerPanel />);
      expect(screen.getByTestId('master-debugger-panel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Elements/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Console/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Waterfall/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Storage/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /SQLite/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /FileSystem/i })).toBeInTheDocument();
    });

    it('switches between debugger tabs smoothly', () => {
      render(<DebuggerPanel />);

      // Switch to Elements
      fireEvent.click(screen.getByRole('button', { name: /Elements/i }));
      expect(screen.getByTestId('elements-inspector-panel')).toBeInTheDocument();

      // Switch to Storage
      fireEvent.click(screen.getByRole('button', { name: /Storage/i }));
      expect(screen.getByTestId('storage-explorer-panel')).toBeInTheDocument();

      // Switch to SQLite
      fireEvent.click(screen.getByRole('button', { name: /SQLite/i }));
      expect(screen.getByTestId('sqlite-viewer-panel')).toBeInTheDocument();

      // Switch to FileSystem
      fireEvent.click(screen.getByRole('button', { name: /FileSystem/i }));
      expect(screen.getByTestId('fs-browser-panel')).toBeInTheDocument();

      // Switch back to Console
      fireEvent.click(screen.getByRole('button', { name: /Console/i }));
      expect(screen.getByTestId('unified-console-panel')).toBeInTheDocument();
    });

    it('toggles collapse and expand', () => {
      const onToggle = vi.fn();
      render(<DebuggerPanel isCollapsed={true} onToggleCollapse={onToggle} />);
      const expandBtn = screen.getByTitle(/Expand Debugger Panel/i);
      fireEvent.click(expandBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('exports MultiLaneDebugger alias correctly', () => {
      expect(MultiLaneDebugger).toBe(DebuggerPanel);
    });
  });

  // =========================================================================
  // 8. Debugger Zustand Slice Unit Tests
  // =========================================================================
  describe('8. debuggerSlice Unit Tests', () => {
    it('correctly adds and clears logs', () => {
      const store = useDevToolsStore.getState();
      if (store.addLog) {
        store.addLog({ source: 'AppService', level: 'info', message: 'Hello from worker' });
      }
      expect((useDevToolsStore.getState().logs || []).some((l) => l.message === 'Hello from worker')).toBe(true);

      if (store.clearLogs) {
        store.clearLogs();
      }
      expect((useDevToolsStore.getState().logs || []).length).toBe(0);
    });

    it('updates bridge trace spans with duration and status', () => {
      const store = useDevToolsStore.getState();
      if (store.addWaterfallSpan) {
        store.addWaterfallSpan({
          callId: 'call-99',
          action: 'TEST_RPC',
          threadLane: 'AppService',
          status: 'pending',
        });
      }

      if (store.updateWaterfallSpan) {
        store.updateWaterfallSpan('call-99', {
          status: 'success',
          durationMs: 14.5,
          reply: { ok: true },
        });
      }

      const span = (useDevToolsStore.getState().waterfallSpans || []).find((s) => s.callId === 'call-99');
      expect(span).toBeDefined();
      expect(span?.status).toBe('success');
      expect(span?.durationMs).toBe(14.5);
    });

    it('handles SQLite table data updates and FileSystem mutations', () => {
      const store = useDevToolsStore.getState();
      store.setSqliteTableData('users', [{ id: 10, username: 'new_user' }]);
      expect(useDevToolsStore.getState().storageData.sqliteTables['users'][0].username).toBe('new_user');

      store.setFsItem?.('/data/user/files', { name: 'test_file.txt', size: 100 });
      const files = useDevToolsStore.getState().storageData.fsTree['/data/user/files'] || [];
      expect(files.some((f: any) => f.name === 'test_file.txt')).toBe(true);

      store.deleteFsItem?.('/data/user/files', 'test_file.txt');
      const filesAfter = useDevToolsStore.getState().storageData.fsTree['/data/user/files'] || [];
      expect(filesAfter.some((f: any) => f.name === 'test_file.txt')).toBe(false);
    });
  });
});
