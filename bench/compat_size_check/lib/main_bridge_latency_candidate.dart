import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

/// T12 candidate half -- see `main_bridge_latency_baseline.dart` for the full comparison design.
/// Identical loop, driven through `InAppWebViewController.evaluateJavascript` (the compat facade)
/// instead of `GoatWebViewController` directly.
const int kPingCount = 200;

void blog(Map<String, dynamic> m) {
  // ignore: avoid_print
  print('BENCHMARK ${jsonEncode(m)}');
}

void main() => runApp(const BridgeLatencyApp());

class BridgeLatencyApp extends StatefulWidget {
  const BridgeLatencyApp({super.key});

  @override
  State<BridgeLatencyApp> createState() => _BridgeLatencyAppState();
}

class _BridgeLatencyAppState extends State<BridgeLatencyApp> {
  bool _started = false;

  Future<void> _runLoop(InAppWebViewController controller) async {
    // The engine can fire onLoadStop more than once for one load (an implicit about:blank
    // commit, then the real navigation) -- only start the loop once.
    if (_started) return;
    _started = true;
    final samplesMs = <double>[];
    for (var i = 0; i < kPingCount; i++) {
      final sw = Stopwatch()..start();
      await controller.evaluateJavascript(source: '1+1');
      sw.stop();
      samplesMs.add(sw.elapsedMicroseconds / 1000.0);
    }
    samplesMs.sort();
    final p50 = samplesMs[(samplesMs.length * 0.50).floor().clamp(0, samplesMs.length - 1)];
    final p95 = samplesMs[(samplesMs.length * 0.95).floor().clamp(0, samplesMs.length - 1)];
    blog({
      'event': 'bridge_latency_candidate',
      'count': kPingCount,
      'p50Ms': p50,
      'p95Ms': p95,
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: InAppWebView(
          initialUrlRequest: URLRequest(url: WebUri('about:blank')),
          onLoadStop: (controller, url) => _runLoop(controller),
        ),
      ),
    );
  }
}
