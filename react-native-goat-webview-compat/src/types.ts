import type { ReactElement } from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewProps, ViewStyle } from 'react-native';

/**
 * T1 (`TASK_PORTABLE_PLUG_AND_PLAY_RN_ADAPTER.md`): `react-native-webview`-identical shapes,
 * copied field-for-field from `react-native-webview@16`'s `WebViewTypes.ts` (see
 * `learn_use_case/react-native-webview-16.0.0/src/WebViewTypes.ts` in this repo) so a migrating
 * consumer's existing `WebViewNavigation`/`WebViewMessageEvent`/etc. call sites type-check
 * unchanged. `lockIdentifier` is present on [WebViewNativeEvent] for shape-compat but is always
 * `0` here until T9 (N5)'s opt-in faithful veto exists — see that field's own doc comment.
 */
export interface WebViewNativeEvent {
  url: string;
  loading: boolean;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Always `0` — this adapter has no faithful `onShouldStartLoadWithRequest` veto yet (T9/N5). */
  lockIdentifier: number;
}

export interface WebViewNavigation extends WebViewNativeEvent {
  navigationType:
    | 'click'
    | 'formsubmit'
    | 'backforward'
    | 'reload'
    | 'formresubmit'
    | 'other';
  mainDocumentURL?: string;
}

export interface ShouldStartLoadRequest extends WebViewNavigation {
  isTopFrame: boolean;
}

export interface WebViewMessage extends WebViewNativeEvent {
  data: string;
}

export interface WebViewError extends WebViewNativeEvent {
  domain?: string;
  code: number;
  description: string;
}

export interface WebViewHttpError extends WebViewNativeEvent {
  description: string;
  statusCode: number;
}

export interface FileDownload {
  downloadUrl: string;
}

export interface WebViewOpenWindow {
  targetUrl: string;
}

export type WebViewNavigationEvent = NativeSyntheticEvent<WebViewNavigation>;
export type WebViewMessageEvent = NativeSyntheticEvent<WebViewMessage>;
export type WebViewErrorEvent = NativeSyntheticEvent<WebViewError>;
export type WebViewHttpErrorEvent = NativeSyntheticEvent<WebViewHttpError>;
export type ShouldStartLoadRequestEvent = NativeSyntheticEvent<ShouldStartLoadRequest>;
export type FileDownloadEvent = NativeSyntheticEvent<FileDownload>;
export type WebViewOpenWindowEvent = NativeSyntheticEvent<WebViewOpenWindow>;

export interface WebViewSourceUri {
  uri: string;
  method?: string;
  headers?: object;
  body?: string;
}

export interface WebViewSourceHtml {
  html: string;
  baseUrl?: string;
}

export type WebViewSource = WebViewSourceUri | WebViewSourceHtml;

export type CacheMode = 'LOAD_DEFAULT' | 'LOAD_CACHE_ELSE_NETWORK' | 'LOAD_NO_CACHE' | 'LOAD_CACHE_ONLY';

export type OnShouldStartLoadWithRequest = (event: ShouldStartLoadRequest) => boolean;

/**
 * T2's ≤14-primitive `creationProps` — see `toCreationProps` in `WebView.tsx`. Every other prop
 * on [WebViewProps] below is either synthesized locally (events) or silently accepted-and-dropped
 * (documented per-field in `toCreationProps`'s own comments), never forwarded as an opaque object.
 */
export interface WebViewProps extends ViewProps {
  source?: WebViewSource;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;

  /**
   * Goat-specific extensions, not part of `react-native-webview`'s real API: the engine has no
   * `source.uri`/`source.html` load path yet (blocked on T5/N1 — see `toCreationProps.ts`), so
   * until then a migrating consumer selects a mini-app the same way they would with
   * `<GoatWebView>` directly. Optional — omitted, both default exactly as `GoatWebViewNativeComponent`
   * already does (`appId: 'default'`, `assetBundleName: 'miniapp.zip'`).
   */
  appId?: string;
  assetBundleName?: string;

  userAgent?: string;
  applicationNameForUserAgent?: string;
  cacheMode?: CacheMode;
  incognito?: boolean;
  webviewDebuggingEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  javaScriptEnabled?: boolean;
  javaScriptCanOpenWindowsAutomatically?: boolean;
  pullToRefreshEnabled?: boolean;
  originWhitelist?: readonly string[];
  webviewBackgroundColor?: string;

  startInLoadingState?: boolean;
  renderLoading?: () => ReactElement;
  renderError?: (errorDomain: string | undefined, errorCode: number, errorDesc: string) => ReactElement;

  onLoadStart?: (event: WebViewNavigationEvent) => void;
  onLoad?: (event: WebViewNavigationEvent) => void;
  onLoadEnd?: (event: WebViewNavigationEvent | WebViewErrorEvent) => void;
  onLoadProgress?: (event: NativeSyntheticEvent<{ progress: number }>) => void;
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  onError?: (event: WebViewErrorEvent) => void;
  onHttpError?: (event: WebViewHttpErrorEvent) => void;
  onMessage?: (event: WebViewMessageEvent) => void;

  /** T9 (N5) opt-in veto — supplying this switches the adapter out of its default,
   *  zero-round-trip navigation mode (G8). Not yet backed natively; see that task. */
  onShouldStartLoadWithRequest?: OnShouldStartLoadWithRequest;

  /** T10 (N6) opt-in event forwarders — each sets a `hasOnX` creation prop only when supplied
   *  (G7). None are backed natively yet; see that task. */
  onScroll?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onFileDownload?: (event: FileDownloadEvent) => void;
  onOpenWindow?: (event: WebViewOpenWindowEvent) => void;
  onRenderProcessGone?: (event: NativeSyntheticEvent<{ didCrash: boolean }>) => void;
  onContentProcessDidTerminate?: (event: NativeSyntheticEvent<Record<string, never>>) => void;

  injectedJavaScript?: string;
  injectedJavaScriptBeforeContentLoaded?: string;
  injectedJavaScriptObject?: Record<string, unknown>;

  testID?: string;
}

/** T3's imperative ref surface — method-for-method identical to `react-native-webview`'s
 *  `WebView` ref, including Android-only members being `undefined` on iOS. */
export interface WebViewRef {
  goForward: () => void;
  goBack: () => void;
  reload: () => void;
  stopLoading: () => void;
  postMessage: (data: string) => void;
  injectJavaScript: (data: string) => void;
  requestFocus: () => void;
  clearCache: (includeDiskFiles: boolean) => void;
  /** @platform android */
  clearHistory?: () => void;
  /** @platform android */
  clearFormData?: () => void;
}
