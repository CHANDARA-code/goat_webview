import 'package:flutter/material.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

/// Steady-state RSS benchmark: per unused compat
/// feature" isolation fixture -- pull-to-refresh is the *only* opt-in compat feature enabled
/// here (T9's `pullToRefreshController`); no lifecycle/error/console callbacks (T8) are wired.
/// Compared against `main_a_engine_only.dart`'s RSS via `GoatCompatAdapterBenchmark`, the delta
/// isolates PTR's own cost with every other feature held at its lazy-off default (G2).
void main() => runApp(const SizeCheckApp());

class SizeCheckApp extends StatelessWidget {
  const SizeCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: InAppWebView(
          initialUrlRequest: URLRequest(url: WebUri('https://example.com')),
          pullToRefreshController: PullToRefreshController(
            settings: const PullToRefreshSettings(),
            onRefresh: () {},
          ),
        ),
      ),
    );
  }
}
