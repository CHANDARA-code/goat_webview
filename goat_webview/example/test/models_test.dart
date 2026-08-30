import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview_example/models/ipc_message.dart';
import 'package:goat_webview_example/models/hardware_overrides.dart';
import 'package:goat_webview_example/models/mini_app_tab.dart';

void main() {
  group('IpcMessageEntry Model Tests', () {
    test('creates and extracts namespace correctly from action', () {
      final entry1 = IpcMessageEntry(
        id: 'msg_1',
        action: 'AUTHENTICATE_BIOMETRICS',
        durationMs: 3.2,
      );
      expect(entry1.namespace, equals('biometrics'));
      expect(entry1.isWarmPath, isTrue);
      expect(entry1.latencyTier, equals('WARM_PATH'));

      final entry2 = IpcMessageEntry(
        id: 'msg_2',
        action: 'GET_BLUETOOTH_DEVICES',
        durationMs: 8.5,
      );
      expect(entry2.namespace, equals('bluetooth'));
      expect(entry2.isWarmPath, isFalse);
      expect(entry2.latencyTier, equals('STANDARD'));

      final entry3 = IpcMessageEntry(
        id: 'msg_3',
        action: 'CUSTOM_PAYMENT_SUBMIT',
        durationMs: 22.0,
      );
      expect(entry3.namespace, equals('payments'));
      expect(entry3.latencyTier, equals('COLD_PATH'));
    });

    test('serializes toMap and deserializes fromMap', () {
      final now = DateTime.now();
      final entry = IpcMessageEntry(
        id: 'req_100',
        timestamp: now,
        action: 'GET_LOCATION',
        direction: 'OUTBOUND',
        status: 'SUCCESS',
        durationMs: 4.1,
        isWarmPath: true,
        requestPayload: {'accuracy': 'high'},
        responsePayload: {'lat': 37.77, 'lng': -122.41},
      );

      final map = entry.toMap();
      expect(map['id'], equals('req_100'));
      expect(map['action'], equals('GET_LOCATION'));
      expect(map['namespace'], equals('location'));
      expect(map['durationMs'], equals(4.1));
      expect(map['isWarmPath'], isTrue);

      final parsed = IpcMessageEntry.fromMap(map);
      expect(parsed.id, equals('req_100'));
      expect(parsed.action, equals('GET_LOCATION'));
      expect(parsed.namespace, equals('location'));
      expect(parsed.durationMs, equals(4.1));
      expect(parsed.isWarmPath, isTrue);
      expect(parsed.requestPayload['accuracy'], equals('high'));
    });
  });

  group('IpcLatencyStats Tests', () {
    test('calculates correct warm-path stats and averages', () {
      final entries = [
        IpcMessageEntry(id: '1', action: 'A', durationMs: 2.0), // warm
        IpcMessageEntry(id: '2', action: 'B', durationMs: 4.0), // warm
        IpcMessageEntry(id: '3', action: 'C', durationMs: 8.0), // standard
        IpcMessageEntry(id: '4', action: 'D', durationMs: 16.0), // cold
      ];

      final stats = IpcLatencyStats.fromEntries(entries);
      expect(stats.totalCount, equals(4));
      expect(stats.warmPathCount, equals(2));
      expect(stats.standardCount, equals(1));
      expect(stats.coldPathCount, equals(1));
      expect(stats.averageLatencyMs, equals(7.5));
      expect(stats.minLatencyMs, equals(2.0));
      expect(stats.maxLatencyMs, equals(16.0));
      expect(stats.warmPathPercentage, equals(50.0));
    });

    test('handles empty entries gracefully', () {
      final stats = IpcLatencyStats.fromEntries([]);
      expect(stats.totalCount, equals(0));
      expect(stats.warmPathCount, equals(0));
      expect(stats.averageLatencyMs, equals(0.0));
      expect(stats.warmPathPercentage, equals(0.0));
    });
  });

  group('HardwareOverridesState Tests', () {
    test('defaults and copyWith work properly', () {
      const initial = HardwareOverridesState();
      expect(initial.isOffline, isFalse);
      expect(initial.mockGpsEnabled, isFalse);
      expect(initial.mockBiometrics, equals(BiometricMockOutcome.auto));

      final updated = initial.copyWith(
        isOffline: true,
        mockGpsEnabled: true,
        selectedGps: GpsPreset.defaultPresets[1],
        mockBiometrics: BiometricMockOutcome.forceSuccess,
      );

      expect(updated.isOffline, isTrue);
      expect(updated.mockGpsEnabled, isTrue);
      expect(updated.selectedGps.name, contains('Tokyo'));
      expect(updated.mockBiometrics, equals(BiometricMockOutcome.forceSuccess));

      final map = updated.toMap();
      expect(map['isOffline'], isTrue);
      expect(map['mockBiometrics'], equals('FORCE_SUCCESS'));
      expect(map['mockGps'], isNotNull);
    });

    test('BiometricMockOutcome parsing', () {
      expect(BiometricMockOutcome.fromCode('FORCE_ERROR'), equals(BiometricMockOutcome.forceError));
      expect(BiometricMockOutcome.fromCode('LOCKED_OUT'), equals(BiometricMockOutcome.lockedOut));
      expect(BiometricMockOutcome.fromCode('INVALID'), equals(BiometricMockOutcome.auto));
    });
  });

  group('MiniAppTabInfo Tests', () {
    test('defines all 5 showcase mini-app tabs', () {
      expect(MiniAppTabInfo.allTabs.length, equals(5));

      final tab0 = MiniAppTabInfo.allTabs[0];
      expect(tab0.appId, equals('com.goat.ecommerce'));
      expect(tab0.route, equals('#/ecommerce'));
      expect(tab0.keyFeatures.isNotEmpty, isTrue);

      final tab1 = MiniAppTabInfo.allTabs[1];
      expect(tab1.appId, equals('com.goat.iot'));
      expect(tab1.route, equals('#/iot'));

      final tab2 = MiniAppTabInfo.allTabs[2];
      expect(tab2.appId, equals('com.goat.fieldservice'));
      expect(tab2.route, equals('#/fieldservice'));

      final tab3 = MiniAppTabInfo.allTabs[3];
      expect(tab3.appId, equals('com.goat.vault'));
      expect(tab3.route, equals('#/vault'));

      final tab4 = MiniAppTabInfo.allTabs[4];
      expect(tab4.appId, equals('com.goat.diagnostics'));
      expect(tab4.route, equals('#/diagnostics'));
    });
  });
}
