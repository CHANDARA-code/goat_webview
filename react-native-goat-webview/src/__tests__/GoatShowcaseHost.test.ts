import { SHOWCASE_TABS } from '../../example/src/types';
import { hardwareOverrides, GPS_PRESETS } from '../../example/src/HardwareOverrides';
import { ipcBenchmark } from '../../example/src/IpcBenchmark';
import { appServiceRuntime } from '../../example/src/AppServiceRuntime';

describe('React Native Showcase Host & HUD Suite (Milestone M5)', () => {
  describe('Showcase Tabs & Routing Contract', () => {
    test('contains all 4 domain mini-apps and Diagnostics tab with required routes and appIds', () => {
      expect(SHOWCASE_TABS).toHaveLength(5);

      const tabIds = SHOWCASE_TABS.map((t) => t.id);
      expect(tabIds).toEqual(['ecommerce', 'iot', 'fieldservice', 'vault', 'diagnostics']);

      const ecommerce = SHOWCASE_TABS.find((t) => t.id === 'ecommerce');
      expect(ecommerce).toBeDefined();
      expect(ecommerce!.appId).toBe('com.goat.ecommerce');
      expect(ecommerce!.route).toBe('#/ecommerce');

      const iot = SHOWCASE_TABS.find((t) => t.id === 'iot');
      expect(iot).toBeDefined();
      expect(iot!.appId).toBe('com.goat.iot');
      expect(iot!.route).toBe('#/iot');

      const fieldservice = SHOWCASE_TABS.find((t) => t.id === 'fieldservice');
      expect(fieldservice).toBeDefined();
      expect(fieldservice!.appId).toBe('com.goat.fieldservice');
      expect(fieldservice!.route).toBe('#/fieldservice');

      const vault = SHOWCASE_TABS.find((t) => t.id === 'vault');
      expect(vault).toBeDefined();
      expect(vault!.appId).toBe('com.goat.vault');
      expect(vault!.route).toBe('#/vault');

      const diagnostics = SHOWCASE_TABS.find((t) => t.id === 'diagnostics');
      expect(diagnostics).toBeDefined();
      expect(diagnostics!.appId).toBe('com.goat.diagnostics');
      expect(diagnostics!.route).toBe('#/diagnostics');
    });
  });

  describe('Hardware Overrides Store', () => {
    beforeEach(() => {
      hardwareOverrides.resetAll();
    });

    test('toggles offline mode and notifies subscribers', () => {
      let notifiedOffline = false;
      const unsubscribe = hardwareOverrides.subscribe((st) => {
        notifiedOffline = st.isOffline;
      });

      hardwareOverrides.setOffline(true);
      expect(notifiedOffline).toBe(true);

      hardwareOverrides.setOffline(false);
      expect(notifiedOffline).toBe(false);

      unsubscribe();
    });

    test('sets and clears spoofed GPS coordinates', () => {
      const preset = GPS_PRESETS[0];
      hardwareOverrides.setMockGps(preset.location);

      const state = hardwareOverrides.getState();
      expect(state.mockGps).not.toBeNull();
      expect(state.mockGps!.latitude).toBe(preset.location.latitude);
      expect(state.mockGps!.longitude).toBe(preset.location.longitude);

      hardwareOverrides.setMockGps(null);
      expect(hardwareOverrides.getState().mockGps).toBeNull();
    });

    test('evaluates biometric outcome modes correctly', () => {
      hardwareOverrides.setBiometricMode('FORCE_SUCCESS');
      expect(hardwareOverrides.evaluateBiometrics().success).toBe(true);

      hardwareOverrides.setBiometricMode('FORCE_ERROR');
      const errRes = hardwareOverrides.evaluateBiometrics();
      expect(errRes.success).toBe(false);
      expect(errRes.error).toContain('canceled');

      hardwareOverrides.setBiometricMode('LOCKED_OUT');
      const lockedRes = hardwareOverrides.evaluateBiometrics();
      expect(lockedRes.success).toBe(false);
      expect(lockedRes.error).toContain('locked out');

      hardwareOverrides.setBiometricMode('NOT_ENROLLED');
      const notEnrolledRes = hardwareOverrides.evaluateBiometrics();
      expect(notEnrolledRes.success).toBe(false);
      expect(notEnrolledRes.error).toContain('No biometric credentials');
    });

    test('generates mock BLE and NFC payloads', () => {
      hardwareOverrides.setMockBleDevicesCount(3);
      const devices = hardwareOverrides.getMockBlePeripherals();
      expect(devices).toHaveLength(3);
      expect(devices[0].name).toBeDefined();

      hardwareOverrides.setMockNfcPayload('NDEF://test/asset');
      expect(hardwareOverrides.getState().mockNfcPayload).toBe('NDEF://test/asset');
    });
  });

  describe('IPC Benchmark Runner', () => {
    beforeEach(() => {
      ipcBenchmark.clearHistory();
    });

    test('calculates accurate latency distribution statistics', () => {
      const samples = [1.2, 2.5, 3.1, 4.0, 6.5, 12.0, 18.5];
      const stats = ipcBenchmark.calculateStats(samples);

      expect(stats.totalCalls).toBe(7);
      expect(stats.warmPathCalls).toBe(4); // < 5ms: 1.2, 2.5, 3.1, 4.0
      expect(stats.warmPathPercentage).toBe(57.1);
      expect(stats.minDurationMs).toBe(1.2);
      expect(stats.maxDurationMs).toBe(18.5);
      expect(stats.p50DurationMs).toBe(4.0);
    });

    test('runs batch benchmark and emits telemetry frames', async () => {
      const emittedMessages: any[] = [];
      let progressUpdates = 0;

      const stats = await ipcBenchmark.runBatchBenchmark(
        10,
        (prog) => {
          progressUpdates++;
        },
        (entry) => {
          emittedMessages.push(entry);
        }
      );

      expect(stats.totalCalls).toBe(10);
      expect(emittedMessages).toHaveLength(10);
      expect(progressUpdates).toBeGreaterThan(0);
      expect(emittedMessages[0].action).toBe('BENCHMARK_PING');
    });
  });

  describe('AppService Dual-Thread Simulation Runtime', () => {
    afterEach(() => {
      appServiceRuntime.stopBackgroundSimulation();
    });

    test('executes simulated worker task and updates VDOM patch counters', async () => {
      const res = await appServiceRuntime.runSimulatedWorkerTask('VDOM_DIFF_SYNC', { batchSize: 3 });
      expect(res).not.toBeNull();
      expect(res.patchesApplied).toBe(3);

      const state = appServiceRuntime.getState();
      expect(state.vdomPatchCount).toBeGreaterThanOrEqual(3);
      expect(state.laneCounts.appService).toBeGreaterThan(0);
      expect(state.laneCounts.appView).toBeGreaterThan(0);
    });

    test('simulates worker crash and auto-recovery restart', async () => {
      await appServiceRuntime.simulateWorkerCrash('Test Crash');
      expect(appServiceRuntime.getState().status).toBe('CRASHED');
      expect(appServiceRuntime.getState().lastError).toBe('Test Crash');

      // Attempting task while crashed returns null
      const nullRes = await appServiceRuntime.runSimulatedWorkerTask('CALCULATE_CART_TOTALS');
      expect(nullRes).toBeNull();

      // Restart worker
      await appServiceRuntime.restartWorker();
      expect(appServiceRuntime.getState().status).toBe('READY');
      expect(appServiceRuntime.getState().lastError).toBeNull();

      // Task succeeds after restart
      const successRes = await appServiceRuntime.runSimulatedWorkerTask('CALCULATE_CART_TOTALS');
      expect(successRes).not.toBeNull();
      expect(successRes.total).toBe(140.39);
    });

    test('toggles dual-thread enabled mode', () => {
      appServiceRuntime.setEnabled(false);
      expect(appServiceRuntime.getState().enabled).toBe(false);
      expect(appServiceRuntime.getState().status).toBe('IDLE');

      appServiceRuntime.setEnabled(true);
      expect(appServiceRuntime.getState().enabled).toBe(true);
      expect(appServiceRuntime.getState().status).toBe('READY');
    });
  });
});
