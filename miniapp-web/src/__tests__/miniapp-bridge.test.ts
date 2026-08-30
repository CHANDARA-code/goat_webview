/**
 * Unit Tests for Goat MiniAppBridge TypeScript SDK (Task 10111).
 * Tests bridge IPC request/response mapping, timeout handling, browser mock mode, and typed action helpers.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridge, bridge } from '../miniapp-bridge.js';
import type { DeviceInfo } from '../types.js';

describe('GoatBridge / MiniAppBridge SDK (Task 10111)', () => {
  let testBridge: GoatBridge;

  beforeEach(() => {
    testBridge = new GoatBridge();
  });

  it('should initialize successfully and export singleton instances', () => {
    assert.ok(testBridge);
    assert.ok(bridge);
    assert.strictEqual(typeof testBridge.callNative, 'function');
  });

  it('should resolve mock data in local browser environment without native host', async () => {
    const res = await testBridge.getDeviceInfo();
    assert.ok(res);
    assert.strictEqual(res.platform, 'Android');
    assert.ok(res.model.includes('Pixel') || res.model.includes('Goat'));
    assert.strictEqual(res.installGuid, 'guid-mock-uuidv4-miniapp-web');
  });

  it('should retrieve installGuid via getInstallGuid() helper (Task 10203 / R3)', async () => {
    const guid = await testBridge.getInstallGuid();
    assert.strictEqual(guid, 'guid-mock-uuidv4-miniapp-web');
  });


  it('should execute storage operations via mock fallback', async () => {
    await testBridge.setStorage('theme', 'dark');
    const value = await testBridge.getStorage('theme');
    assert.strictEqual(value, 'dark');

    const info = await testBridge.getStorageInfo();
    assert.ok(info.keys.includes('theme'));

    await testBridge.removeStorage('theme');
    const clearedValue = await testBridge.getStorage('theme');
    assert.strictEqual(clearedValue, null);
  });

  it('should handle permission manifest checks and authorizations (Task 10101)', async () => {
    const checkRes = await testBridge.checkPermission('scope.camera');
    assert.strictEqual(checkRes.scope, 'scope.camera');
    assert.strictEqual(checkRes.granted, true);

    const reqRes = await testBridge.requestPermission('scope.camera');
    assert.strictEqual(reqRes.granted, true);
    assert.strictEqual(reqRes.isDeclaredInManifest, true);

    const settings = await testBridge.getSetting();
    assert.strictEqual(settings.authSetting['scope.camera'], true);
  });

  it('should handle keyboard insets sync (Task 10068)', async () => {
    const setRes = await testBridge.setKeyboardInsets(500, 250);
    assert.strictEqual(setRes.isVisible, true);
    assert.strictEqual(setRes.heightPx, 500);

    const getRes = await testBridge.getKeyboardInsets();
    assert.ok(getRes.adjustedViewportBottomInset !== undefined);
  });

  it('should handle predictive back navigation (Task 10126)', async () => {
    const progRes = await testBridge.predictiveBackProgress({ progress: 0.7, swipeEdge: 0 });
    assert.strictEqual(progRes.progress, 0.7);

    const invokeRes = await testBridge.predictiveBackInvoke();
    assert.strictEqual(invokeRes.action, 'COMMITTED');

    const cancelRes = await testBridge.predictiveBackCancel();
    assert.strictEqual(cancelRes.action, 'CANCELLED');
  });

  it('should validate WebAssembly SIMD and audit sandbox headers (Task 10132)', async () => {
    const wasmRes = await testBridge.validateWasmSupport();
    assert.strictEqual(wasmRes.wasmSupported, true);
    assert.strictEqual(wasmRes.simdSupported, true);

    const auditRes = await testBridge.auditSandboxHeaders({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    });
    assert.strictEqual(auditRes.isIsolatedContext, true);
    assert.strictEqual(auditRes.status, 'CROSS_ORIGIN_ISOLATED');
  });

  it('should dispatch and subscribe to custom bridge events', (_t, done) => {
    const handler = (payload: any) => {
      assert.strictEqual(payload.height, 300);
      testBridge.off('onKeyboardHeightChange', handler);
      done();
    };

    testBridge.on('onKeyboardHeightChange', handler);
    testBridge.emit('onKeyboardHeightChange', { height: 300 });
  });

  it('should handle binary channel operations (Task 10130)', async () => {
    const createRes = await testBridge.createBinaryPort('port_test');
    assert.strictEqual(createRes, true);

    const postRes = await testBridge.postBinaryMessage('port_test', 'AQIDBA==');
    assert.strictEqual(postRes.posted, true);

    const closeRes = await testBridge.closeBinaryPort('port_test');
    assert.strictEqual(closeRes, true);
  });

  it('should handle V8 bytecode precompile actions (Task 10084)', async () => {
    const stats = await testBridge.getBytecodeStats();
    assert.strictEqual(stats.isWarm, true);
    assert.strictEqual(stats.totalCachedBundles, 1);

    const warm = await testBridge.isBytecodeWarm('default');
    assert.strictEqual(warm.isWarm, true);
  });

  it('should handle file chooser and cancel interactions (Task 10076)', async () => {
    const cancelRes = await testBridge.cancelFileChooser();
    assert.strictEqual(cancelRes.cancelled, true);

    const chooseRes = await testBridge.chooseFiles(['content://media/external/1']);
    assert.strictEqual(chooseRes.isSuccess, true);
    assert.strictEqual(chooseRes.totalFiles, 1);
  });

  it('should handle native back navigation coordinator (Task 10094)', async () => {
    const pushRes = await testBridge.pushHistoryState('/profile');
    assert.strictEqual(pushRes.route, '/profile');

    const backRes = await testBridge.handleBackPress();
    assert.strictEqual(backRes.action, 'WEB_HISTORY_POP');

    const canGoBack = await testBridge.canGoBack();
    assert.strictEqual(canGoBack.canGoBack, true);
  });

  it('should configure canvas transparency and render layer (Task 10113)', async () => {
    const config = await testBridge.getRenderLayerConfig();
    assert.strictEqual(config.isTransparent, true);
    assert.strictEqual(config.isWhiteFlashPrevented, true);

    const themeSync = await testBridge.syncThemeBackground(true);
    assert.strictEqual(themeSync.isWhiteFlashPrevented, true);
  });

  it('should handle gesture and scroll synchronization (Task 10079)', async () => {
    const state = await testBridge.updateGestureScroll(150, 600);
    assert.strictEqual(state.scrollOffsetPx, 150);

    const intercept = await testBridge.shouldParentIntercept(10, false);
    assert.strictEqual(intercept.shouldIntercept, false);

    const reset = await testBridge.resetGestureCoordinator();
    assert.strictEqual(reset.reset, true);
  });

  it('should manage multi-WebView native page stack (Task 10091)', async () => {
    const pushRes = await testBridge.navPush('/details', 'Product Details');
    assert.strictEqual(pushRes.action, 'NAV_PUSH');
    assert.strictEqual(pushRes.stackDepth, 2);

    const stack = await testBridge.getPageStack();
    assert.strictEqual(stack.totalCount, 1);

    const popRes = await testBridge.navPop();
    assert.strictEqual(popRes.action, 'NAV_POP');
  });

  it('should handle subpackage on-demand loading (Task 10092)', async () => {
    const loadRes = await testBridge.loadSubpackage('game_module');
    assert.strictEqual(loadRes.isSuccess, true);
    assert.strictEqual(loadRes.subpackageName, 'game_module');

    const cached = await testBridge.isSubpackageCached('game_module');
    assert.strictEqual(cached.isCached, true);
  });

  it('should manage same-layer native component rendering (Task 10100)', async () => {
    const embedRes = await testBridge.embedNativeView('video_1', 'EXO_PLAYER', { width: 320, height: 200 });
    assert.strictEqual(embedRes.componentId, 'video_1');
    assert.strictEqual(embedRes.componentType, 'EXO_PLAYER');

    const updateRes = await testBridge.updateNativeViewBounds('video_1', { width: 320, height: 200, isVisible: true });
    assert.strictEqual(updateRes.updated, true);

    const removeRes = await testBridge.removeNativeView('video_1');
    assert.strictEqual(removeRes.removed, true);
  });

  it('should query SuperApp API capabilities & dispatcher (Task 10102)', async () => {
    const check = await testBridge.canIUse('BIOMETRIC_AUTH');
    assert.strictEqual(check, true);

    const caps = await testBridge.getApiCapabilities('SECURITY');
    assert.strictEqual(caps.totalCapabilities, 10);
    assert.strictEqual(caps.capabilities[0].actionName, 'BIOMETRIC_AUTH');
  });

  it('should query multi-process isolation status (Task 10090)', async () => {
    const status = await testBridge.getSandboxProcessStatus();
    assert.strictEqual(status.isAlive, true);
    assert.strictEqual(status.isolatedProcessName, ':goat_miniapp_process');
  });

  it('should query startup macrobenchmark SLA report (Task 10085)', async () => {
    const report = await testBridge.getStartupBenchmarkReport();
    assert.strictEqual(report.isColdBootWithinSla, true);
    assert.strictEqual(report.isWarmBootWithinSla, true);
    assert.strictEqual(report.isMemoryWithinSla, true);
  });

  it('should handle Navigation Bar bridge methods (Milestone 2/3)', async () => {
    const titleRes = await testBridge.setNavBarTitle({ title: 'MiniApp Home', subtitle: 'Online' });
    assert.strictEqual(titleRes.title, 'MiniApp Home');
    assert.strictEqual(titleRes.subtitle, 'Online');

    const colorRes = await testBridge.setNavBarColor({
      backgroundColor: '#0F172A',
      textColor: '#FFFFFF',
      isDark: true
    });
    assert.strictEqual(colorRes.backgroundColor, '#0F172A');
    assert.strictEqual(colorRes.textColor, '#FFFFFF');
    assert.strictEqual(colorRes.isDark, true);

    const btnRes = await testBridge.setNavBarButtons({ left: 'BACK', right: ['MORE', 'CLOSE'] });
    assert.strictEqual(btnRes.left, 'BACK');
    assert.deepStrictEqual(btnRes.right, ['MORE', 'CLOSE']);

    const progRes = await testBridge.setNavBarProgress(true, 50);
    assert.strictEqual(progRes.visible, true);
    assert.strictEqual(progRes.progress, 50);

    const fullNavRes = await testBridge.setNavBar({ title: 'Updated' });
    assert.strictEqual(fullNavRes, true);
  });

  it('should handle Bottom Sheet bridge methods (Milestone 2/3)', async () => {
    const snapRes = await testBridge.setSheetSnapPoints({ snapPoints: [0.25, 0.5, 0.9], initialSnap: 0.5 });
    assert.deepStrictEqual(snapRes.snapPoints, [0.25, 0.5, 0.9]);
    assert.strictEqual(snapRes.initialSnap, 0.5);

    const expandRes = await testBridge.expandBottomSheet(0.9);
    assert.strictEqual(expandRes.currentSnap, 0.9);
    assert.strictEqual(expandRes.sheetValue, 'EXPANDED');

    const collapseRes = await testBridge.collapseBottomSheet();
    assert.strictEqual(collapseRes.currentSnap, 0.25);
    assert.strictEqual(collapseRes.sheetValue, 'COLLAPSED');
  });

  it('should handle Haptic Waveform Engine methods (Milestone 2/3)', async () => {
    const impactRes = await testBridge.triggerImpact('light');
    assert.strictEqual(impactRes.triggered, true);
    assert.strictEqual(impactRes.style, 'light');

    const notifRes = await testBridge.triggerNotification('warning');
    assert.strictEqual(notifRes.triggered, true);
    assert.strictEqual(notifRes.notificationType, 'warning');

    const selectRes = await testBridge.triggerSelection();
    assert.strictEqual(selectRes.triggered, true);
    assert.strictEqual(selectRes.type, 'selection');
  });

  it('should handle Safe Area Insets and Headless execution (Milestone 1/2/3)', async () => {
    const insets = await testBridge.getSafeAreaInsets();
    assert.strictEqual(insets.top, 48);
    assert.strictEqual(insets.bottom, 34);
    assert.strictEqual(insets.totalBottom, 34);

    const headlessRes = await testBridge.executeHeadlessAction<DeviceInfo>('GET_DEVICE_INFO', {});
    assert.ok(headlessRes);
    assert.strictEqual(headlessRes.platform, 'Android');
  });
});

describe('GoatBridge — pending bridge queue buffering & flush (BLK-P1-19)', () => {
  let fakeWindow: any;
  let nativeBridgeObj: any;
  let posted: string[];
  let messageListeners: Array<(event: any) => void>;

  beforeEach(() => {
    posted = [];
    messageListeners = [];
    nativeBridgeObj = {
      postMessage: (message: string) => {
        posted.push(message);
      },
      addEventListener: (type: string, listener: (event: any) => void) => {
        if (type === 'message') messageListeners.push(listener);
      },
      removeEventListener: () => {},
    };
    fakeWindow = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).window = fakeWindow;
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('buffers callNative when the native bridge is absent and flushes once it attaches', async () => {
    const bridge = new GoatBridge();
    const result = bridge.callNative<{ echo: string }>('GET_DEVICE_INFO', { hello: 1 }, 5000);

    await new Promise((res) => setTimeout(res, 100));
    assert.strictEqual(posted.length, 0);

    fakeWindow.nativeBridge = nativeBridgeObj;
    await new Promise((res) => setTimeout(res, 150));

    assert.strictEqual(posted.length, 1);
    const flushed = JSON.parse(posted[0]);
    assert.strictEqual(flushed.action, 'GET_DEVICE_INFO');
    assert.deepStrictEqual(flushed.payload, { hello: 1 });
    assert.strictEqual(messageListeners.length, 1);

    messageListeners[0]({
      data: JSON.stringify({ id: flushed.id, success: true, data: { echo: 'flushed' } }),
    });

    const value = await result;
    assert.strictEqual(value.echo, 'flushed');
  });

  it('keeps mock resolution in explicit mock mode even when window exists', async () => {
    const bridge = new GoatBridge({ mockNative: true });
    const info = await bridge.getDeviceInfo();
    assert.strictEqual(info.platform, 'Android');
  });

  it('resolves buffered calls even when the bridge attaches between two dispatches', async () => {
    const bridge = new GoatBridge();
    const first = bridge.callNative<{ seq: number }>('SEQ_ACTION', { seq: 1 }, 5000);
    fakeWindow.nativeBridge = nativeBridgeObj;
    await new Promise((res) => setTimeout(res, 120));
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(JSON.parse(posted[0]).payload.seq, 1);

    const second = bridge.callNative<{ seq: number }>('SEQ_ACTION', { seq: 2 }, 5000);
    assert.strictEqual(posted.length, 2);
    assert.strictEqual(JSON.parse(posted[1]).payload.seq, 2);

    const firstPosted = JSON.parse(posted[0]);
    messageListeners[0]({
      data: JSON.stringify({ id: firstPosted.id, success: true, data: { seq: 1 } }),
    });
    const firstValue = await first;
    assert.strictEqual(firstValue.seq, 1);

    const secondPosted = JSON.parse(posted[1]);
    messageListeners[0]({
      data: JSON.stringify({ id: secondPosted.id, success: true, data: { seq: 2 } }),
    });
    const secondValue = await second;
    assert.strictEqual(secondValue.seq, 2);
  });
});

describe('GoatBridge — native_call CustomEvent dispatch (BLK-P1-10)', () => {
  let listeners: Map<string, Array<(event: any) => void>>;

  beforeEach(() => {
    listeners = new Map();
    const fakeWindow: any = {
      addEventListener(type: string, listener: (event: any) => void) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type)!.push(listener);
      },
      removeEventListener() {},
      dispatchEvent(event: any) {
        for (const listener of listeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      },
    };
    (globalThis as any).window = fakeWindow;
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('routes native_call CustomEvents to action and message listeners', () => {
    const bridge = new GoatBridge();
    const actionEvents: any[] = [];
    const messageEvents: any[] = [];

    bridge.on('ON_NETWORK_CHANGE', (payload: any) => actionEvents.push(payload));
    bridge.on('message', (payload: any) => messageEvents.push(payload));

    const detail = { action: 'ON_NETWORK_CHANGE', payload: { isConnected: true, networkType: 'wifi' } };
    (globalThis as any).window.dispatchEvent({ type: 'native_call', detail });

    assert.strictEqual(actionEvents.length, 1);
    assert.deepStrictEqual(actionEvents[0], { isConnected: true, networkType: 'wifi' });
    assert.strictEqual(messageEvents.length, 1);
    assert.strictEqual(messageEvents[0].action, 'ON_NETWORK_CHANGE');
  });

  it('defaults missing payload to empty object', () => {
    const bridge = new GoatBridge();
    const received: any[] = [];
    bridge.on('ON_THEME_CHANGE', (payload: any) => received.push(payload));

    (globalThis as any).window.dispatchEvent({ type: 'native_call', detail: { action: 'ON_THEME_CHANGE' } });

    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], {});
  });

  it('ignores native_call events without an action field', () => {
    const bridge = new GoatBridge();
    let messageCount = 0;
    bridge.on('message', () => { messageCount++; });

    (globalThis as any).window.dispatchEvent({ type: 'native_call', detail: { payload: { stray: true } } });
    (globalThis as any).window.dispatchEvent({ type: 'native_call', detail: {} });
    (globalThis as any).window.dispatchEvent({ type: 'native_call' });

    assert.strictEqual(messageCount, 0);
  });

  it('coexists with the nativeBridge message channel', () => {
    const messageListener: Array<(event: any) => void> = [];
    (globalThis as any).window.nativeBridge = {
      postMessage: () => {},
      addEventListener: (type: string, listener: (event: any) => void) => {
        if (type === 'message') messageListener.push(listener);
      },
      removeEventListener: () => {},
    };
    const bridge = new GoatBridge();
    const received: any[] = [];
    bridge.on('ON_LOCATION_UPDATE', (payload: any) => received.push(payload));

    (globalThis as any).window.dispatchEvent({ type: 'native_call', detail: { action: 'ON_LOCATION_UPDATE', payload: { latitude: 37.77, longitude: -122.41 } } });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].latitude, 37.77);
    assert.ok(messageListener.length >= 1);

    delete (globalThis as any).window.nativeBridge;
  });
});

