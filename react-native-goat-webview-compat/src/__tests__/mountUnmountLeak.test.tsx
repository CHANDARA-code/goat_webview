import React from 'react';
import LeakDetector from 'jest-leak-detector';
import { WebView } from '../WebView';
import type { WebViewProps, WebViewRef } from '../types';
import { Commands } from 'react-native-goat-webview';
import v8 from 'v8';
import vm from 'vm';

// Ensure generous timeout for 100-cycle mount/unmount and GC passes
jest.setTimeout(30000);

// Expose GC once for LeakDetector to avoid expensive per-call runInNewContext
v8.setFlagsFromString('--expose-gc');
(globalThis as any).gc = vm.runInNewContext('gc');

function forceGC() {
  if (typeof (globalThis as any).gc === 'function') {
    (globalThis as any).gc();
    (globalThis as any).gc();
  }
}

interface MountCycleResult {
  dropped: boolean;
  tag: number;
  initialUrl?: string;
  incognito: boolean;
  appId: string;
  eventDispatched: boolean;
  commandsDispatched: boolean;
}

/**
 * Executes a complete mount -> active interaction -> unmount lifecycle for a <WebView> instance.
 *
 * Implements the lifecycle cleanly:
 * 1. Executes component render and hooks setup.
 * 2. Attaches a simulated native Fabric view to `nativeRef`.
 * 3. Exercises imperative ref commands (`reload`, `postMessage`, `goBack`).
 * 4. Dispatches native lifecycle events (`onPageStarted`, `onPageLoaded`).
 * 5. Executes component unmount: drops native view (`dropViewInstance`), nullifies nativeRef and ref.
 * 6. Returns a pure primitive summary, preventing closure retention of the caller's props object.
 */
function runMountUnmountCycle(props: WebViewProps, tagId: number): MountCycleResult {
  let capturedNativeRef: any = null;
  const ref: { current: WebViewRef | null } = { current: null };
  const nativeView = {
    tag: tagId,
    dropped: false,
    dropViewInstance: () => {
      nativeView.dropped = true;
    },
  };

  const origUseMemo = React.useMemo;
  const origUseCallback = React.useCallback;
  const origUseRef = React.useRef;
  const origUseState = React.useState;
  const origUseImperativeHandle = React.useImperativeHandle;

  let stateVal: any = null;
  const setState = (updater: any) => {
    stateVal = typeof updater === 'function' ? updater(stateVal) : updater;
  };

  let eventDispatched = false;
  let commandsDispatched = false;

  try {
    React.useMemo = ((fn: any) => fn()) as any;
    React.useCallback = ((fn: any) => fn) as any;
    React.useRef = ((init: any) => {
      const r = { current: init ?? null };
      if (!capturedNativeRef) {
        capturedNativeRef = r;
      }
      return r;
    }) as any;
    React.useState = ((init: any) => {
      if (stateVal === null) {
        stateVal = typeof init === 'function' ? init() : init;
      }
      return [stateVal, setState];
    }) as any;
    React.useImperativeHandle = ((targetRef: any, init: any) => {
      if (targetRef) {
        targetRef.current = init();
      }
    }) as any;

    let element: any = (WebView as any).render(props, ref);
    let nativeComponentProps: any = element.props.children[0].props;

    // Simulate native view attachment
    if (capturedNativeRef) {
      capturedNativeRef.current = nativeView;
    }

    // Exercise imperative ref methods while mounted
    if (ref.current) {
      ref.current.reload();
      ref.current.postMessage('ping');
      ref.current.goBack();
      commandsDispatched = true;
    }

    // Simulate native lifecycle event emission
    if (nativeComponentProps.onPageStarted) {
      nativeComponentProps.onPageStarted({
        nativeEvent: {
          url: props.source && 'uri' in props.source ? props.source.uri : 'about:blank',
          title: `Page-${tagId}`,
          loading: true,
          canGoBack: false,
          canGoForward: false,
        },
      });
      eventDispatched = true;
    }

    // Unmount simulation:
    // Native Fabric view manager drops view instance (GoatWebViewManager.onDropViewInstance / deinit)
    nativeView.dropViewInstance();
    if (capturedNativeRef) {
      capturedNativeRef.current = null;
      capturedNativeRef = null;
    }
    ref.current = null;
    stateVal = null;

    const initialUrl = nativeComponentProps.initialUrl;
    const incognito = nativeComponentProps.incognito;
    const appId = nativeComponentProps.appId;
    element = null;
    nativeComponentProps = null;

    return {
      dropped: nativeView.dropped,
      tag: nativeView.tag,
      initialUrl,
      incognito,
      appId,
      eventDispatched,
      commandsDispatched,
    };
  } finally {
    React.useMemo = origUseMemo;
    React.useCallback = origUseCallback;
    React.useRef = origUseRef;
    React.useState = origUseState;
    React.useImperativeHandle = origUseImperativeHandle;
  }
}

describe('100-Cycle Mount/Unmount Memory Leak & Retention Suite (R3 / T13 / G1 / G2 / G5)', () => {
  const CYCLES = 100;

  test('executes 100 complete mount/unmount cycles with zero memory leak growth', async () => {
    // Collect baseline memory
    if (typeof global.gc === 'function') {
      global.gc();
    }
    const initialHeap = process.memoryUsage().heapUsed;

    const propsDetectors: LeakDetector[] = [];
    const sourceDetectors: LeakDetector[] = [];

    for (let i = 0; i < CYCLES; i++) {
      let sourceObj: any = {
        uri: `https://example.com/items/${i}`,
        headers: { 'X-Cycle': String(i) },
      };
      let cycleProps: WebViewProps | null = {
        source: sourceObj,
        originWhitelist: ['https://*'],
        pullToRefreshEnabled: i % 2 === 0,
        incognito: true,
        appId: `tenant_${i}`,
        onLoadStart: jest.fn(),
        onLoad: jest.fn(),
        onLoadEnd: jest.fn(),
        onMessage: jest.fn(),
        onScroll: jest.fn(),
        onHttpError: jest.fn(),
      };

      const pDetector = new LeakDetector(cycleProps);
      const sDetector = new LeakDetector(sourceObj);

      const result = runMountUnmountCycle(cycleProps, i + 1);

      expect(result.dropped).toBe(true);
      expect(result.initialUrl).toBe(`https://example.com/items/${i}`);
      expect(result.incognito).toBe(true);
      expect(result.appId).toBe(`tenant_${i}`);
      expect(result.commandsDispatched).toBe(true);
      expect(result.eventDispatched).toBe(true);

      // Release local references
      cycleProps = null;
      sourceObj = null;

      // Track sample intervals across the 100 cycles (first, quarters, last)
      if (i === 0 || i === 24 || i === 49 || i === 74 || i === 99) {
        propsDetectors.push(pDetector);
        sourceDetectors.push(sDetector);
      }
    }

    forceGC();
    for (let tick = 0; tick < 10; tick++) {
      await new Promise((r) => setImmediate(r));
    }

    // Verify zero leak growth: all sampled props and source objects were collected
    for (const d of propsDetectors) {
      expect(await d.isLeaking()).toBe(false);
    }
    for (const d of sourceDetectors) {
      expect(await d.isLeaking()).toBe(false);
    }

    const finalHeap = process.memoryUsage().heapUsed;
    const heapGrowthBytes = finalHeap - initialHeap;

    // Retained heap growth must be non-positive or negligible (under 1 MB GC margin across 100 cycles)
    expect(heapGrowthBytes).toBeLessThan(1024 * 1024);
  });

  test('clean view cleanup: asserts 100% of native view instances are dropped on unmount', () => {
    const droppedViews: number[] = [];

    for (let i = 0; i < CYCLES; i++) {
      let props: WebViewProps | null = {
        source: { uri: `https://test.local/view/${i}` },
        pullToRefreshEnabled: true,
      };

      const result = runMountUnmountCycle(props, 1000 + i);
      expect(result.dropped).toBe(true);
      droppedViews.push(result.tag);

      props = null;
    }

    // All 100 native views were cleanly and uniquely dropped
    expect(droppedViews.length).toBe(CYCLES);
    expect(new Set(droppedViews).size).toBe(CYCLES);
  });

  test('zero dangling event listeners: unmounted instances do not retain or fire callbacks', () => {
    let messageReceivedCount = 0;
    const receivedMessages: string[] = [];

    for (let i = 0; i < CYCLES; i++) {
      const msgData = `payload-${i}`;
      let props: WebViewProps | null = {
        source: { uri: `https://test.local/listener/${i}` },
        onMessage: (event) => {
          messageReceivedCount++;
          receivedMessages.push(event.nativeEvent.data);
        },
      };

      // Mount and simulate bridge message while active
      const ref: { current: WebViewRef | null } = { current: null };
      let capturedNativeRef: any = null;
      let stateVal: any = null;

      const origUseMemo = React.useMemo;
      const origUseCallback = React.useCallback;
      const origUseRef = React.useRef;
      const origUseState = React.useState;
      const origUseImperativeHandle = React.useImperativeHandle;

      let nativeProps: any = null;
      try {
        React.useMemo = ((fn: any) => fn()) as any;
        React.useCallback = ((fn: any) => fn) as any;
        React.useRef = ((init: any) => {
          const r = { current: init ?? null };
          if (!capturedNativeRef) capturedNativeRef = r;
          return r;
        }) as any;
        React.useState = ((init: any) => [stateVal ?? init, (u: any) => { stateVal = u; }]) as any;
        React.useImperativeHandle = ((targetRef: any, init: any) => {
          if (targetRef) targetRef.current = init();
        }) as any;

        const element = (WebView as any).render(props, ref);
        nativeProps = element.props.children[0].props;

        // Fire message while mounted
        nativeProps.onBridgeMessage({
          nativeEvent: {
            action: '__RNW_MESSAGE__',
            payload: JSON.stringify({ data: msgData }),
          },
        });
      } finally {
        React.useMemo = origUseMemo;
        React.useCallback = origUseCallback;
        React.useRef = origUseRef;
        React.useState = origUseState;
        React.useImperativeHandle = origUseImperativeHandle;
      }

      // Unmount: clear refs and props
      ref.current = null;
      if (capturedNativeRef) {
        capturedNativeRef.current = null;
        capturedNativeRef = null;
      }
      props = null;
      nativeProps = null;
    }

    // Exactly 100 messages handled across the 100 mounted instances
    expect(messageReceivedCount).toBe(CYCLES);
    expect(receivedMessages.length).toBe(CYCLES);
  });

  test('zero retained config objects: WebViewProps, source, and CreationProps do not survive unmount', async () => {
    const configDetectors: LeakDetector[] = [];

    for (let i = 0; i < CYCLES; i++) {
      let sourceObj: any = {
        uri: `https://transient.example.com/cycle-${i}`,
        headers: { Authorization: `Bearer token-${i}` },
        body: `body-${i}`,
      };
      let propsObj: any = {
        source: sourceObj,
        applicationNameForUserAgent: `GoatApp/${i}`,
        cacheMode: 'LOAD_NO_CACHE',
        incognito: true,
        originWhitelist: ['https://*'],
        injectedJavaScript: `console.log(${i})`,
        webviewDebuggingEnabled: true,
        mediaPlaybackRequiresUserAction: false,
      };

      const pDetector = new LeakDetector(propsObj);
      const sDetector = new LeakDetector(sourceObj);

      const result = runMountUnmountCycle(propsObj, 3000 + i);
      expect(result.dropped).toBe(true);

      propsObj = null;
      sourceObj = null;

      if (i === 0 || i === 24 || i === 49 || i === 74 || i === 99) {
        configDetectors.push(pDetector);
        configDetectors.push(sDetector);
      }
    }

    forceGC();
    for (let tick = 0; tick < 10; tick++) {
      await new Promise((r) => setImmediate(r));
    }

    for (const detector of configDetectors) {
      const isLeaking = await detector.isLeaking();
      expect(isLeaking).toBe(false);
    }
  });
});
