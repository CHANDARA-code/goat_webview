/**
 * react-native-webview-compatible drop-in adapter over react-native-goat-webview.
 *
 * Staged-migration aid only, mirroring the Flutter sibling package `goat_webview_compat` (plug-and-play adapter) -- not a general-purpose WebView replacement.
 */
export { WebView, WebView as default } from './WebView';
export { compatBootstrapScript } from './bootstrap';
export { toCreationProps } from './toCreationProps';
export { CookieManager } from './cookies';
export type { GoatCookie } from './cookies';
export type { CreationProps } from './toCreationProps';

export type {
  WebViewProps,
  WebViewRef,
  WebViewNativeEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
  WebViewMessage,
  WebViewMessageEvent,
  WebViewError,
  WebViewErrorEvent,
  WebViewHttpError,
  WebViewHttpErrorEvent,
  ShouldStartLoadRequest,
  ShouldStartLoadRequestEvent,
  OnShouldStartLoadWithRequest,
  FileDownload,
  FileDownloadEvent,
  WebViewOpenWindow,
  WebViewOpenWindowEvent,
  WebViewSource,
  WebViewSourceUri,
  WebViewSourceHtml,
  CacheMode,
} from './types';
