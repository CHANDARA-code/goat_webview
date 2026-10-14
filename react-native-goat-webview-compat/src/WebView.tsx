import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, NativeSyntheticEvent, View } from "react-native";
import {
  Commands,
  GoatWebViewNativeComponent,
  GoatWebViewNativeModule,
} from "react-native-goat-webview";

// Minimal local copies of react-native-goat-webview's GoatWebViewNativeComponent event-data
// shapes (that package only re-exports the component's default export from its barrel, not
// these types -- see index.tsx's `export { default as GoatWebViewNativeComponent } from ...`,
// with no matching `export type`). Redeclaring the two or three fields this adapter actually
// reads is simpler and more robust than a deep, unbarrelled cross-package import.
interface OnPageStartedEventData {
  url: string;
  title?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
}
interface OnPageLoadedEventData {
  url: string;
  title?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
}
interface OnProgressChangedEventData {
  progress: number;
}
interface OnReceivedTitleEventData {
  title: string;
}
interface OnErrorEventData {
  description: string;
}
interface OnBridgeMessageEventData {
  action: string;
  payload: string;
}
interface OnHttpErrorEventData {
  url: string;
  statusCode: number;
  description: string;
}
interface OnRenderProcessGoneEventData {
  didCrash: boolean;
}
interface OnScrollEventData {
  x: number;
  y: number;
}

const originWhitelistToRegex = (originWhitelist: string): string => {
  const escaped = originWhitelist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped.replace(/\\\*/g, ".*")}`;
};

const passesWhitelist = (
  compiledWhitelist: readonly string[],
  url: string,
): boolean => {
  const match = /^[A-Za-z][A-Za-z0-9+\-.]+:(\/\/)?[^/]*/.exec(url);
  const origin = match === null ? "" : match[0];
  return compiledWhitelist.some((x) => new RegExp(x).test(origin));
};

import { toCreationProps } from "./toCreationProps";
import { compatBootstrapScript } from "./bootstrap";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
  WebViewProps,
  WebViewRef,
} from "./types";

const RNW_MESSAGE_ACTION = "__RNW_MESSAGE__";

// react-native-webview's handlers only ever read `.nativeEvent`; the rest of NativeSyntheticEvent
// (target, bubbles, ...) has no meaning for an event we synthesize in JS rather than receive.
const syntheticEvent = <E,>(nativeEvent: unknown): E =>
  ({ nativeEvent }) as unknown as E;

type NativeEvent<T> = { nativeEvent: T };

/**
 * `react-native-webview`-compatible `<WebView>`
 * over `<GoatWebViewNativeComponent>`. Per G1, this component holds no field/state of type
 * `WebViewProps`/`WebViewSource` — `toCreationProps` is called fresh each render (memoised on its
 * primitive inputs per G4) and the caller's own props object is never retained past that call.
 *
 * `source.uri`/`source.html` are mapped by `toCreationProps` but NOT yet wired to the native
 * side below — the engine has no remote-URL/raw-HTML load path yet (blocked on T5/N1). Until
 * then, select the mini-app via the goat-specific `appId`/`assetBundleName` props (see
 * `types.ts`), same as `<GoatWebView>` today.
 *
 * `canGoBack`/`canGoForward` on synthesized nav events are always `false` — accurate values need
 * T8 (N4)'s native nav-state feed, not built yet.
 */
export const WebView = forwardRef<WebViewRef, WebViewProps>(
  function WebView(props, ref) {
    const nativeRef = useRef<any>(null);
    const {
      appId = "default",
      assetBundleName = "miniapp.zip",
      startInLoadingState,
      renderLoading,
      renderError,
      onLoadStart,
      onLoad,
      onLoadEnd,
      onLoadProgress,
      onNavigationStateChange,
      onError,
      onMessage,
      testID,
    } = props;

    const source = props.source;
    const sourceUri = source && "uri" in source ? source.uri : undefined;
    const sourceHtml = source && "html" in source ? source.html : undefined;
    const sourceBaseUrl =
      source && "html" in source ? source.baseUrl : undefined;
    const {
      injectedJavaScriptBeforeContentLoaded,
      applicationNameForUserAgent,
      userAgent,
      cacheMode,
      incognito,
      webviewDebuggingEnabled,
      mediaPlaybackRequiresUserAction,
      javaScriptCanOpenWindowsAutomatically,
      pullToRefreshEnabled,
      onShouldStartLoadWithRequest,
      originWhitelist,
      onScroll,
      onFileDownload,
      onOpenWindow,
      webviewBackgroundColor,
    } = props;

    const userScripts = useMemo(() => {
      if (injectedJavaScriptBeforeContentLoaded) {
        return [compatBootstrapScript, injectedJavaScriptBeforeContentLoaded];
      }
      return [compatBootstrapScript];
    }, [injectedJavaScriptBeforeContentLoaded]);

    // Only feeds toCreationProps below (G4: memoised on the primitives it reads, not the props
    // object itself) -- never stored past this render. G1: props object is not retained across renders.
    const creationProps = useMemo(
      () =>
        toCreationProps({
          source,
          applicationNameForUserAgent,
          userAgent,
          cacheMode,
          incognito,
          webviewDebuggingEnabled,
          mediaPlaybackRequiresUserAction,
          javaScriptCanOpenWindowsAutomatically,
          pullToRefreshEnabled,
          onShouldStartLoadWithRequest,
          originWhitelist,
          onScroll,
          onFileDownload,
          onOpenWindow,
          webviewBackgroundColor,
        }),
      [
        sourceUri,
        sourceHtml,
        sourceBaseUrl,
        applicationNameForUserAgent,
        userAgent,
        cacheMode,
        incognito,
        webviewDebuggingEnabled,
        mediaPlaybackRequiresUserAction,
        javaScriptCanOpenWindowsAutomatically,
        pullToRefreshEnabled,
        onShouldStartLoadWithRequest != null,
        originWhitelist,
        onScroll != null,
        onFileDownload != null,
        onOpenWindow != null,
        webviewBackgroundColor,
      ],
    );

    const [state, setState] = useState<{
      url: string;
      title: string;
      loading: boolean;
      hasError: boolean;
      lastErrorEvent: WebViewErrorEvent["nativeEvent"] | null;
    }>({
      url: creationProps.uri ?? "",
      title: "",
      loading: !!startInLoadingState,
      hasError: false,
      lastErrorEvent: null,
    });

    const buildNavigation = useCallback(
      (
        url: string,
        loading: boolean,
        navigationType: WebViewNavigation["navigationType"],
        title?: string,
        canGoBack?: boolean,
        canGoForward?: boolean,
      ): WebViewNavigation => ({
        url,
        loading,
        title: title ?? state.title,
        canGoBack: !!canGoBack,
        canGoForward: !!canGoForward,
        lockIdentifier: 0,
        navigationType,
      }),
      [state.title],
    );

    const handlePageStarted = useCallback(
      (event: NativeEvent<OnPageStartedEventData>) => {
        const { url, title, canGoBack, canGoForward } = event.nativeEvent;
        if (
          creationProps.originWhitelistCompiled &&
          creationProps.originWhitelistCompiled.length > 0
        ) {
          const compiled = [
            "about:blank",
            ...creationProps.originWhitelistCompiled,
          ].map(originWhitelistToRegex);
          if (!passesWhitelist(compiled, url)) {
            Linking.canOpenURL(url)
              .then((supported) => {
                if (supported) {
                  Linking.openURL(url);
                }
              })
              .catch(() => {});
          }
        }
        setState((s) => ({
          ...s,
          url,
          title: title ?? s.title,
          loading: true,
          hasError: false,
        }));
        const nav = buildNavigation(
          url,
          true,
          "other",
          title,
          canGoBack,
          canGoForward,
        );
        onLoadStart?.(syntheticEvent<WebViewNavigationEvent>(nav));
        onNavigationStateChange?.(nav);
      },
      [
        buildNavigation,
        creationProps.originWhitelistCompiled,
        onLoadStart,
        onNavigationStateChange,
      ],
    );

    const handleHttpError = useCallback(
      (event: NativeEvent<OnHttpErrorEventData>) => {
        const { url, statusCode, description } = event.nativeEvent;
        const httpError: WebViewHttpErrorEvent["nativeEvent"] = {
          url,
          statusCode,
          description,
          loading: false,
          title: state.title,
          canGoBack: false,
          canGoForward: false,
          lockIdentifier: 0,
        };
        props.onHttpError?.(syntheticEvent<WebViewHttpErrorEvent>(httpError));
      },
      [props.onHttpError, state.title],
    );

    const handleRenderProcessGone = useCallback(
      (event: NativeEvent<OnRenderProcessGoneEventData>) => {
        props.onRenderProcessGone?.(
          syntheticEvent<NativeSyntheticEvent<{ didCrash: boolean }>>({
            didCrash: event.nativeEvent.didCrash,
          }),
        );
      },
      [props.onRenderProcessGone],
    );

    const handleContentProcessDidTerminate = useCallback(() => {
      props.onContentProcessDidTerminate?.(
        syntheticEvent<NativeSyntheticEvent<Record<string, never>>>({}),
      );
    }, [props.onContentProcessDidTerminate]);

    const handleScroll = useCallback(
      (event: NativeEvent<OnScrollEventData>) => {
        props.onScroll?.(
          syntheticEvent<NativeSyntheticEvent<Record<string, unknown>>>({
            x: event.nativeEvent.x,
            y: event.nativeEvent.y,
          }),
        );
      },
      [props.onScroll],
    );

    const handlePageLoaded = useCallback(
      (event: NativeEvent<OnPageLoadedEventData>) => {
        const { url, title, canGoBack, canGoForward } = event.nativeEvent;
        setState((s) => ({
          ...s,
          url,
          title: title ?? s.title,
          loading: false,
        }));
        const nav = buildNavigation(
          url,
          false,
          "other",
          title,
          canGoBack,
          canGoForward,
        );
        onLoad?.(syntheticEvent<WebViewNavigationEvent>(nav));
        onLoadEnd?.(syntheticEvent<WebViewNavigationEvent>(nav));
        onNavigationStateChange?.(nav);
      },
      [buildNavigation, onLoad, onLoadEnd, onNavigationStateChange],
    );

    const handleProgressChanged = useCallback(
      (event: NativeEvent<OnProgressChangedEventData>) => {
        onLoadProgress?.({
          nativeEvent: { progress: event.nativeEvent.progress },
        } as any);
      },
      [onLoadProgress],
    );

    const handleReceivedTitle = useCallback(
      (event: NativeEvent<OnReceivedTitleEventData>) => {
        const title = event.nativeEvent.title;
        setState((s) => ({ ...s, title }));
        const nav = buildNavigation(state.url, state.loading, "other", title);
        onNavigationStateChange?.(nav);
      },
      [buildNavigation, onNavigationStateChange, state.loading, state.url],
    );

    const handleError = useCallback(
      (event: NativeEvent<OnErrorEventData>) => {
        const errorEvent: WebViewErrorEvent["nativeEvent"] = {
          url: state.url,
          loading: false,
          title: state.title,
          canGoBack: false,
          canGoForward: false,
          lockIdentifier: 0,
          code: -1,
          description: event.nativeEvent.description,
        };
        setState((s) => ({
          ...s,
          loading: false,
          hasError: true,
          lastErrorEvent: errorEvent,
        }));
        onError?.(syntheticEvent<WebViewErrorEvent>(errorEvent));
        onLoadEnd?.(syntheticEvent<WebViewErrorEvent>(errorEvent));
      },
      [onError, onLoadEnd, state.title, state.url],
    );

    // T4: window.ReactNativeWebView.postMessage relay (see bootstrap.ts). The engine's
    // GoatBridgeActionHandler forwards onBridgeMessage for every action it's asked to execute,
    // recognized or not (mirrored from the Flutter/Android GoatPlatformView.kt onBridgeAction path,
    // which emits onBridgeMessage on both its onSuccess and onFailure branches) -- so a custom,
    // unregistered '__RNW_MESSAGE__' action should still reach here. UNVERIFIED on the RN native
    // module specifically; written on that architectural assumption, not confirmed by a run.
    const handleBridgeMessage = useCallback(
      (event: NativeEvent<OnBridgeMessageEventData>) => {
        if (event.nativeEvent.action !== RNW_MESSAGE_ACTION || !onMessage)
          return;
        let data = "";
        try {
          data = JSON.parse(event.nativeEvent.payload)?.data ?? "";
        } catch {
          data = event.nativeEvent.payload;
        }
        const nav = buildNavigation(state.url, state.loading, "other");
        onMessage(syntheticEvent<WebViewMessageEvent>({ ...nav, data }));
      },
      [buildNavigation, onMessage, state.loading, state.url],
    );

    useImperativeHandle(
      ref,
      () => ({
        goBack: () => {
          if (nativeRef.current) {
            Commands.goBack(nativeRef.current);
          } else {
            GoatWebViewNativeModule.executeAction?.(
              "NAVIGATE_BACK",
              {},
              appId,
            ).catch(() => {});
          }
        },
        goForward: () => {
          if (nativeRef.current) {
            Commands.goForward(nativeRef.current);
          }
        },
        reload: () => {
          if (nativeRef.current) {
            Commands.reload(nativeRef.current);
          }
        },
        stopLoading: () => {
          if (nativeRef.current) {
            Commands.stopLoading(nativeRef.current);
          }
        },
        postMessage: (data: string) => {
          if (nativeRef.current) {
            Commands.postMessage(nativeRef.current, data);
          }
        },
        injectJavaScript: (data: string) => {
          if (nativeRef.current) {
            Commands.injectJavaScript(nativeRef.current, data);
          }
        },
        requestFocus: () => {
          if (nativeRef.current) {
            Commands.requestFocus(nativeRef.current);
          }
        },
        clearCache: (includeDiskFiles: boolean) => {
          if (nativeRef.current) {
            Commands.clearCache(nativeRef.current, includeDiskFiles);
          } else {
            GoatWebViewNativeModule.clearCache?.(appId)?.catch?.(() => {});
          }
        },
        clearHistory: () => {
          if (nativeRef.current) {
            Commands.clearHistory(nativeRef.current);
          }
        },
        clearFormData: () => {
          if (nativeRef.current) {
            Commands.clearFormData(nativeRef.current);
          }
        },
      }),
      [appId],
    );

    if (state.hasError && renderError && state.lastErrorEvent) {
      return (
        <View style={props.style} testID={testID}>
          {renderError(
            state.lastErrorEvent.domain,
            state.lastErrorEvent.code,
            state.lastErrorEvent.description,
          )}
        </View>
      );
    }

    return (
      <View style={props.containerStyle ?? props.style} testID={testID}>
        <GoatWebViewNativeComponent
          ref={nativeRef}
          style={props.containerStyle ? undefined : props.style}
          appId={appId}
          assetBundleName={assetBundleName}
          initialUrl={sourceUri}
          initialUserScripts={userScripts}
          pullToRefreshEnabled={creationProps.pullToRefreshEnabled}
          incognito={creationProps.incognito}
          compatExternalSchemeResolver={true}
          originWhitelist={creationProps.originWhitelistCompiled}
          hasOnScroll={creationProps.hasOnScroll}
          hasOnHttpError={props.onHttpError != null}
          onPageStarted={handlePageStarted}
          onPageLoaded={handlePageLoaded}
          onProgressChanged={handleProgressChanged}
          onReceivedTitle={handleReceivedTitle}
          onError={handleError}
          onBridgeMessage={handleBridgeMessage}
          onHttpError={handleHttpError}
          onRenderProcessGone={handleRenderProcessGone}
          onContentProcessDidTerminate={handleContentProcessDidTerminate}
          onScroll={handleScroll}
        />
        {state.loading && renderLoading ? renderLoading() : null}
      </View>
    );
  },
);

export default WebView;
