import 'package:goat_webview/goat_webview.dart';

/// flutter_inappwebview-compatible
/// `CookieManager` façade over the engine's existing [GoatCookieManager]. Per G2, this class
/// never touches a native object or channel on its own — [GoatCookieManager]'s `MethodChannel`
/// is a `const` declaration (free to construct), and the platform side stays untouched until one
/// of these methods is actually invoked.
///
/// Unlike flutter_inappwebview's single, OS-wide cookie store, `goat_webview` partitions cookies
/// per mini-app tenant (the same `appId` a `GoatWebView`/`InAppWebView` is created with) — so
/// every method here takes an optional [appId], defaulting to `'default'` to match the engine's
/// own default partition. This is the one place this compat surface is not a pure rename:
/// flutter_inappwebview's real `CookieManager` has no per-tenant concept to preserve, because it
/// has no per-tenant cookie store to begin with.
class CookieManager {
  CookieManager._();

  static final CookieManager _instance = CookieManager._();

  /// flutter_inappwebview-shaped singleton accessor: `CookieManager.instance()`.
  static CookieManager instance() => _instance;

  /// Removes session (non-persistent) cookies only, for [appId]'s partition.
  Future<bool> removeSessionCookies({String appId = 'default'}) {
    return GoatCookieManager.removeSessionCookies(appId: appId);
  }

  /// Removes every cookie named [name] set for [url], in [appId]'s partition.
  Future<bool> deleteCookies({
    required String url,
    required String name,
    String appId = 'default',
  }) {
    return GoatCookieManager.deleteCookies(url: url, name: name, appId: appId);
  }

  /// Removes every cookie, session or persistent, in [appId]'s partition.
  Future<bool> deleteAllCookies({String appId = 'default'}) {
    return GoatCookieManager.deleteAllCookies(appId: appId);
  }
}
