import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

class MockMediaCapabilityPlugin extends GoatCapabilityPlugin {
  @override
  String get namespace => 'media';

  @override
  Set<String> get supportedActions => {
        'CHOOSE_IMAGE',
        'CHOOSE_VIDEO',
        'RECORD_AUDIO',
      };

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    if (action == 'CHOOSE_IMAGE') {
      return {'uri': 'file:///media/img_1.jpg', 'size': 102400};
    }
    return {'success': true, 'action': action};
  }
}

class MockScannerCapabilityPlugin extends GoatCapabilityPlugin {
  @override
  String get namespace => 'scanner';

  @override
  Set<String> get supportedActions => {
        'SCAN_CODE',
        'GENERATE_BARCODE',
      };

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    if (action == 'SCAN_CODE') {
      return {'content': 'https://goat.dev', 'format': 'QR_CODE'};
    }
    return {'success': true, 'action': action};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatCapabilityRegistry SPI Suite (Task 10202)', () {
    late GoatCapabilityRegistry registry;

    setUp(() {
      registry = GoatCapabilityRegistry.instance;
      registry.clear();
    });

    test('registers companion capability plugins and dispatches actions', () async {
      final media = MockMediaCapabilityPlugin();
      final scanner = MockScannerCapabilityPlugin();

      registry.registerPlugin(media);
      registry.registerPlugin(scanner);

      expect(registry.canHandle('CHOOSE_IMAGE'), isTrue);
      expect(registry.canHandle('SCAN_CODE'), isTrue);
      expect(registry.canHandle('NON_EXISTENT'), isFalse);

      expect(registry.registeredNamespaces, containsAll(['media', 'scanner']));
      expect(registry.allSupportedActions, contains('CHOOSE_IMAGE'));
      expect(registry.allSupportedActions, contains('SCAN_CODE'));

      // Dispatch action
      final mediaRes = await registry.dispatchAction('CHOOSE_IMAGE', {});
      expect(mediaRes?['uri'], equals('file:///media/img_1.jpg'));

      final scanRes = await registry.dispatchAction('SCAN_CODE', {});
      expect(scanRes?['content'], equals('https://goat.dev'));

      // Unregister
      registry.unregisterPlugin('media');
      expect(registry.canHandle('CHOOSE_IMAGE'), isFalse);
      expect(registry.canHandle('SCAN_CODE'), isTrue);
    });

    test('GoatWebViewController delegates to registered SPI plugins and canIUse', () async {
      final scanner = MockScannerCapabilityPlugin();
      registry.registerPlugin(scanner);

      final controller = GoatWebViewController(viewId: 0);

      // canIUse checks SPI registry
      final canScan = await controller.canIUse('SCAN_CODE');
      expect(canScan, isTrue);

      // executeAction dispatches to SPI plugin
      final res = await controller.executeAction('SCAN_CODE');
      expect(res.success, isTrue);
      expect(res.data['content'], equals('https://goat.dev'));

      controller.dispose();
    });
  });
}
