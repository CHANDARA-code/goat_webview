import 'package:goat_webview_compat/goat_webview_compat.dart';

/// T14 acceptance fixture: every declaration below must trigger
/// `goat_compat_retained_config`.
class X {
  final InAppWebViewSettings s = const InAppWebViewSettings();
  static const InAppWebViewOptions staticOpts = InAppWebViewOptions();
}

final URLRequest topLevelRequest = URLRequest(url: WebUri('https://example.com'));

// This one must NOT fire — escape hatch.
// ignore: goat_compat_retained_config
final PullToRefreshSettings ignoredSettings = const PullToRefreshSettings();
