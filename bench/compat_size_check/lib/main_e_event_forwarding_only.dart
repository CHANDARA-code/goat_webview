import 'package:flutter/material.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

/// Steady-state RSS benchmark: per unused compat
/// feature" isolation fixture -- T8's opt-in event forwarding is the *only* feature enabled
/// here (all six callbacks wired, so every `enableOnX` creation flag goes true); pull-to-refresh
/// (T9) is left off. Compared against `main_a_engine_only.dart`'s RSS via
/// `GoatCompatAdapterBenchmark`, the delta isolates event-forwarding's own cost.
void main() => runApp(const SizeCheckApp());

class SizeCheckApp extends StatelessWidget {
  const SizeCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: InAppWebView(
          initialUrlRequest: URLRequest(url: WebUri('https://example.com')),
          onReceivedError: (controller, request, error) {},
          onReceivedHttpError: (controller, request, response) {},
          onPageCommitVisible: (controller, url) {},
          onConsoleMessage: (controller, message) {},
        ),
      ),
    );
  }
}
