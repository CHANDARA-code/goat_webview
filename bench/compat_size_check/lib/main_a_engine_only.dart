import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

void main() => runApp(const SizeCheckApp());

class SizeCheckApp extends StatelessWidget {
  const SizeCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: GoatWebView(
          appId: 'size-check-a',
          initialUrl: 'https://example.com',
        ),
      ),
    );
  }
}
