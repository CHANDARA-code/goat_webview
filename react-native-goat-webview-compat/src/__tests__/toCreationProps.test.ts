import { toCreationProps } from '../toCreationProps';
import type { WebViewProps } from '../types';

describe('T2 — toCreationProps (pure mapping, no retention)', () => {
  test('maps a uri source and the documented primitives', () => {
    const props: WebViewProps = {
      source: { uri: 'https://mini.app/entry' },
      userAgent: 'CustomUA/1.0',
      applicationNameForUserAgent: 'DgSuperApp',
      cacheMode: 'LOAD_NO_CACHE',
      incognito: true,
      webviewDebuggingEnabled: true,
      mediaPlaybackRequiresUserAction: false,
      javaScriptCanOpenWindowsAutomatically: true,
      pullToRefreshEnabled: true,
      originWhitelist: ['https://*.mini.app'],
      onScroll: () => {},
      onFileDownload: () => {},
    };

    const result = toCreationProps(props);

    expect(result.uri).toBe('https://mini.app/entry');
    expect(result.html).toBeUndefined();
    expect(result.userAgent).toBe('CustomUA/1.0');
    expect(result.userAgentSuffix).toBe('DgSuperApp');
    expect(result.cacheMode).toBe('LOAD_NO_CACHE');
    expect(result.incognito).toBe(true);
    expect(result.webviewDebuggingEnabled).toBe(true);
    expect(result.mediaPlaybackRequiresUserAction).toBe(false);
    expect(result.javaScriptCanOpenWindowsAutomatically).toBe(true);
    expect(result.pullToRefreshEnabled).toBe(true);
    expect(result.originWhitelistCompiled).toEqual(['https://*.mini.app']);
    expect(result.hasOnScroll).toBe(true);
    expect(result.hasOnFileDownload).toBe(true);
    expect(result.hasOnOpenWindow).toBe(false);
    expect(result.useShouldStartLoadWithRequest).toBe(false);
  });

  test('maps an html source with baseUrl', () => {
    const result = toCreationProps({
      source: { html: '<h1>hi</h1>', baseUrl: 'https://mini.app' },
    });
    expect(result.html).toBe('<h1>hi</h1>');
    expect(result.baseUrl).toBe('https://mini.app');
    expect(result.uri).toBeUndefined();
  });

  test('onShouldStartLoadWithRequest presence flips useShouldStartLoadWithRequest (G8)', () => {
    const result = toCreationProps({ onShouldStartLoadWithRequest: () => true });
    expect(result.useShouldStartLoadWithRequest).toBe(true);
  });

  test('empty props fall back to documented defaults, never throws', () => {
    const result = toCreationProps({});
    expect(result.uri).toBeUndefined();
    expect(result.incognito).toBe(false);
    expect(result.mediaPlaybackRequiresUserAction).toBe(true);
    expect(result.pullToRefreshEnabled).toBe(false);
  });

  test('is a pure function: same inputs, same (non-identical) output object', () => {
    const props: WebViewProps = { source: { uri: 'https://mini.app' } };
    const a = toCreationProps(props);
    const b = toCreationProps(props);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
