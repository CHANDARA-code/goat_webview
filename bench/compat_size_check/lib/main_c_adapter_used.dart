import 'package:flutter/material.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() => runApp(const SizeCheckApp());

class SizeCheckApp extends StatelessWidget {
  const SizeCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: InAppWebView(
          initialUrlRequest: URLRequest(url: WebUri('https://example.com')),
          initialSettings: const InAppWebViewSettings(
            transparentBackground: true,
            useShouldOverrideUrlLoading: true,
            supportZoom: false,
          ),
          pullToRefreshController: PullToRefreshController(
            settings: const PullToRefreshSettings(enabled: true),
            onRefresh: () {},
          ),
          onWebViewCreated: (controller) {
            controller.addJavaScriptHandler(
              handlerName: 'ping',
              callback: (args) => 'pong',
            );
          },
          onLoadStart: (controller, url) {},
          onLoadStop: (controller, url) {},
          onProgressChanged: (controller, progress) {},
          onReceivedError: (controller, request, error) {},
          onReceivedHttpError: (controller, request, response) {},
          onPageCommitVisible: (controller, url) {},
          onConsoleMessage: (controller, message) {},
        ),
      ),
    );
  }
}
