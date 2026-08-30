import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview_example/main.dart';
import 'package:goat_webview_example/models/ipc_message.dart';
import 'package:goat_webview_example/services/telemetry_service.dart';
import 'package:goat_webview_example/widgets/debug_hud.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('com.goat.webview/global'),
      (MethodCall methodCall) async {
        if (methodCall.method == 'prewarm') return true;
        if (methodCall.method == 'clearCache') return true;
        if (methodCall.method == 'getBundleVersion') return '1.0.0-test';
        return null;
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('com.goat.webview/global'),
      null,
    );
  });

  group('Flutter SuperApp Showcase Widget Tests (Task M4)', () {
    testWidgets('renders SuperApp showcase with 5 Material 3 tabs', (WidgetTester tester) async {
      await tester.pumpWidget(const GoatSuperAppShowcase());
      await tester.pump();

      // Verify all 5 NavigationBar tab labels
      expect(find.text('E-Commerce'), findsWidgets);
      expect(find.text('IoT & BLE'), findsOneWidget);
      expect(find.text('Field Service'), findsOneWidget);
      expect(find.text('Vault'), findsOneWidget);
      expect(find.text('Engine Lab'), findsOneWidget);

      // Verify Floating Debug HUD is visible
      expect(find.text('DEBUG HUD'), findsOneWidget);
    });

    testWidgets('switches between tabs on NavigationBar tap', (WidgetTester tester) async {
      await tester.pumpWidget(const GoatSuperAppShowcase());
      await tester.pump();

      // Tap on 'IoT & BLE' tab
      await tester.tap(find.text('IoT & BLE'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('IoT & Hardware Dashboard'), findsOneWidget);

      // Tap on 'Field Service' tab
      await tester.tap(find.text('Field Service'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Field Service & Navigation'), findsOneWidget);

      // Tap on 'Vault' tab
      await tester.tap(find.text('Vault'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Secure Biometric Vault'), findsOneWidget);

      // Tap on 'Engine Lab' tab
      await tester.tap(find.text('Engine Lab'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Engine Lab & Diagnostics'), findsOneWidget);
    });

    testWidgets('DebugHudConsoleSheet navigates all 4 HUD tabs (IPC Logs, Latency, Overrides, 7 Plugins)', (WidgetTester tester) async {
      // Pre-populate telemetry with sample logs
      TelemetryService.instance.recordIpcMessage(
        IpcMessageEntry(
          id: 'test_msg_101',
          action: 'CHECK_BIOMETRICS',
          durationMs: 2.1,
          isWarmPath: true,
        ),
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DebugHudConsoleSheet(),
          ),
        ),
      );
      await tester.pump();

      // Verify Debug HUD Console Header
      expect(find.text('Goat Developer Debug HUD'), findsOneWidget);

      // Verify HUD Tabs
      expect(find.byType(Tab), findsNWidgets(4));

      // Verify IPC Log item is displayed in Tab 0
      expect(find.text('CHECK_BIOMETRICS'), findsWidgets);

      // Navigate to Latency Tab (Tab 1)
      await tester.tap(find.byType(Tab).at(1), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.text('Warm-Path IPC Target: < 5.0 ms'), findsOneWidget);
      expect(find.text('Run Warm-Path Latency Benchmark'), findsOneWidget);

      // Navigate to Overrides Tab (Tab 2)
      await tester.tap(find.byType(Tab).at(2), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.text('Simulate Offline Mode'), findsOneWidget);
      expect(find.text('GPS Coordinate Spoofing'), findsOneWidget);
      expect(find.text('Biometric Authentication Mock Mode'), findsOneWidget);

      // Navigate to 7 Plugins Tab (Tab 3)
      await tester.tap(find.byType(Tab).at(3), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.text('Registered Companion Plugins (SPI)'), findsOneWidget);
      expect(find.text('Interactive Capability Action Runner'), findsOneWidget);
    });

    testWidgets('toggles theme mode from app bar', (WidgetTester tester) async {
      await tester.pumpWidget(const GoatSuperAppShowcase());
      await tester.pump();

      // Find theme toggle button in AppBar
      final themeBtn = find.byTooltip('Toggle Theme Mode').first;
      expect(themeBtn, findsOneWidget);

      await tester.tap(themeBtn);
      await tester.pump(const Duration(milliseconds: 100));
    });
  });
}
