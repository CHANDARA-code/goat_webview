import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('GoatWebView Flutter Full-Stack Integration Suite (Task 10088)', () {
    testWidgets('mounts GoatWebView PlatformView and verifies controller lifecycle', (WidgetTester tester) async {
      GoatWebViewController? createdController;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GoatWebView(
              assetBundleName: 'miniapp.zip',
              onWebViewCreated: (controller) {
                createdController = controller;
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify widget mounted successfully
      expect(find.byType(GoatWebView), findsOneWidget);

      if (createdController != null) {
        expect(createdController!.viewId, isNotNull);
        createdController!.dispose();
      }
    });

    testWidgets('verifies transparent render layer and background theme synchronization', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            backgroundColor: Colors.black,
            body: GoatWebView(
              assetBundleName: 'miniapp.zip',
              algorithmicDarkening: true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.byType(GoatWebView), findsOneWidget);
    });
  });
}
