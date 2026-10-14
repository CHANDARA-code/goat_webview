import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

/// Bridge round-trip latency benchmark: "Bridge round-trip latency p50/p95"
/// baseline -- drives N sequential `evaluateJavascript` round trips straight through
/// [GoatWebViewController] (no compat wrapper) and reports p50/p95 as a `BENCHMARK` JSON line,
/// matching the logging convention `bench/goat_vs_fiw/app_goat` already uses. The compat
/// candidate (`main_bridge_latency_candidate.dart`) drives the identical loop through
/// `InAppWebViewController.evaluateJavascript`, which does nothing but forward to this same
/// method -- the delta between the two isolates exactly that one extra Dart call's cost, with
/// the JS/native round trip itself held constant.
const int kPingCount = 200;

void blog(Map<String, dynamic> m) {
  // ignore: avoid_print
  print('BENCHMARK ${jsonEncode(m)}');
}

void main() => runApp(const BridgeLatencyApp());

class BridgeLatencyApp extends StatelessWidget {
  const BridgeLatencyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: GoatWebView(
          appId: 'bridge-latency-baseline',
          initialUrl: 'about:blank',
          onWebViewCreated: (controller) {
            var started = false;
            controller.onPageFinished.listen((_) async {
              // The engine can fire onPageFinished more than once for one load (an implicit
              // about:blank commit, then the real navigation) -- only start the loop once.
              if (started) return;
              started = true;
              final samplesMs = <double>[];
              for (var i = 0; i < kPingCount; i++) {
                final sw = Stopwatch()..start();
                await controller.evaluateJavascript('1+1');
                sw.stop();
                samplesMs.add(sw.elapsedMicroseconds / 1000.0);
              }
              samplesMs.sort();
              final p50 = samplesMs[(samplesMs.length * 0.50).floor().clamp(0, samplesMs.length - 1)];
              final p95 = samplesMs[(samplesMs.length * 0.95).floor().clamp(0, samplesMs.length - 1)];
              blog({
                'event': 'bridge_latency_baseline',
                'count': kPingCount,
                'p50Ms': p50,
                'p95Ms': p95,
              });
            });
          },
        ),
      ),
    );
  }
}
