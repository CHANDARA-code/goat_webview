import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import {
  GoatWebView,
  goatBridge,
  useGoatBridge,
  GoatWebViewNativeModule,
} from 'react-native-goat-webview';
import {
  MiniAppTab,
  SHOWCASE_TABS,
  TabId,
  IpcMessageEntry,
  HardwareOverridesState,
  AppServiceState,
  LatencyStats,
} from './src/types';
import { ShowcaseTabs } from './src/ShowcaseTabs';
import { DebugHUD } from './src/DebugHUD';
import { hardwareOverrides } from './src/HardwareOverrides';
import { ipcBenchmark } from './src/IpcBenchmark';
import { appServiceRuntime } from './src/AppServiceRuntime';

export default function App() {
  const { isPrewarmed, bundleVersion, clearCache } = useGoatBridge();
  const [activeTabId, setActiveTabId] = useState<TabId>('ecommerce');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [isDualThread, setIsDualThread] = useState(true);
  const [ipcMessages, setIpcMessages] = useState<IpcMessageEntry[]>([]);
  const [overridesState, setOverridesState] = useState<HardwareOverridesState>(hardwareOverrides.getState());
  const [appServiceState, setAppServiceState] = useState<AppServiceState>(appServiceRuntime.getState());
  const [latencyStats, setLatencyStats] = useState<LatencyStats>(ipcBenchmark.calculateStats());

  const activeTab = SHOWCASE_TABS.find((t) => t.id === activeTabId) || SHOWCASE_TABS[0];
  const webviewRef = useRef<any>(null);

  const addIpcMessage = useCallback((entry: IpcMessageEntry) => {
    setIpcMessages((prev) => [entry, ...prev.slice(0, 199)]);
    ipcBenchmark.recordDuration(entry.durationMs);
    setLatencyStats(ipcBenchmark.calculateStats());
  }, []);

  // Subscribe to hardware overrides state changes
  useEffect(() => {
    const unsub = hardwareOverrides.subscribe((st) => {
      setOverridesState(st);
    });
    return unsub;
  }, []);

  // Subscribe to AppService dual-thread worker state and messages
  useEffect(() => {
    const unsubState = appServiceRuntime.subscribeState((st) => {
      setAppServiceState(st);
    });
    const unsubMsg = appServiceRuntime.subscribeMessage((entry) => {
      addIpcMessage(entry);
    });
    return () => {
      unsubState();
      unsubMsg();
    };
  }, [addIpcMessage]);

  // Initial engine telemetry
  useEffect(() => {
    const initEntry: IpcMessageEntry = {
      id: `init_${Date.now()}`,
      timestamp: Date.now(),
      action: 'HOST_RUNTIME_READY',
      status: 'SUCCESS',
      durationMs: 1.5,
      isWarmPath: true,
      request: { platform: Platform.OS, bundleVersion: bundleVersion || '1.0.0', isFabric: true },
      response: { engine: 'Chromium/WebKit JSI TurboModule', status: 'ONLINE' },
      lane: 'Host',
      appId: activeTab.appId,
    };
    addIpcMessage(initEntry);
  }, [bundleVersion, activeTab.appId, addIpcMessage]);

  const handleSelectTab = async (tab: MiniAppTab) => {
    setActiveTabId(tab.id);
    setPageLoaded(false);
    appServiceRuntime.setAppId(tab.appId);

    const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const prewarmOk = await goatBridge.prewarm(tab.appId);
    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = parseFloat((endTime - startTime).toFixed(2));

    addIpcMessage({
      id: `tab_prewarm_${Date.now()}`,
      timestamp: Date.now(),
      action: 'TAB_PREWARM_INSTANCE',
      status: prewarmOk ? 'SUCCESS' : 'ERROR',
      durationMs: duration,
      isWarmPath: duration < 5.0,
      request: { targetAppId: tab.appId, route: tab.route },
      response: { prewarmed: prewarmOk, domain: tab.domainName },
      lane: 'Host',
      appId: tab.appId,
    });
  };

  const handlePrewarmEngine = async () => {
    try {
      const startTime = Date.now();
      const ok = await goatBridge.prewarm(activeTab.appId);
      const duration = Date.now() - startTime;
      addIpcMessage({
        id: `prewarm_${Date.now()}`,
        timestamp: Date.now(),
        action: 'ENGINE_PREWARM',
        status: ok ? 'SUCCESS' : 'ERROR',
        durationMs: duration,
        isWarmPath: duration < 5.0,
        request: { appId: activeTab.appId },
        response: { success: ok },
        lane: 'Host',
        appId: activeTab.appId,
      });
      Alert.alert('Goat Engine', ok ? 'Engine instance successfully prewarmed!' : 'Prewarm failed.');
    } catch (err: any) {
      Alert.alert('Engine Error', err?.message || String(err));
    }
  };

  const handleClearCache = async () => {
    const startTime = Date.now();
    const success = await clearCache();
    const duration = Date.now() - startTime;
    addIpcMessage({
      id: `clear_cache_${Date.now()}`,
      timestamp: Date.now(),
      action: 'CACHE_CLEAR_BUNDLE',
      status: success ? 'SUCCESS' : 'ERROR',
      durationMs: duration,
      isWarmPath: duration < 5.0,
      request: { appId: activeTab.appId },
      response: { cleared: success },
      lane: 'Host',
      appId: activeTab.appId,
    });
    Alert.alert('Goat Cache', success ? 'Mini-App cache cleared successfully.' : 'Failed to clear cache.');
  };

  const handleToggleDualThread = () => {
    const next = !isDualThread;
    setIsDualThread(next);
    appServiceRuntime.setEnabled(next);
    addIpcMessage({
      id: `dual_thread_${Date.now()}`,
      timestamp: Date.now(),
      action: 'APP_SERVICE_MODE_TOGGLED',
      status: 'SUCCESS',
      durationMs: 0.8,
      isWarmPath: true,
      request: { dualThreadEnabled: next },
      response: { workerLaneActive: next },
      lane: 'AppService',
      appId: activeTab.appId,
    });
  };

  // Main Native Bridge message dispatcher and Hardware Override interceptor
  const handleBridgeMessage = async (event: { nativeEvent: { action: string; payload: any } }) => {
    const { action, payload } = event.nativeEvent;
    const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const reqId = `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let responseData: any = null;
    let status: 'SUCCESS' | 'ERROR' = 'SUCCESS';
    let errorMessage: string | undefined;

    try {
      // 1. Hardware Overrides Interception: Offline Mode
      if (overridesState.isOffline && !action.includes('STORAGE') && !action.includes('VAULT')) {
        throw new Error('Network connection offline (Simulated via Hardware Overrides)');
      }

      // 2. Domain Action Handlers & Native TurboModule Dispatch
      if (action.includes('PAYMENT') || action.includes('CHECKOUT')) {
        // E-Commerce & Payments Domain
        if (typeof GoatWebViewNativeModule.executeAction === 'function') {
          responseData = await GoatWebViewNativeModule.executeAction(action, payload || {}, activeTab.appId);
        } else {
          responseData = {
            paymentStatus: 'AUTHORIZED',
            transactionId: `tx_bakong_${Date.now().toString(16)}`,
            rail: payload?.rail || 'Bakong_KHQR',
            amount: payload?.amount || 24.50,
            currency: 'USD',
          };
        }
      } else if (action.includes('LOCATION') || action.includes('GPS')) {
        // Field Service & GPS Domain (with GPS spoofer support)
        if (overridesState.mockGps) {
          responseData = {
            latitude: overridesState.mockGps.latitude,
            longitude: overridesState.mockGps.longitude,
            accuracy: overridesState.mockGps.accuracy,
            altitude: overridesState.mockGps.altitude || 10.0,
            isSpoofed: true,
            label: overridesState.mockGps.label,
          };
        } else if (typeof GoatWebViewNativeModule.executeAction === 'function') {
          responseData = await GoatWebViewNativeModule.executeAction(action, payload || {}, activeTab.appId);
        } else {
          responseData = {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 4.8,
            altitude: 12.0,
            isSpoofed: false,
          };
        }
      } else if (action.includes('BIOMETRIC') || action.includes('AUTH')) {
        // Secure Vault & Biometrics Domain (with outcome switcher)
        const bioRes = hardwareOverrides.evaluateBiometrics(payload?.title || 'Vault Authentication');
        if (!bioRes.success) {
          throw new Error(bioRes.error || 'Biometric authentication failed');
        }
        responseData = {
          authenticated: true,
          biometryType: bioRes.biometryType,
          keyStoreToken: `vault_aes_${Date.now()}`,
        };
      } else if (action.includes('BLE') || action.includes('BLUETOOTH')) {
        // IoT & Hardware BLE Domain
        responseData = {
          devices: hardwareOverrides.getMockBlePeripherals(),
          scanning: true,
        };
      } else if (action.includes('NFC')) {
        // IoT & Hardware NFC Domain
        responseData = {
          ndefPayload: overridesState.mockNfcPayload,
          tagType: 'Type4_NDEF',
        };
      } else if (action.includes('MOTION') || action.includes('SENSOR')) {
        // IoT & Hardware 3D Motion Domain
        responseData = {
          ...overridesState.mockMotion,
          timestamp: Date.now(),
        };
      } else {
        // General Native TurboModule execution
        if (typeof GoatWebViewNativeModule.executeAction === 'function') {
          responseData = await GoatWebViewNativeModule.executeAction(action, payload || {}, activeTab.appId);
        } else {
          responseData = { handled: true, action, timestamp: Date.now() };
        }
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMessage = err?.message || String(err);
    }

    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = Math.max(0.1, parseFloat((endTime - startTime).toFixed(2)));

    addIpcMessage({
      id: reqId,
      timestamp: Date.now(),
      action,
      status,
      durationMs: duration,
      isWarmPath: duration < 5.0,
      request: payload,
      response: responseData,
      error: errorMessage,
      lane: 'Host',
      appId: activeTab.appId,
    });
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  const initialUrl = `goat://assets/${activeTab.appId}/index.html${activeTab.route}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Multi-Tab Navigation Bar & Header */}
      <ShowcaseTabs
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onPrewarmEngine={handlePrewarmEngine}
        onClearCache={handleClearCache}
        isPrewarmed={isPrewarmed}
        bundleVersion={bundleVersion || '1.0.0'}
        isDualThread={isDualThread}
        onToggleDualThread={handleToggleDualThread}
      />

      {/* Embedded High-Performance Fabric Mini-App Container */}
      <View style={styles.webviewContainer} testID="goat-webview-container">
        <GoatWebView
          testID="goat-webview-instance"
          appId={activeTab.appId}
          assetBundleName="miniapp.zip"
          style={styles.webview}
          onPageLoaded={(e: { nativeEvent: { url: string } }) => {
            setPageLoaded(true);
            addIpcMessage({
              id: `load_${Date.now()}`,
              timestamp: Date.now(),
              action: 'PAGE_LOADED',
              status: 'SUCCESS',
              durationMs: 2.1,
              isWarmPath: true,
              request: { initialUrl },
              response: { loadedUrl: e.nativeEvent.url },
              lane: 'Host',
              appId: activeTab.appId,
            });
          }}
          onError={(e: { nativeEvent: { description: string } }) => {
            setPageLoaded(false);
            addIpcMessage({
              id: `err_${Date.now()}`,
              timestamp: Date.now(),
              action: 'WEBVIEW_LOAD_ERROR',
              status: 'ERROR',
              durationMs: 0.5,
              isWarmPath: true,
              error: e.nativeEvent.description,
              lane: 'Host',
              appId: activeTab.appId,
            });
          }}
          onBridgeMessage={handleBridgeMessage}
          onAppServiceReady={(e) => {
            addIpcMessage({
              id: `app_ready_${Date.now()}`,
              timestamp: Date.now(),
              action: 'ON_APP_SERVICE_READY',
              status: 'SUCCESS',
              durationMs: 1.0,
              isWarmPath: true,
              response: e.nativeEvent,
              lane: 'AppService',
              appId: activeTab.appId,
            });
          }}
          onAppServiceCrash={(e) => {
            addIpcMessage({
              id: `app_crash_${Date.now()}`,
              timestamp: Date.now(),
              action: 'ON_APP_SERVICE_CRASH',
              status: 'ERROR',
              durationMs: 0.8,
              isWarmPath: true,
              error: e.nativeEvent.error,
              lane: 'AppService',
              appId: activeTab.appId,
            });
          }}
          onAppServiceTerminate={() => {
            addIpcMessage({
              id: `app_term_${Date.now()}`,
              timestamp: Date.now(),
              action: 'ON_APP_SERVICE_TERMINATE',
              status: 'SUCCESS',
              durationMs: 0.5,
              isWarmPath: true,
              lane: 'AppService',
              appId: activeTab.appId,
            });
          }}
          onPopupRequest={(e) => {
            addIpcMessage({
              id: `popup_${Date.now()}`,
              timestamp: Date.now(),
              action: 'ON_POPUP_REQUEST',
              status: 'SUCCESS',
              durationMs: 1.2,
              isWarmPath: true,
              request: e.nativeEvent,
              lane: 'Host',
              appId: activeTab.appId,
            });
          }}
        />

        {/* Loading overlay */}
        {!pageLoaded && (
          <View style={[styles.loadingOverlay, { backgroundColor: currentTheme.background }]}>
            <View style={styles.loadingSpinner}>
              <Text style={styles.loadingEmoji}>🐐</Text>
            </View>
            <Text style={[styles.loadingText, { color: currentTheme.text }]}>
              Initializing {activeTab.domainName}...
            </Text>
            <Text style={[styles.loadingSub, { color: currentTheme.subtext }]}>
              Dynamic Route: {initialUrl}
            </Text>
          </View>
        )}
      </View>

      {/* Floating Developer Debug HUD (R3) */}
      <DebugHUD
        messages={ipcMessages}
        onClearMessages={() => setIpcMessages([])}
        overrides={overridesState}
        appService={appServiceState}
        latencyStats={latencyStats}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
}

const lightTheme = {
  background: '#F8FAFC',
  text: '#0F172A',
  subtext: '#64748B',
};

const darkTheme = {
  background: '#0F172A',
  text: '#F8FAFC',
  subtext: '#94A3B8',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F120',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingEmoji: {
    fontSize: 26,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingSub: {
    fontSize: 11,
    marginTop: 4,
  },
});
