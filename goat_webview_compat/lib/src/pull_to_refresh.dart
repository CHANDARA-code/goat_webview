import 'package:flutter/foundation.dart';

import 'in_app_web_view_controller.dart';

@immutable
class PullToRefreshSettings {
  final bool enabled;
  final int color;
  final int backgroundColor;
  final double size;

  const PullToRefreshSettings({
    this.enabled = true,
    this.color = 0xFF000000,
    this.backgroundColor = 0xFFFFFFFF,
    this.size = 1.0,
  });
}

/// A live handle bound to one mounted `InAppWebView`, wired natively in T9.
/// Not a value type (G4 exempts controllers, only config/settings) — this is
/// the T1 shape only.
class PullToRefreshController {
  PullToRefreshController({this.onRefresh, this.settings = const PullToRefreshSettings()});

  final void Function()? onRefresh;
  // G4 exempts controllers (only config/settings value types fall under G1) —
  // this settings snapshot is read for the controller's own operational
  // lifetime, the same pattern GoatWebViewController uses for its own state.
  // ignore: goat_compat_retained_config
  final PullToRefreshSettings settings;

  Future<void> Function()? _beginRefreshing;
  Future<void> Function()? _endRefreshing;
  Future<bool> Function()? _isRefreshing;

  Future<void> beginRefreshing() async => _beginRefreshing?.call();

  Future<void> endRefreshing() async => _endRefreshing?.call();

  Future<bool> isRefreshing() async => await _isRefreshing?.call() ?? false;

  /// T9: binds this controller's begin/end/isRefreshing to the real, live
  /// [InAppWebViewController] once the underlying platform view exists. Called by
  /// [InAppWebView] in its `onWebViewCreated`, not by consumer code.
  void attachTo(InAppWebViewController controller) {
    _beginRefreshing = () => controller.setRefreshing(true);
    _endRefreshing = () => controller.setRefreshing(false);
    _isRefreshing = () => controller.isRefreshing();
  }
}
