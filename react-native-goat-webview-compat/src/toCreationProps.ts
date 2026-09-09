import type { WebViewProps } from './types';

/**
 * T2's ≤14-primitive `creationProps` mapping. A pure function: same inputs always produce a
 * new, structurally-equal object (never the same reference — nothing here is memoised at this
 * layer; `WebView.tsx` wraps the call in `useMemo` per G4). Per G1, the caller's `source`/props
 * object itself must never be stored anywhere past this call — only the primitives below may
 * survive.
 */
export interface CreationProps {
  uri?: string;
  html?: string;
  baseUrl?: string;
  userAgentSuffix?: string;
  userAgent?: string;
  cacheMode?: string;
  incognito: boolean;
  webviewDebuggingEnabled: boolean;
  mediaPlaybackRequiresUserAction: boolean;
  javaScriptCanOpenWindowsAutomatically: boolean;
  pullToRefreshEnabled: boolean;
  useShouldStartLoadWithRequest: boolean;
  originWhitelistCompiled?: readonly string[];
  hasOnScroll: boolean;
  hasOnFileDownload: boolean;
  hasOnOpenWindow: boolean;
  webviewBackgroundColor?: string;
}

export function toCreationProps(props: WebViewProps): CreationProps {
  const source = props.source;
  return {
    uri: source && 'uri' in source ? source.uri : undefined,
    html: source && 'html' in source ? source.html : undefined,
    baseUrl: source && 'html' in source ? source.baseUrl : undefined,
    userAgentSuffix: props.applicationNameForUserAgent,
    userAgent: props.userAgent,
    cacheMode: props.cacheMode,
    incognito: props.incognito ?? false,
    webviewDebuggingEnabled: props.webviewDebuggingEnabled ?? false,
    mediaPlaybackRequiresUserAction: props.mediaPlaybackRequiresUserAction ?? true,
    javaScriptCanOpenWindowsAutomatically:
      props.javaScriptCanOpenWindowsAutomatically ?? false,
    pullToRefreshEnabled: props.pullToRefreshEnabled ?? false,
    useShouldStartLoadWithRequest: props.onShouldStartLoadWithRequest != null,
    originWhitelistCompiled: props.originWhitelist,
    hasOnScroll: props.onScroll != null,
    hasOnFileDownload: props.onFileDownload != null,
    hasOnOpenWindow: props.onOpenWindow != null,
    webviewBackgroundColor: props.webviewBackgroundColor,
  };
}
