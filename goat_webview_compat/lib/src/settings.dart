import 'package:flutter/foundation.dart';

import 'enums.dart';

/// flutter_inappwebview-shaped settings bag. Per G1, a consumer must never
/// keep a reference to an instance of this class past widget construction —
/// [InAppWebView] (T2) reads it once into a flat primitive map and lets it go.
///
/// Fields are grouped by whether the adapter actually wires them to the
/// engine yet. See `MIGRATION.md` (added once T2/T5 land) for the current
/// honored/ignored split.
@immutable
class InAppWebViewSettings {
  // --- Wired through to the engine (T2's `_toCreationParams`) ---
  final String? userAgentSuffix;
  final CacheMode cacheMode;
  final bool transparentBackground;
  final bool isInspectable;
  final bool allowsBackForwardNavigationGestures;
  final bool useShouldOverrideUrlLoading;
  final bool mediaPlaybackRequiresUserGesture;
  final bool supportZoom;
  final ScrollViewContentInsetAdjustmentBehavior contentInsetAdjustmentBehavior;
  final bool pullToRefreshEnabled;

  // --- Accepted for drop-in compilation, not yet wired (documented no-ops) ---
  final String? applicationNameForUserAgent;
  final String? userAgent;
  final bool javaScriptEnabled;
  final bool javaScriptCanOpenWindowsAutomatically;
  final bool domStorageEnabled;
  final bool databaseEnabled;
  final bool thirdPartyCookiesEnabled;
  final bool sharedCookiesEnabled;
  final bool allowsInlineMediaPlayback;
  final bool allowFileAccess;
  final bool allowContentAccess;
  final bool allowFileAccessFromFileURLs;
  final bool allowUniversalAccessFromFileURLs;
  final bool useHybridComposition;
  final bool verticalScrollBarEnabled;
  final bool horizontalScrollBarEnabled;
  final bool disableHorizontalScroll;
  final bool disableVerticalScroll;
  final bool disableContextMenu;
  final bool supportMultipleWindows;
  final bool limitsNavigationsToAppBoundDomains;
  final bool incognito;
  final bool clearCache;
  final bool disableDefaultErrorPage;
  final double minimumFontSize;
  final double initialScale;
  final MixedContentMode? mixedContentMode;

  const InAppWebViewSettings({
    this.userAgentSuffix,
    this.cacheMode = CacheMode.loadDefault,
    this.transparentBackground = false,
    this.isInspectable = false,
    this.allowsBackForwardNavigationGestures = true,
    this.useShouldOverrideUrlLoading = false,
    this.mediaPlaybackRequiresUserGesture = true,
    this.supportZoom = true,
    this.contentInsetAdjustmentBehavior =
        ScrollViewContentInsetAdjustmentBehavior.never,
    this.pullToRefreshEnabled = false,
    this.applicationNameForUserAgent,
    this.userAgent,
    this.javaScriptEnabled = true,
    this.javaScriptCanOpenWindowsAutomatically = false,
    this.domStorageEnabled = true,
    this.databaseEnabled = true,
    this.thirdPartyCookiesEnabled = true,
    this.sharedCookiesEnabled = false,
    this.allowsInlineMediaPlayback = false,
    this.allowFileAccess = true,
    this.allowContentAccess = true,
    this.allowFileAccessFromFileURLs = false,
    this.allowUniversalAccessFromFileURLs = false,
    this.useHybridComposition = true,
    this.verticalScrollBarEnabled = true,
    this.horizontalScrollBarEnabled = true,
    this.disableHorizontalScroll = false,
    this.disableVerticalScroll = false,
    this.disableContextMenu = false,
    this.supportMultipleWindows = false,
    this.limitsNavigationsToAppBoundDomains = false,
    this.incognito = false,
    this.clearCache = false,
    this.disableDefaultErrorPage = false,
    this.minimumFontSize = 8,
    this.initialScale = 0,
    this.mixedContentMode,
  });
}

/// Legacy 5.x per-platform options bag. T1 defines the shape only; T10 maps
/// it onto [InAppWebViewSettings].
@immutable
class InAppWebViewOptions {
  final bool javaScriptEnabled;
  final bool transparentBackground;
  final bool useShouldOverrideUrlLoading;
  final bool useOnLoadResource;
  final bool clearCache;
  final String? userAgent;
  final bool supportZoom;

  const InAppWebViewOptions({
    this.javaScriptEnabled = true,
    this.transparentBackground = false,
    this.useShouldOverrideUrlLoading = false,
    this.useOnLoadResource = false,
    this.clearCache = false,
    this.userAgent,
    this.supportZoom = true,
  });

  /// T10 legacy shim. [useOnLoadResource] has no [InAppWebViewSettings]
  /// equivalent — the adapter opts a consumer into `onLoadResource` events by
  /// whether they supply the callback (G7), not via a settings flag, so that
  /// field is intentionally dropped here rather than silently misapplied to
  /// an unrelated setting.
  @Deprecated('Use InAppWebViewSettings instead')
  InAppWebViewSettings toSettings() => InAppWebViewSettings(
        javaScriptEnabled: javaScriptEnabled,
        transparentBackground: transparentBackground,
        useShouldOverrideUrlLoading: useShouldOverrideUrlLoading,
        clearCache: clearCache,
        userAgent: userAgent,
        supportZoom: supportZoom,
      );
}

@immutable
class InAppWebViewGroupOptions {
  final InAppWebViewOptions crossPlatform;

  const InAppWebViewGroupOptions({
    this.crossPlatform = const InAppWebViewOptions(),
  });

  /// T10 legacy shim — see [InAppWebViewOptions.toSettings].
  @Deprecated('Use InAppWebViewSettings instead')
  InAppWebViewSettings toSettings() => crossPlatform.toSettings();
}
