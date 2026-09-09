import type { HostComponent, ViewProps } from "react-native";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import codegenNativeCommands from "react-native/Libraries/Utilities/codegenNativeCommands";
import type {
  DirectEventHandler,
  WithDefault,
  Double,
} from "react-native/Libraries/Types/CodegenTypes";

export type OnBridgeMessageEventData = Readonly<{
  action: string;
  payload: string;
}>;

export type OnPageStartedEventData = Readonly<{
  url: string;
  title?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
}>;

export type OnPageLoadedEventData = Readonly<{
  url: string;
  title?: string;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
}>;

export type OnProgressChangedEventData = Readonly<{
  progress: Double; // Normalized 0.0 to 1.0 or 0 to 100
}>;

export type OnReceivedTitleEventData = Readonly<{
  title: string;
}>;

export type OnInsetsChangeEventData = Readonly<{
  top: Double;
  bottom: Double;
  left: Double;
  right: Double;
  keyboardHeight: Double;
  totalBottom: Double;
}>;

export type OnSheetStateChangeEventData = Readonly<{
  currentSnap: Double;
  sheetValue: string; // 'COLLAPSED' | 'HALF' | 'EXPANDED' | 'HIDDEN'
}>;

export type OnErrorEventData = Readonly<{
  description: string;
}>;

export type OnAppServiceReadyEventData = Readonly<{
  appId: string;
  timestamp: Double;
}>;

export type OnAppServiceCrashEventData = Readonly<{
  appId: string;
  error: string;
  timestamp: Double;
}>;

export type OnAppServiceTerminateEventData = Readonly<{
  appId: string;
  timestamp: Double;
}>;

export type PopupRequestEvent = Readonly<{
  url: string;
  target?: string;
  policy?: string;
  isUserGesture?: boolean;
  isDialog?: boolean;
  windowFeatures?: string;
  windowFeaturesJson?: string;
}>;

export type OnPopupRequestEventData = PopupRequestEvent;

export type OnHttpErrorEventData = Readonly<{
  url: string;
  statusCode: Double;
  description: string;
}>;

export type OnRenderProcessGoneEventData = Readonly<{
  didCrash: boolean;
}>;

export type OnContentProcessDidTerminateEventData = Readonly<{}>;

export type OnScrollEventData = Readonly<{
  x: Double;
  y: Double;
}>;

export type OnExternalNavigationEventData = Readonly<{
  url: string;
}>;

export interface NativeProps extends ViewProps {
  assetBundleName?: WithDefault<string, "miniapp.zip">;
  appId?: WithDefault<string, "default">;
  initialUrl?: WithDefault<string, "">;
  initialUserScripts?: ReadonlyArray<string>;
  /** Host patterns the mini-app may load subresources from and reach via API_REQUEST. */
  hostDomainAllowlist?: ReadonlyArray<string>;
  popupRoutingPolicy?: WithDefault<string, "auto">;
  pullToRefreshEnabled?: WithDefault<boolean, false>;
  incognito?: WithDefault<boolean, false>;
  compatExternalSchemeResolver?: WithDefault<boolean, false>;
  originWhitelist?: ReadonlyArray<string>;
  hasOnScroll?: WithDefault<boolean, false>;
  hasOnHttpError?: WithDefault<boolean, false>;

  // Navigation Bar Props
  navBarTitle?: WithDefault<string, "">;
  navBarSubtitle?: WithDefault<string, "">;
  navBarBackgroundColor?: WithDefault<string, "#0F172A">;
  navBarTextColor?: WithDefault<string, "#F8FAFC">;
  navBarVisible?: WithDefault<boolean, true>;
  navBarProgress?: WithDefault<Double, -1>; // -1 = hidden, 0..100 = progress value

  // Bottom Sheet Props
  bottomSheetSnapPoints?: ReadonlyArray<Double>;
  bottomSheetInitialSnap?: WithDefault<Double, 0.5>;
  bottomSheetDismissible?: WithDefault<boolean, true>;
  bottomSheetShowDragHandle?: WithDefault<boolean, true>;
  bottomSheetVisible?: WithDefault<boolean, false>;

  // Event Handlers
  onBridgeMessage?: DirectEventHandler<OnBridgeMessageEventData>;
  onPageStarted?: DirectEventHandler<OnPageStartedEventData>;
  onPageLoaded?: DirectEventHandler<OnPageLoadedEventData>;
  onProgressChanged?: DirectEventHandler<OnProgressChangedEventData>;
  onReceivedTitle?: DirectEventHandler<OnReceivedTitleEventData>;
  onInsetsChange?: DirectEventHandler<OnInsetsChangeEventData>;
  onSheetStateChange?: DirectEventHandler<OnSheetStateChangeEventData>;
  onError?: DirectEventHandler<OnErrorEventData>;
  onAppServiceReady?: DirectEventHandler<OnAppServiceReadyEventData>;
  onAppServiceCrash?: DirectEventHandler<OnAppServiceCrashEventData>;
  onAppServiceTerminate?: DirectEventHandler<OnAppServiceTerminateEventData>;
  onPopupRequest?: DirectEventHandler<PopupRequestEvent>;
  onHttpError?: DirectEventHandler<OnHttpErrorEventData>;
  onRenderProcessGone?: DirectEventHandler<OnRenderProcessGoneEventData>;
  onContentProcessDidTerminate?: DirectEventHandler<OnContentProcessDidTerminateEventData>;
  onScroll?: DirectEventHandler<OnScrollEventData>;
  onExternalNavigation?: DirectEventHandler<OnExternalNavigationEventData>;
}

export interface NativeCommands {
  goBack: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  goForward: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  reload: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  stopLoading: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  injectJavaScript: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>,
    javascript: string,
  ) => void;
  requestFocus: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  postMessage: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>,
    data: string,
  ) => void;
  clearFormData: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>,
  ) => void;
  clearCache: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>,
    includeDiskFiles: boolean,
  ) => void;
  clearHistory: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
}

export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    "goBack",
    "goForward",
    "reload",
    "stopLoading",
    "injectJavaScript",
    "requestFocus",
    "postMessage",
    "clearFormData",
    "clearCache",
    "clearHistory",
  ],
});

export default codegenNativeComponent<NativeProps>(
  "GoatWebView",
) as HostComponent<NativeProps>;
