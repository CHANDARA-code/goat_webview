import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
import 'package:goat_webview_location/goat_webview_location.dart';
import 'package:goat_webview_media/goat_webview_media.dart';
import 'package:goat_webview_network/goat_webview_network.dart';
import 'package:goat_webview_payments/goat_webview_payments.dart';
import 'package:goat_webview_scanner/goat_webview_scanner.dart';

void main() {
  setUp(() {
    GoatCapabilityRegistry.instance.clear();
  });

  group('7 Companion Capability Plugins Registration & SPI Tests (Task 10202 / M4)', () {
    test('registers all 7 capability companion plugins via SPI', () {
      final registry = GoatCapabilityRegistry.instance;

      expect(registry.registeredNamespaces.isEmpty, isTrue);

      GoatBiometricsCapabilityPlugin.register();
      GoatBluetoothCapabilityPlugin.register();
      GoatLocationCapabilityPlugin.register();
      GoatMediaCapabilityPlugin.register();
      GoatNetworkCapabilityPlugin.register();
      GoatPaymentsCapabilityPlugin.register();
      GoatScannerCapabilityPlugin.register();

      expect(registry.registeredNamespaces.length, equals(7));
      expect(
        registry.registeredNamespaces,
        containsAll([
          'biometrics',
          'bluetooth',
          'location',
          'media',
          'network',
          'payments',
          'scanner',
        ]),
      );
    });

    test('companion plugins claim capabilities but refuse dispatch until attached to a controller', () async {
      final registry = GoatCapabilityRegistry.instance;

      GoatBiometricsCapabilityPlugin.register();
      GoatBluetoothCapabilityPlugin.register();
      GoatLocationCapabilityPlugin.register();
      GoatMediaCapabilityPlugin.register();
      GoatNetworkCapabilityPlugin.register();
      GoatPaymentsCapabilityPlugin.register();
      GoatScannerCapabilityPlugin.register();

      expect(registry.canHandle('CHECK_BIOMETRICS'), isTrue);
      expect(registry.canHandle('GET_BLUETOOTH_DEVICES'), isTrue);
      expect(registry.canHandle('GET_LOCATION'), isTrue);
      expect(registry.canHandle('CHOOSE_IMAGE'), isTrue);
      expect(registry.canHandle('GET_NETWORK_TYPE'), isTrue);
      expect(registry.canHandle('REQUEST_PAYMENT'), isTrue);
      expect(registry.canHandle('SCAN_CODE'), isTrue);

      for (final action in [
        'CHECK_BIOMETRICS',
        'GET_BLUETOOTH_DEVICES',
        'GET_LOCATION',
        'CHOOSE_IMAGE',
        'GET_NETWORK_TYPE',
        'REQUEST_PAYMENT',
        'SCAN_CODE',
      ]) {
        await expectLater(
          registry.dispatchAction(action, {}),
          throwsA(isA<StateError>()),
        );
      }
    });
  });
}
