import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.goat.webview/global');
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'getTheme') {
        return <Object?, Object?>{'colorScheme': 'dark', 'bg_color': '#1c1c1d'};
      }
      if (call.method == 'getDesign') {
        return <Object?, Object?>{'spacing_unit': '8px'};
      }
      return true;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('GoatDesign host API', () {
    test('setColorScheme forwards the dark flag', () async {
      await GoatDesign.setColorScheme(dark: true);
      expect(calls.single.method, 'setColorScheme');
      expect((calls.single.arguments as Map)['dark'], true);
    });

    test('only the fields a host set are sent', () async {
      await GoatDesign.setTheme(const GoatThemeTokens(buttonColor: '#ff0000'));
      final args = Map<String, dynamic>.from(calls.single.arguments as Map);

      expect(args['button_color'], '#ff0000');
      expect(args['colorScheme'], 'light');
      // Sending nulls for the other twelve would pin them against future default changes, so a
      // host that cares about one colour must not accidentally freeze the rest.
      expect(args.containsKey('bg_color'), isFalse);
      expect(args.containsKey('link_color'), isFalse);
    });

    test('theme keys use Telegram names', () async {
      await GoatDesign.setTheme(const GoatThemeTokens(
        bgColor: '#fff',
        secondaryBgColor: '#eee',
        destructiveTextColor: '#f00',
      ));
      final args = Map<String, dynamic>.from(calls.single.arguments as Map);
      expect(args.containsKey('bg_color'), isTrue);
      expect(args.containsKey('secondary_bg_color'), isTrue);
      expect(args.containsKey('destructive_text_color'), isTrue);
    });

    test('design tokens send only what was set', () async {
      await GoatDesign.setDesign(const GoatDesignTokens(spacingUnit: '4px'));
      final args = Map<String, dynamic>.from(calls.single.arguments as Map);
      expect(args, {'spacing_unit': '4px'});
    });

    test('getTheme returns the native snapshot', () async {
      final t = await GoatDesign.getTheme();
      expect(t['colorScheme'], 'dark');
      expect(t['bg_color'], '#1c1c1d');
    });

    test('getDesign returns the native snapshot', () async {
      expect((await GoatDesign.getDesign())['spacing_unit'], '8px');
    });

    test('verbose is explicit, not implied by other calls', () async {
      await GoatDesign.setVerbose(true);
      expect(calls.single.method, 'setDesignVerbose');
      expect((calls.single.arguments as Map)['verbose'], true);
    });
  });
}
