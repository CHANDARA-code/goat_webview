import { describe, it, expect, beforeEach } from 'vitest';
import { useDevToolsStore } from '../../store/useDevToolsStore.ts';

describe('DevTools Central Zustand Store — Workspace & Slices', () => {
  beforeEach(() => {
    useDevToolsStore.getState().resetWorkspace();
  });

  describe('Workspace Slice', () => {
    it('initializes with default vanilla template and manifest tab', () => {
      const state = useDevToolsStore.getState();
      expect(state.activeTemplate).toBe('vanilla');
      expect(state.activeFilePath).toBe('manifest.json');
      expect(state.openTabs.length).toBe(1);
      expect(state.openTabs[0].filePath).toBe('manifest.json');
      expect(state.files['manifest.json']).toBeDefined();
    });

    it('handles theme toggling and setting', () => {
      const store = useDevToolsStore.getState();
      store.setTheme('light');
      expect(useDevToolsStore.getState().theme).toBe('light');

      store.toggleTheme();
      expect(useDevToolsStore.getState().theme).toBe('dark');
    });

    it('creates, opens, updates, renames, and deletes files', () => {
      const store = useDevToolsStore.getState();

      // Create
      store.createFile('pages/profile/profile.js', 'Page({ data: { user: "goat" } });');
      expect(useDevToolsStore.getState().files['pages/profile/profile.js']).toBe(
        'Page({ data: { user: "goat" } });'
      );
      expect(useDevToolsStore.getState().activeFilePath).toBe('pages/profile/profile.js');

      // Update
      store.updateFileContent('pages/profile/profile.js', 'Page({ data: { user: "goat_updated" } });');
      expect(useDevToolsStore.getState().files['pages/profile/profile.js']).toBe(
        'Page({ data: { user: "goat_updated" } });'
      );
      const tab = useDevToolsStore.getState().openTabs.find((t: any) => t.filePath === 'pages/profile/profile.js');
      expect(tab?.isDirty).toBe(true);

      // Rename
      store.renameFile('pages/profile/profile.js', 'pages/profile/account.js');
      expect(useDevToolsStore.getState().files['pages/profile/profile.js']).toBeUndefined();
      expect(useDevToolsStore.getState().files['pages/profile/account.js']).toBe(
        'Page({ data: { user: "goat_updated" } });'
      );
      expect(useDevToolsStore.getState().activeFilePath).toBe('pages/profile/account.js');

      // Delete
      store.deleteFile('pages/profile/account.js');
      expect(useDevToolsStore.getState().files['pages/profile/account.js']).toBeUndefined();
      expect(
        useDevToolsStore.getState().openTabs.find((t: any) => t.filePath === 'pages/profile/account.js')
      ).toBeUndefined();
    });

    it('manages tab operations (open, active, close, closeOthers, closeAll)', () => {
      const store = useDevToolsStore.getState();
      store.createFile('a.js', '// a');
      store.createFile('b.js', '// b');
      store.createFile('c.js', '// c');

      const tabs = useDevToolsStore.getState().openTabs;
      expect(tabs.length).toBeGreaterThanOrEqual(3);

      const tabB = tabs.find((t: any) => t.filePath === 'b.js')!;
      store.setActiveTab(tabB.id);
      expect(useDevToolsStore.getState().activeTabId).toBe(tabB.id);
      expect(useDevToolsStore.getState().activeFilePath).toBe('b.js');

      // Close other tabs
      store.closeOtherTabs(tabB.id);
      expect(useDevToolsStore.getState().openTabs.length).toBe(1);
      expect(useDevToolsStore.getState().openTabs[0].filePath).toBe('b.js');

      // Close all tabs
      store.closeAllTabs();
      expect(useDevToolsStore.getState().openTabs.length).toBe(0);
      expect(useDevToolsStore.getState().activeTabId).toBeNull();
      expect(useDevToolsStore.getState().activeFilePath).toBeNull();
    });

    it('loads project templates (vanilla, react, vue)', () => {
      const store = useDevToolsStore.getState();

      store.loadTemplate('react');
      expect(useDevToolsStore.getState().activeTemplate).toBe('react');
      expect(useDevToolsStore.getState().files['src/App.tsx']).toBeDefined();

      store.loadTemplate('vue');
      expect(useDevToolsStore.getState().activeTemplate).toBe('vue');
      expect(useDevToolsStore.getState().files['src/App.vue']).toBeDefined();

      store.loadTemplate('vanilla');
      expect(useDevToolsStore.getState().activeTemplate).toBe('vanilla');
      expect(useDevToolsStore.getState().files['manifest.json']).toBeDefined();
    });

    it('toggles panels and updates panel dimensions', () => {
      const store = useDevToolsStore.getState();
      store.setLeftSidebarWidth(320);
      expect(useDevToolsStore.getState().leftSidebarWidth).toBe(320);

      store.setBottomDebuggerHeight(350);
      expect(useDevToolsStore.getState().bottomDebuggerHeight).toBe(350);

      store.setRightSimulatorWidth(480);
      expect(useDevToolsStore.getState().rightSimulatorWidth).toBe(480);

      store.toggleLeftSidebar();
      expect(useDevToolsStore.getState().isLeftSidebarOpen).toBe(false);
      store.toggleLeftSidebar();
      expect(useDevToolsStore.getState().isLeftSidebarOpen).toBe(true);
    });
  });

  describe('Simulator Slice', () => {
    it('sets device skin and recalculates safe area insets', () => {
      const store = useDevToolsStore.getState();

      store.setActiveDeviceSkin('iphone16pro');
      expect(useDevToolsStore.getState().activeDeviceSkin).toBe('iphone16pro');
      expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(59);

      store.setActiveDeviceSkin('pixel9pro');
      expect(useDevToolsStore.getState().activeDeviceSkin).toBe('pixel9pro');
      expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(48);

      store.setActiveDeviceSkin('ipadpro');
      expect(useDevToolsStore.getState().activeDeviceSkin).toBe('ipadpro');
      expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(24);

      store.setActiveDeviceSkin('foldable');
      expect(useDevToolsStore.getState().activeDeviceSkin).toBe('foldable');
      expect(useDevToolsStore.getState().safeAreaInsets.top).toBe(32);
    });

    it('toggles orientation and viewport scales', () => {
      const store = useDevToolsStore.getState();
      store.setOrientation('portrait');
      expect(useDevToolsStore.getState().orientation).toBe('portrait');

      store.toggleOrientation();
      expect(useDevToolsStore.getState().orientation).toBe('landscape');

      store.setViewportScale(1.25);
      expect(useDevToolsStore.getState().viewportScale).toBe(1.25);
    });

    it('controls simulator lifecycle (start, stop, restart, error)', () => {
      const store = useDevToolsStore.getState();
      store.stopSimulator();
      expect(useDevToolsStore.getState().isRunning).toBe(false);

      store.startSimulator();
      expect(useDevToolsStore.getState().isRunning).toBe(true);

      store.setSimulatorError('Runtime crash test');
      expect(useDevToolsStore.getState().lastError).toBe('Runtime crash test');

      store.restartSimulator();
      expect(useDevToolsStore.getState().isRunning).toBe(true);
      expect(useDevToolsStore.getState().lastError).toBeNull();
    });
  });

  describe('Sensors Slice', () => {
    it('updates motion sensors and motion presets', () => {
      const store = useDevToolsStore.getState();
      store.setAccelerometer({ x: 1.2, y: 3.4, z: 9.8 });
      expect(useDevToolsStore.getState().accelerometer.x).toBe(1.2);

      store.setGyroscope({ x: 0.1, y: 0.2, z: 0.3 });
      expect(useDevToolsStore.getState().gyroscope.x).toBe(0.1);

      store.setMotionPreset?.('shake');
      expect(useDevToolsStore.getState().activeMotionPreset).toBe('shake');
      expect(useDevToolsStore.getState().accelerometer.x).toBeGreaterThan(10);
    });

    it('updates GPS coordinates and GPX routes', () => {
      const store = useDevToolsStore.getState();
      store.setLocation({ latitude: 37.7749, longitude: -122.4194, altitude: 12 });
      expect(useDevToolsStore.getState().location.latitude).toBe(37.7749);
      expect(useDevToolsStore.getState().location.longitude).toBe(-122.4194);

      store.setGpxRoutePoints?.([
        { lat: 37.7749, lng: -122.4194, ele: 10 },
        { lat: 37.7755, lng: -122.4182, ele: 15 },
      ]);
      expect(useDevToolsStore.getState().gpxRoute?.points.length).toBe(2);

      store.setGpxIndex?.(1);
      expect(useDevToolsStore.getState().location.latitude).toBe(37.7755);
      expect(useDevToolsStore.getState().gpxRoute?.currentIndex).toBe(1);
    });

    it('configures network throttling profiles and custom settings', () => {
      const store = useDevToolsStore.getState();

      store.setNetworkPreset('2g');
      expect(useDevToolsStore.getState().networkThrottling.preset).toBe('2g');
      expect(useDevToolsStore.getState().networkThrottling.latencyMs).toBe(400);

      store.setNetworkPreset('5g');
      expect(useDevToolsStore.getState().networkThrottling.latencyMs).toBe(10);

      store.setNetworkCustom?.({ latencyMs: 250, downloadKbps: 5000 });
      expect(useDevToolsStore.getState().networkThrottling.latencyMs).toBe(250);
      expect(useDevToolsStore.getState().networkThrottling.preset).toBe('custom');
    });

    it('manages battery, brightness, BLE, and biometrics', () => {
      const store = useDevToolsStore.getState();

      store.setBattery({ level: 45, isCharging: true });
      expect(useDevToolsStore.getState().battery.level).toBe(45);
      expect(useDevToolsStore.getState().battery.isCharging).toBe(true);

      store.setScreenBrightness(0.65);
      expect(useDevToolsStore.getState().screenBrightness).toBe(0.65);

      store.addBlePeripheral({
        id: 'ble-001',
        name: 'Goat Smart Ring',
        rssi: -58,
        serviceUuids: ['180D'],
      });
      expect(useDevToolsStore.getState().blePeripherals.length).toBe(1);

      store.setBiometrics({ shouldSucceed: false, type: 'fingerprint' });
      expect(useDevToolsStore.getState().biometrics.shouldSucceed).toBe(false);
      expect(useDevToolsStore.getState().biometrics.type).toBe('fingerprint');
    });
  });

  describe('Debugger Slice', () => {
    it('records and filters cross-thread console logs', () => {
      const store = useDevToolsStore.getState();
      store.clearConsoleLogs?.();

      store.addConsoleLog?.({
        thread: 'AppService',
        level: 'info',
        message: 'Worker initialized',
      });
      store.addConsoleLog?.({
        thread: 'AppView',
        level: 'warn',
        message: 'VDOM reflow delayed',
      });

      const logs = (useDevToolsStore.getState().consoleLogs || useDevToolsStore.getState().logs) as any[];
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('Worker initialized');
      expect(logs[1].thread || logs[1].source).toBe('AppView');
    });

    it('tracks bridge IPC waterfall spans', () => {
      const store = useDevToolsStore.getState();
      store.clearBridgeTraces?.();

      store.addBridgeTrace?.({
        id: 'trace-1',
        action: 'STORAGE_SET',
        domain: 'Multi-Tenant Storage',
        durationMs: 4.2,
        status: 'success',
      });

      const traces = (useDevToolsStore.getState().bridgeTraces || useDevToolsStore.getState().waterfallSpans) as any[];
      expect(traces.length).toBe(1);
      expect(traces[0].action).toBe('STORAGE_SET');
    });

    it('manages sandboxed KV storage and SQLite table records', () => {
      const store = useDevToolsStore.getState();

      store.setStorageKv?.('auth_token', 'jwt_xyz_123');
      expect(useDevToolsStore.getState().storageData.kvStore['auth_token']).toBe('jwt_xyz_123');

      store.deleteStorageKv?.('auth_token');
      expect(useDevToolsStore.getState().storageData.kvStore['auth_token']).toBeUndefined();

      store.setSqliteTableData?.('orders', [{ id: 101, total: 49.99 }]);
      expect(useDevToolsStore.getState().storageData.sqliteTables['orders']).toEqual([
        { id: 101, total: 49.99 },
      ]);
    });
  });

  describe('Packaging Slice', () => {
    it('manages subpackages, bundle size stats, and V8 bytecode stats', () => {
      const store = useDevToolsStore.getState();

      store.addSubpackage?.({
        name: 'packageCheckout',
        root: 'subpackages/checkout',
        sizeBytes: 15400,
        pages: ['pages/checkout/checkout'],
      });

      expect(useDevToolsStore.getState().subpackages.length).toBeGreaterThanOrEqual(1);

      store.setV8BytecodeStats?.({ enabled: true, compressionRatio: 0.52 });
      expect(useDevToolsStore.getState().v8BytecodeStats.enabled).toBe(true);
      expect(useDevToolsStore.getState().v8BytecodeStats.compressionRatio).toBe(0.52);

      store.setQrPairing?.({ isConnected: true, wsUrl: 'ws://localhost:9090' });
      expect(useDevToolsStore.getState().qrPairing.isConnected).toBe(true);
    });
  });
});
