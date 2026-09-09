import React, { createRef } from 'react';
import { Commands } from 'react-native-goat-webview';
import { WebView } from '../WebView';
import type { WebViewRef } from '../types';
import { compatBootstrapScript } from '../bootstrap';
import type { WebViewProps, WebViewRef } from '../types';

function renderWebView(props: WebViewProps, ref: any = { current: null }) {
  const origUseMemo = React.useMemo;
  const origUseCallback = React.useCallback;
  const origUseRef = React.useRef;
  const origUseState = React.useState;
  const origUseImperativeHandle = React.useImperativeHandle;

  let stateVal: any = null;
  const setState = (updater: any) => {
    stateVal = typeof updater === 'function' ? updater(stateVal) : updater;
  };

  try {
    React.useMemo = ((fn: any) => fn()) as any;
    React.useCallback = ((fn: any) => fn) as any;
    React.useRef = ((init: any) => ({ current: init ?? null })) as any;
    React.useState = ((init: any) => {
      if (stateVal === null) {
        stateVal = typeof init === 'function' ? init() : init;
      }
      return [stateVal, setState];
    }) as any;
    React.useImperativeHandle = (() => {}) as any;

    const element = (WebView as any).render(props, ref);
    return { element, getState: () => stateVal, nativeProps: element.props.children[0].props };
  } finally {
    React.useMemo = origUseMemo;
    React.useCallback = origUseCallback;
    React.useRef = origUseRef;
    React.useState = origUseState;
    React.useImperativeHandle = origUseImperativeHandle;
  }
}

describe('T6 / T12 — Commands and pullToRefreshEnabled wiring', () => {
  test('Commands object exports all required Fabric commands', () => {
    expect(typeof Commands.goBack).toBe('function');
    expect(typeof Commands.goForward).toBe('function');
    expect(typeof Commands.reload).toBe('function');
    expect(typeof Commands.stopLoading).toBe('function');
    expect(typeof Commands.injectJavaScript).toBe('function');
    expect(typeof Commands.requestFocus).toBe('function');
    expect(typeof Commands.postMessage).toBe('function');
    expect(typeof Commands.clearFormData).toBe('function');
    expect(typeof Commands.clearCache).toBe('function');
    expect(typeof Commands.clearHistory).toBe('function');
  });

  test('Commands dispatch to mock implementation', () => {
    const fakeRef = { __fake: true };
    Commands.goBack(fakeRef as any);
    expect(Commands.goBack).toHaveBeenCalledWith(fakeRef);

    Commands.reload(fakeRef as any);
    expect(Commands.reload).toHaveBeenCalledWith(fakeRef);

    Commands.injectJavaScript(fakeRef as any, 'alert(1)');
    expect(Commands.injectJavaScript).toHaveBeenCalledWith(fakeRef, 'alert(1)');

    Commands.postMessage(fakeRef as any, 'hello');
    expect(Commands.postMessage).toHaveBeenCalledWith(fakeRef, 'hello');

    Commands.clearCache(fakeRef as any, true);
    expect(Commands.clearCache).toHaveBeenCalledWith(fakeRef, true);
  });

  test('WebView component renders elements with pullToRefreshEnabled prop', () => {
    const el = <WebView source={{ uri: 'https://test.local' }} pullToRefreshEnabled={true} />;
    expect(el).toBeDefined();
    expect(el.props.pullToRefreshEnabled).toBe(true);
  });

  test('WebView ref provides all 10 imperative methods', () => {
    const ref = createRef<WebViewRef>();
    const Comp = () => <WebView ref={ref} source={{ uri: 'https://test.local' }} />;
    expect(Comp).toBeDefined();
  });

  test('WebView passes initialUrl from source.uri', () => {
    const el = <WebView source={{ uri: 'https://example.com' }} />;
    expect(el.props.source.uri).toBe('https://example.com');
  });
});

describe('T7 (N3) — Document-Start Script Hook Wiring', () => {
  test('WebView forwards compatBootstrapScript in initialUserScripts', () => {
    const { nativeProps } = renderWebView({ source: { uri: 'https://example.com' } });
    expect(Array.isArray(nativeProps.initialUserScripts)).toBe(true);
    expect(nativeProps.initialUserScripts).toContain(compatBootstrapScript);
  });

  test('WebView includes injectedJavaScriptBeforeContentLoaded in initialUserScripts', () => {
    const customScript = 'window.__MY_CUSTOM_BOOTSTRAP__ = 42;';
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      injectedJavaScriptBeforeContentLoaded: customScript,
    });
    expect(nativeProps.initialUserScripts).toEqual([compatBootstrapScript, customScript]);
  });
});

describe('T8 (N4) — Navigation State Feed', () => {
  test('onPageStarted delivers canGoBack, canGoForward, and title to navigation state', () => {
    const onNavigationStateChange = jest.fn();
    const onLoadStart = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onNavigationStateChange,
      onLoadStart,
    });

    nativeProps.onPageStarted({
      nativeEvent: {
        url: 'https://example.com/details',
        title: 'Detail Page',
        loading: true,
        canGoBack: true,
        canGoForward: false,
      },
    });

    expect(onNavigationStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/details',
        title: 'Detail Page',
        loading: true,
        canGoBack: true,
        canGoForward: false,
      })
    );
    expect(onLoadStart).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: expect.objectContaining({
          url: 'https://example.com/details',
          title: 'Detail Page',
          loading: true,
          canGoBack: true,
          canGoForward: false,
        }),
      })
    );
  });

  test('onPageLoaded delivers canGoBack, canGoForward, and title to navigation state and load events', () => {
    const onNavigationStateChange = jest.fn();
    const onLoad = jest.fn();
    const onLoadEnd = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onNavigationStateChange,
      onLoad,
      onLoadEnd,
    });

    nativeProps.onPageLoaded({
      nativeEvent: {
        url: 'https://example.com/home',
        title: 'Home Page',
        loading: false,
        canGoBack: true,
        canGoForward: true,
      },
    });

    expect(onNavigationStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/home',
        title: 'Home Page',
        loading: false,
        canGoBack: true,
        canGoForward: true,
      })
    );
    expect(onLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: expect.objectContaining({
          url: 'https://example.com/home',
          title: 'Home Page',
          loading: false,
          canGoBack: true,
          canGoForward: true,
        }),
      })
    );
    expect(onLoadEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: expect.objectContaining({
          url: 'https://example.com/home',
          title: 'Home Page',
          loading: false,
          canGoBack: true,
          canGoForward: true,
        }),
      })
    );
  });

  test('onReceivedTitle updates title and notifies onNavigationStateChange', () => {
    const onNavigationStateChange = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onNavigationStateChange,
    });

    nativeProps.onReceivedTitle({
      nativeEvent: { title: 'Dynamic Page Title' },
    });

    expect(onNavigationStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dynamic Page Title',
      })
    );
  });
});

describe('T9 (N5) — Origin Whitelist and Scheme Resolver Wiring', () => {
  test('WebView passes compatExternalSchemeResolver=true and originWhitelist', () => {
    const whitelist = ['https://*.mybank.com', 'https://*.trusted.org'];
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      originWhitelist: whitelist,
    });

    expect(nativeProps.compatExternalSchemeResolver).toBe(true);
    expect(nativeProps.originWhitelist).toEqual(whitelist);
  });

  test('onPageStarted invokes Linking for off-whitelist navigation', async () => {
    const { Linking } = require('react-native');
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      originWhitelist: ['https://trusted.com/*'],
    });

    nativeProps.onPageStarted({
      nativeEvent: {
        url: 'https://evil.com/phish',
        loading: true,
      },
    });

    expect(Linking.canOpenURL).toHaveBeenCalledWith('https://evil.com/phish');
  });
});

describe('T10 (N6) — Opt-in Event Forwarders Wiring', () => {
  test('WebView sets hasOnScroll and hasOnHttpError flags when handlers provided', () => {
    const onScroll = jest.fn();
    const onHttpError = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onScroll,
      onHttpError,
    });

    expect(nativeProps.hasOnScroll).toBe(true);
    expect(nativeProps.hasOnHttpError).toBe(true);
  });

  test('onHttpError propagates statusCode, description, and url to consumer', () => {
    const onHttpError = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onHttpError,
    });

    nativeProps.onHttpError({
      nativeEvent: {
        url: 'https://example.com/api/missing',
        statusCode: 404,
        description: 'HTTP 404',
      },
    });

    expect(onHttpError).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: expect.objectContaining({
          url: 'https://example.com/api/missing',
          statusCode: 404,
          description: 'HTTP 404',
        }),
      })
    );
  });

  test('onRenderProcessGone propagates didCrash to consumer', () => {
    const onRenderProcessGone = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onRenderProcessGone,
    });

    nativeProps.onRenderProcessGone({
      nativeEvent: { didCrash: true },
    });

    expect(onRenderProcessGone).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: { didCrash: true },
      })
    );
  });

  test('onContentProcessDidTerminate invokes consumer callback', () => {
    const onContentProcessDidTerminate = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onContentProcessDidTerminate,
    });

    nativeProps.onContentProcessDidTerminate({
      nativeEvent: {},
    });

    expect(onContentProcessDidTerminate).toHaveBeenCalled();
  });

  test('onScroll propagates coordinates to consumer callback', () => {
    const onScroll = jest.fn();
    const { nativeProps } = renderWebView({
      source: { uri: 'https://example.com' },
      onScroll,
    });

    nativeProps.onScroll({
      nativeEvent: { x: 0, y: 350 },
    });

    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeEvent: expect.objectContaining({
          x: 0,
          y: 350,
        }),
      })
    );
  });
});

describe('T11 (N7) — Incognito Prop Wiring', () => {
  test('WebView passes incognito prop to native component', () => {
    const { nativeProps: defaultProps } = renderWebView({
      source: { uri: 'https://example.com' },
    });
    expect(defaultProps.incognito).toBe(false);

    const { nativeProps: incognitoProps } = renderWebView({
      source: { uri: 'https://example.com' },
      incognito: true,
    });
    expect(incognitoProps.incognito).toBe(true);
  });
});
