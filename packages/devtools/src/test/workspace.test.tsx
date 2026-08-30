/**
 * @goat/devtools - Workspace & Milestone 1 Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Store & Types
import { useDevToolsStore } from '../store/index.ts';
import { ACTION_CATALOG, createMonacoCompletionItems } from '../services/monaco/completionProvider.ts';
import { GOAT_BRIDGE_DTS } from '../services/monaco/typings/goatBridgeRawDts.ts';
import {
  validateManifestJson,
  validateGoatConfigJson,
} from '../services/monaco/schemaValidator.ts';
import {
  buildFileTreeFromMap,
  flattenTreeToMap,
  getFileContent,
  setFileContent,
  createFile,
  createFolder,
  deleteNode,
  renameNode,
  getLanguageFromPath,
} from '../services/virtualFsService.ts';
import { TEMPLATES, getTemplateById, getDefaultTemplate } from '../services/templates/index.ts';

// Components
import { HeaderBar } from '../components/layout/HeaderBar.tsx';
import { HeaderToolbar } from '../components/layout/HeaderToolbar.tsx';
import { StatusBar } from '../components/layout/StatusBar.tsx';
import { TabBar } from '../components/layout/TabBar.tsx';
import { ThemeToggle } from '../components/layout/ThemeToggle.tsx';
import { TemplateSwitcherModal } from '../components/editor/TemplateSwitcherModal.tsx';
import { SchemaValidationBanner } from '../components/editor/SchemaValidationBanner.tsx';
import { FileTreeBrowser } from '../components/editor/FileTreeBrowser.tsx';

describe('Milestone 1: 203 GoatBridge Catalog & Typings', () => {
  it('should include exactly 203 canonical GoatBridge actions across 18 domains', () => {
    expect(ACTION_CATALOG.length).toBe(203);

    // Verify all 18 domains are present
    const domains = new Set(ACTION_CATALOG.map((a) => a.domain));
    expect(domains.size).toBe(18);

    expect(domains).toContain('Core & System Lifecycle');
    expect(domains).toContain('Multi-Tenant Storage & Sandboxing');
    expect(domains).toContain('Sandboxed FileSystem & File Chooser');
    expect(domains).toContain('Networking, HTTP & WebSockets');
    expect(domains).toContain('UI Feedback & Window Insets');
    expect(domains).toContain('Hardware Sensors & Telephony');
    expect(domains).toContain('Location & Geofencing');
    expect(domains).toContain('Biometrics & Permissions');
    expect(domains).toContain('Media & Audio');
    expect(domains).toContain('Contacts & Social Sharing');
    expect(domains).toContain('Push Notifications');
    expect(domains).toContain('Bluetooth Low Energy & NFC');
    expect(domains).toContain('Web3 & Payments');
    expect(domains).toContain('Binary IPC Channels');
    expect(domains).toContain('Navigation & Predictive Back');
    expect(domains).toContain('Subpackages, WASM & Bytecode');
    expect(domains).toContain('Visual Rendering & Same-Layer');
    expect(domains).toContain('Capability Discovery & APM Telemetry');
  });

  it('should contain valid snippets and signatures for representative actions', () => {
    const devInfo = ACTION_CATALOG.find((a) => a.action === 'GET_DEVICE_INFO');
    expect(devInfo).toBeDefined();
    expect(devInfo?.signature).toContain('Promise<DeviceInfo>');

    const location = ACTION_CATALOG.find((a) => a.action === 'GET_LOCATION');
    expect(location?.permissions).toContain('LOCATION');

    const haptic = ACTION_CATALOG.find((a) => a.action === 'HAPTIC_FEEDBACK');
    expect(haptic?.permissions).toContain('HAPTICS');

    const biometric = ACTION_CATALOG.find((a) => a.action === 'BIOMETRIC_AUTH');
    expect(biometric?.permissions).toContain('BIOMETRIC');
  });

  it('should generate completion items for Monaco language service', () => {
    const mockMonaco = {
      languages: {
        CompletionItemKind: { Method: 0 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };

    const items = createMonacoCompletionItems(mockMonaco);
    expect(items.length).toBe(203);
    expect(items[0].label).toBe('GET_DEVICE_INFO');
    expect(items[0].detail).toContain('GoatBridge');
  });

  it('should export valid ambient TypeScript declaration text', () => {
    expect(GOAT_BRIDGE_DTS).toContain('declare namespace GoatBridge');
    expect(GOAT_BRIDGE_DTS).toContain('declare class MiniAppBridge');
    expect(GOAT_BRIDGE_DTS).toContain('GET_DEVICE_INFO');
    expect(GOAT_BRIDGE_DTS).toContain('RECORD_BRIDGE_TIMING');
  });
});

describe('Milestone 1: JSON Schema Validation', () => {
  it('should validate a correct manifest.json successfully', () => {
    const validManifest = JSON.stringify({
      appId: 'com.example.miniapp',
      appName: 'Example Mini-App',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/main.tsx',
      window: {
        title: 'Title',
        backgroundColor: '#FFFFFF',
      },
      permissions: ['LOCATION', 'HAPTICS'],
    });

    const result = validateManifestJson(validManifest);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should catch missing required fields in manifest.json', () => {
    const invalidManifest = JSON.stringify({
      appName: 'Incomplete App',
    });

    const result = validateManifestJson(invalidManifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('appId'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('version'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('versionCode'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('entryPage'))).toBe(true);
  });

  it('should reject invalid appId formats', () => {
    const manifest = JSON.stringify({
      appId: 'invalid_app_id_without_dots',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/main.tsx',
    });

    const result = validateManifestJson(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('reverse-domain'))).toBe(true);
  });

  it('should reject unknown permissions and warn on duplicates', () => {
    const manifest = JSON.stringify({
      appId: 'com.example.app',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/main.tsx',
      permissions: ['LOCATION', 'UNKNOWN_CAPABILITY', 'LOCATION'],
    });

    const result = validateManifestJson(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('UNKNOWN_CAPABILITY'))).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('Duplicate'))).toBe(true);
  });

  it('should reject invalid hex colors in window config', () => {
    const manifest = JSON.stringify({
      appId: 'com.example.app',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'src/main.tsx',
      window: {
        backgroundColor: 'red', // Not 6-digit hex
      },
    });

    const result = validateManifestJson(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('hex color'))).toBe(true);
  });

  it('should validate goat.config.json', () => {
    const validConfig = JSON.stringify({
      name: 'My App',
      version: '1.0.0',
      appId: 'com.example.app',
      entryPage: 'src/main.tsx',
    });

    expect(validateGoatConfigJson(validConfig).isValid).toBe(true);

    const invalidConfig = JSON.stringify({
      name: 'Incomplete',
    });
    expect(validateGoatConfigJson(invalidConfig).isValid).toBe(false);
  });
});

describe('Milestone 1: Virtual FileSystem Service', () => {
  it('should build hierarchical tree from flat path map', () => {
    const fileMap = {
      'src/main.tsx': 'console.log("main");',
      'src/App.tsx': 'export default function App() {}',
      'src/hooks/useBridge.ts': 'export const useBridge = () => {};',
      'manifest.json': '{}',
    };

    const tree = buildFileTreeFromMap(fileMap);
    expect(tree.length).toBe(2); // 'manifest.json' and 'src' folder

    const srcNode = tree.find((n) => n.name === 'src');
    expect(srcNode?.isDirectory).toBe(true);
    expect(srcNode?.children?.length).toBe(3); // App.tsx, hooks, main.tsx

    const hooksNode = srcNode?.children?.find((n) => n.name === 'hooks');
    expect(hooksNode?.isDirectory).toBe(true);
    expect(hooksNode?.children?.length).toBe(1);
  });

  it('should flatten tree back to map correctly', () => {
    const fileMap = {
      'src/main.tsx': 'content1',
      'manifest.json': 'content2',
    };

    const tree = buildFileTreeFromMap(fileMap);
    const flattened = flattenTreeToMap(tree);
    expect(flattened).toEqual(fileMap);
  });

  it('should support CRUD operations on Virtual FS tree', () => {
    let tree = buildFileTreeFromMap({
      'src/App.tsx': 'Initial',
      'manifest.json': '{}',
    });

    // Read
    expect(getFileContent(tree, 'src/App.tsx')).toBe('Initial');

    // Update
    tree = setFileContent(tree, 'src/App.tsx', 'Updated Content');
    expect(getFileContent(tree, 'src/App.tsx')).toBe('Updated Content');

    // Create File
    tree = createFile(tree, 'src/components/Button.tsx', 'Button Component');
    expect(getFileContent(tree, 'src/components/Button.tsx')).toBe('Button Component');

    // Create Folder
    tree = createFolder(tree, 'src/assets/images');
    const flattened = flattenTreeToMap(tree);
    expect(flattened['src/components/Button.tsx']).toBe('Button Component');

    // Rename
    tree = renameNode(tree, 'src/components/Button.tsx', 'src/components/PrimaryButton.tsx');
    expect(getFileContent(tree, 'src/components/PrimaryButton.tsx')).toBe('Button Component');
    expect(getFileContent(tree, 'src/components/Button.tsx')).toBeNull();

    // Delete
    tree = deleteNode(tree, 'src/components/PrimaryButton.tsx');
    expect(getFileContent(tree, 'src/components/PrimaryButton.tsx')).toBeNull();
  });

  it('should correctly detect language from file extension', () => {
    expect(getLanguageFromPath('src/App.tsx')).toBe('typescript');
    expect(getLanguageFromPath('src/main.ts')).toBe('typescript');
    expect(getLanguageFromPath('src/main.js')).toBe('javascript');
    expect(getLanguageFromPath('manifest.json')).toBe('json');
    expect(getLanguageFromPath('index.html')).toBe('html');
    expect(getLanguageFromPath('src/style.css')).toBe('css');
    expect(getLanguageFromPath('App.vue')).toBe('html');
    expect(getLanguageFromPath('route.gpx')).toBe('xml');
  });
});

describe('Milestone 1: Project Templates', () => {
  it('should provide React 19, Vue 3.5, and Vanilla JS templates', () => {
    expect(TEMPLATES.length).toBe(3);

    const reactTmpl = getTemplateById('react-19');
    expect(reactTmpl).toBeDefined();
    expect(reactTmpl?.framework).toBe('react');
    expect(reactTmpl?.files['manifest.json']).toBeDefined();
    expect(reactTmpl?.files['src/App.tsx']).toContain('GoatBridge');

    const vueTmpl = getTemplateById('vue-3.5');
    expect(vueTmpl).toBeDefined();
    expect(vueTmpl?.framework).toBe('vue');
    expect(vueTmpl?.files['src/App.vue']).toContain('<script setup');

    const vanillaTmpl = getTemplateById('vanilla-js');
    expect(vanillaTmpl).toBeDefined();
    expect(vanillaTmpl?.framework).toBe('vanilla');
    expect(vanillaTmpl?.files['src/main.js']).toBeDefined();

    expect(getDefaultTemplate().id).toBe('react-19');
  });
});

describe('Milestone 1: Central Zustand Store & Actions', () => {
  beforeEach(() => {
    useDevToolsStore.getState().loadTemplate('react-19');
  });

  it('should initialize with default template and tabs', () => {
    const state = useDevToolsStore.getState();
    expect(state.activeTemplateId).toBe('react-19');
    expect(state.openTabs.length).toBeGreaterThanOrEqual(1);
    expect(state.activeTabId).toBe('src/App.tsx');
    expect(state.theme).toBe('dark');
  });

  it('should switch templates and reinitialize file tree', () => {
    const store = useDevToolsStore.getState();
    store.loadTemplate('vue-3.5');

    const updated = useDevToolsStore.getState();
    expect(updated.activeTemplateId).toBe('vue-3.5');
    expect(updated.activeTabId).toBe('src/App.vue');
    expect(getFileContent(updated.fileTree, 'src/App.vue')).toBeDefined();
  });

  it('should handle open, switch, and close tabs', () => {
    const store = useDevToolsStore.getState();
    store.openFile('manifest.json');
    expect(useDevToolsStore.getState().activeTabId).toBe('manifest.json');

    store.closeTab('manifest.json');
    expect(useDevToolsStore.getState().openTabs.find((t: any) => t.id === 'manifest.json')).toBeUndefined();
  });

  it('should update file content and mark tabs dirty', () => {
    const store = useDevToolsStore.getState();
    store.updateFileContent('src/App.tsx', '// Edited content');

    const state = useDevToolsStore.getState();
    expect(getFileContent(state.fileTree, 'src/App.tsx')).toBe('// Edited content');
    const tab = state.openTabs.find((t: any) => t.filePath === 'src/App.tsx');
    expect(tab?.isDirty).toBe(true);
  });

  it('should toggle theme and update document classes', () => {
    const store = useDevToolsStore.getState();
    store.setTheme('light');
    expect(useDevToolsStore.getState().theme).toBe('light');

    store.toggleTheme();
    expect(useDevToolsStore.getState().theme).toBe('dark');
  });

  it('should handle simulator slice actions', () => {
    const store = useDevToolsStore.getState();
    store.setDeviceSkin('pixel-9-pro');
    expect(useDevToolsStore.getState().activeSkinId).toBe('pixel-9-pro');

    store.setOrientation('landscape');
    expect(useDevToolsStore.getState().orientation).toBe('landscape');

    store.setScale(1.25);
    expect(useDevToolsStore.getState().scale).toBe(1.25);

    store.stopSimulator();
    expect(useDevToolsStore.getState().isRunning).toBe(false);
  });

  it('should handle sensor slice actions and motion presets', () => {
    const store = useDevToolsStore.getState();
    store.setMotionPreset('shake');
    expect(useDevToolsStore.getState().activeMotionPreset).toBe('shake');
    expect(useDevToolsStore.getState().accelerometer.x).toBeGreaterThan(10);

    store.setLocation({ latitude: 51.5074, longitude: -0.1278 });
    expect(useDevToolsStore.getState().location.latitude).toBe(51.5074);

    store.setNetworkProfile('4g');
    expect(useDevToolsStore.getState().networkProfileId).toBe('4g');

    store.setBattery({ level: 42, isCharging: false });
    expect(useDevToolsStore.getState().battery.level).toBe(42);
  });

  it('should record debugger logs and telemetry waterfall spans', () => {
    const store = useDevToolsStore.getState();
    store.addLog({
      source: 'AppService',
      level: 'info',
      message: 'Custom test log',
    });

    const logs = useDevToolsStore.getState().logs;
    expect(logs.some((l: any) => l.message === 'Custom test log')).toBe(true);

    store.addWaterfallSpan({
      callId: 'call-100',
      action: 'GET_LOCATION',
      threadLane: 'AppService',
      status: 'pending',
    });

    store.updateWaterfallSpan('call-100', {
      status: 'success',
      durationMs: 14.5,
    });

    const spans = useDevToolsStore.getState().waterfallSpans;
    const span = spans.find((s: any) => s.callId === 'call-100');
    expect(span?.status).toBe('success');
    expect(span?.durationMs).toBe(14.5);
  });
});

describe('Milestone 1: UI Component Rendering', () => {
  beforeEach(() => {
    useDevToolsStore.getState().loadTemplate('react-19');
  });

  it('should render HeaderBar with project title and action controls', () => {
    render(<HeaderBar />);
    expect(screen.getByText('Goat Studio')).toBeInTheDocument();
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('Pair Device')).toBeInTheDocument();
  });

  it('should render HeaderToolbar with brand and controls', () => {
    render(<HeaderToolbar />);
    expect(screen.getByText('Goat Studio')).toBeInTheDocument();
    expect(screen.getByText('Hot Reload')).toBeInTheDocument();
  });

  it('should render StatusBar with validation status and 203 actions badge', () => {
    render(<StatusBar />);
    expect(screen.getByText('203 Actions Active')).toBeInTheDocument();
    expect(screen.getByText('60 FPS')).toBeInTheDocument();
  });

  it('should render TabBar with active tabs', () => {
    render(<TabBar />);
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });

  it('should render ThemeToggle button', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /Toggle Theme/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
  });

  it('should render TemplateSwitcherModal when open', () => {
    useDevToolsStore.getState().setTemplateModalOpen(true);
    render(<TemplateSwitcherModal />);
    expect(screen.getByText('Select Mini-App Template')).toBeInTheDocument();
    expect(screen.getByText('React 19 Mini-App')).toBeInTheDocument();
    expect(screen.getByText('Vue 3.5 Mini-App')).toBeInTheDocument();
    expect(screen.getByText('Vanilla JS Mini-App')).toBeInTheDocument();
  });

  it('should render SchemaValidationBanner when schema errors exist', () => {
    useDevToolsStore.getState().setValidationMarkers([
      {
        filePath: 'manifest.json',
        line: 3,
        column: 1,
        message: 'Missing required field appId',
        severity: 'error',
      },
    ]);

    render(<SchemaValidationBanner />);
    expect(screen.getByText('Schema Validation:')).toBeInTheDocument();
    expect(screen.getByText(/1 error\(s\)/)).toBeInTheDocument();
  });

  it('should render FileTreeBrowser with project explorer items', () => {
    render(<FileTreeBrowser />);
    expect(screen.getByText('Project Explorer')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });
});
