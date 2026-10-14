import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';
// ignore: unused_import
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() => runApp(const SizeCheckApp());

class SizeCheckApp extends StatelessWidget {
  const SizeCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: GoatWebView(
          appId: 'size-check-b',
          initialUrl: 'https://example.com',
        ),
      ),
    );
  }
}
