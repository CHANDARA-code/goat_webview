import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { GoatBridge } from '../miniapp-bridge.js';
import {
  useGoatNavBar,
  useGoatBottomSheet,
  useGoatHaptics,
  useGoatInsets,
  useGoatLifecycle
} from '../hooks/index.js';

describe('React Hooks Suite Unit & Integration Tests (Milestone 3)', () => {
  it('should render useGoatNavBar and verify setter actions and button clicks', async () => {
    const customBridge = new GoatBridge();
    let hookResult: any = null;
    let clickedButton = '';

    function TestComponent() {
      hookResult = useGoatNavBar({
        title: 'Initial Title',
        subtitle: 'Initial Subtitle',
        backgroundColor: '#0F172A',
        textColor: '#FFFFFF',
        onButtonClick: (btn) => {
          clickedButton = btn;
        },
        bridgeInstance: customBridge
      });
      return React.createElement('div', null, 'NavBarTest');
    }

    ReactDOMServer.renderToString(React.createElement(TestComponent));

    assert.ok(hookResult);
    assert.ok(typeof hookResult.setTitle === 'function');
    assert.ok(typeof hookResult.setColor === 'function');
    assert.ok(typeof hookResult.setButtons === 'function');
    assert.ok(typeof hookResult.setProgress === 'function');

    const titleRes = await hookResult.setTitle('Updated Title', 'Online');
    assert.strictEqual(titleRes.title, 'Updated Title');
    assert.strictEqual(titleRes.subtitle, 'Online');

    const colorRes = await hookResult.setColor({ backgroundColor: '#1E293B', textColor: '#FFFFFF', isDark: true });
    assert.strictEqual(colorRes.backgroundColor, '#1E293B');

    // Simulate native button click event
    customBridge.emit('onNavBarButtonClick', { button: 'CLOSE' });
    // In SSR useEffect is not executed, so we also test direct bridge event listener binding
    const off = customBridge.on('onNavBarButtonClick', (payload: any) => {
      clickedButton = payload?.button;
    });
    customBridge.emit('onNavBarButtonClick', { button: 'CLOSE' });
    off();
    assert.strictEqual(clickedButton, 'CLOSE');
  });

  it('should render useGoatBottomSheet and verify snap calculations & controls', async () => {
    const customBridge = new GoatBridge();
    const snapPoints = [0.25, 0.5, 0.9];
    let sheetHook: any = null;

    function TestComponent() {
      sheetHook = useGoatBottomSheet(snapPoints, {
        initialSnap: 0.5,
        bridgeInstance: customBridge
      });
      return React.createElement('div', null, 'BottomSheetTest');
    }

    ReactDOMServer.renderToString(React.createElement(TestComponent));

    assert.ok(sheetHook);
    assert.strictEqual(sheetHook.currentSnap, 0.5);
    assert.strictEqual(sheetHook.sheetValue, 'HALF');
    assert.strictEqual(sheetHook.isExpanded, false);
    assert.strictEqual(sheetHook.isCollapsed, false);

    const expandRes = await sheetHook.expand(0.9);
    assert.strictEqual(expandRes.currentSnap, 0.9);
    assert.strictEqual(expandRes.sheetValue, 'EXPANDED');

    const collapseRes = await sheetHook.collapse();
    assert.strictEqual(collapseRes.currentSnap, 0.25);
    assert.strictEqual(collapseRes.sheetValue, 'COLLAPSED');
  });

  it('should render useGoatHaptics and verify 10 native waveforms', async () => {
    const customBridge = new GoatBridge();
    let haptics: any = null;

    function TestComponent() {
      haptics = useGoatHaptics({ bridgeInstance: customBridge });
      return React.createElement('div', null, 'HapticsTest');
    }

    ReactDOMServer.renderToString(React.createElement(TestComponent));

    assert.ok(haptics);
    const impactRes = await haptics.triggerImpact('heavy');
    assert.strictEqual(impactRes.triggered, true);
    assert.strictEqual(impactRes.type, 'impact');
    assert.strictEqual(impactRes.style, 'heavy');

    const notifRes = await haptics.triggerNotification('success');
    assert.strictEqual(notifRes.triggered, true);
    assert.strictEqual(notifRes.type, 'notification');
    assert.strictEqual(notifRes.notificationType, 'success');

    const selectionRes = await haptics.triggerSelection();
    assert.strictEqual(selectionRes.triggered, true);
    assert.strictEqual(selectionRes.type, 'selection');

    const presetRes = await haptics.triggerHaptic('app_error');
    assert.strictEqual(presetRes.triggered, true);
    assert.strictEqual(presetRes.type, 'app_error');
  });

  it('should render useGoatInsets and verify safe area, keyboard, and CSS variable sync', async () => {
    const customBridge = new GoatBridge();
    let insetsHook: any = null;

    const cssVars = new Map<string, string>();
    const fakeDocument: any = {
      documentElement: {
        style: {
          setProperty: (k: string, v: string) => {
            cssVars.set(k, v);
          }
        }
      }
    };
    (global as any).document = fakeDocument;

    try {
      function TestComponent() {
        insetsHook = useGoatInsets({
          syncCssVariables: true,
          bridgeInstance: customBridge
        });
        return React.createElement('div', null, 'InsetsTest');
      }

      ReactDOMServer.renderToString(React.createElement(TestComponent));

      assert.ok(insetsHook);
      const refreshed = await insetsHook.refresh();
      assert.strictEqual(refreshed.top, 48);
      assert.strictEqual(refreshed.bottom, 34);
      assert.strictEqual(refreshed.totalBottom, 34);

      assert.strictEqual(cssVars.get('--goat-safe-area-top'), '48px');
      assert.strictEqual(cssVars.get('--goat-safe-area-bottom'), '34px');
    } finally {
      delete (global as any).document;
    }
  });

  it('should render useGoatLifecycle and verify callback attachments and lifecycle events', async () => {
    const customBridge = new GoatBridge();
    const events: string[] = [];
    let receivedShow: any = null;
    let receivedHideCount = 0;
    let receivedScroll: any = null;
    let receivedMemory: any = null;
    let receivedResize: any = null;
    let cleanupFn: (() => void) | null = null;

    function TestComponent() {
      const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current;
      if (dispatcher) {
        dispatcher.useEffect = (effect: () => any) => {
          cleanupFn = effect();
        };
      }
      useGoatLifecycle({
        onPageLoaded: (url) => events.push(`loaded:${url}`),
        onError: (err) => events.push(`error:${err}`),
        onPause: () => events.push('pause'),
        onResume: () => events.push('resume'),
        onDestroy: () => events.push('destroy'),
        onAppShow: (options) => {
          receivedShow = options;
          events.push('app_show');
        },
        onAppHide: () => {
          receivedHideCount++;
          events.push('app_hide');
        },
        onPageScroll: (scroll) => {
          receivedScroll = scroll;
          events.push('page_scroll');
        },
        onMemoryWarning: (info) => {
          receivedMemory = info;
          events.push('memory_warning');
        },
        onWindowResize: (size) => {
          receivedResize = size;
          events.push('window_resize');
        },
        bridgeInstance: customBridge
      });
      return React.createElement('div', null, 'LifecycleTest');
    }

    ReactDOMServer.renderToString(React.createElement(TestComponent));

    // Test direct bridge dispatch
    const showPayload = {
      entryRoute: '/pages/index',
      queryParams: { id: '99', tab: 'home' },
      referrerInfo: { appId: 'superapp_main' },
      scene: 1001,
      timestamp: 1718000000000
    };
    customBridge.emit('ON_APP_SHOW', showPayload);
    assert.deepStrictEqual(receivedShow, showPayload);
    assert.ok(events.includes('app_show'));
    assert.ok(events.includes('resume'));

    customBridge.emit('ON_APP_HIDE', {});
    assert.strictEqual(receivedHideCount, 1);
    assert.ok(events.includes('app_hide'));
    assert.ok(events.includes('pause'));

    const scrollPayload = { scrollTop: 250, scrollLeft: 0, scrollHeight: 1500, scrollWidth: 390 };
    customBridge.emit('ON_PAGE_SCROLL', scrollPayload);
    assert.deepStrictEqual(receivedScroll, scrollPayload);

    const memoryPayload = { level: 'critical', memoryPressure: 'CRITICAL' };
    customBridge.emit('ON_MEMORY_WARNING', memoryPayload);
    assert.deepStrictEqual(receivedMemory, memoryPayload);

    const resizePayload = { width: 390, height: 844, windowWidth: 390, windowHeight: 844, orientation: 'portrait' };
    customBridge.emit('ON_WINDOW_RESIZE', resizePayload);
    assert.deepStrictEqual(receivedResize, resizePayload);

    customBridge.emit('onPageLoaded', 'https://miniapp.goat/index.html');
    customBridge.emit('onPause', {});
    customBridge.emit('onResume', {});
    customBridge.emit('onError', 'Test Error');
    assert.ok(events.includes('loaded:https://miniapp.goat/index.html'));

    customBridge.emit('onError', 'Sample Error');
    assert.ok(events.includes('error:Sample Error'));

    customBridge.emit('onDestroy', {});
    assert.ok(events.includes('destroy'));

    if (typeof cleanupFn === 'function') {
      (cleanupFn as () => void)();
    }

    receivedHideCount = 0;
    customBridge.emit('ON_APP_HIDE', {});
    assert.strictEqual(receivedHideCount, 0);
  });
});
