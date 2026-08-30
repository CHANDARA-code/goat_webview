import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
import 'package:goat_webview_location/goat_webview_location.dart';
import 'package:goat_webview_network/goat_webview_network.dart';
import 'package:goat_webview_example/models/ipc_message.dart';
import 'package:goat_webview_example/models/hardware_overrides.dart';
import 'package:goat_webview_example/services/telemetry_service.dart';

void main() {
  setUp(() {
    GoatCapabilityRegistry.instance.clear();
    GoatBiometricsCapabilityPlugin.register();
    GoatBluetoothCapabilityPlugin.register();
    GoatLocationCapabilityPlugin.register();
    GoatNetworkCapabilityPlugin.register();

    TelemetryService.instance.clearLogs();
    TelemetryService.instance.setFilterNamespace(null);
    TelemetryService.instance.setSearchQuery('');
    TelemetryService.instance.updateHardwareOverrides(const HardwareOverridesState());
  });

  group('TelemetryService Tests', () {
    test('records IPC message and updates latency stats', () {
      final service = TelemetryService.instance;
      expect(service.allLogs.isEmpty, isTrue);

      service.recordIpcMessage(
        IpcMessageEntry(
          id: 'test_1',
          action: 'CHECK_BIOMETRICS',
          durationMs: 2.5,
        ),
      );

      expect(service.allLogs.length, equals(1));
      expect(service.latencyStats.totalCount, equals(1));
      expect(service.latencyStats.warmPathCount, equals(1));
      expect(service.latencyStats.averageLatencyMs, equals(2.5));
    });

    test('records from GoatBridgeMessage', () {
      final service = TelemetryService.instance;
      final bridgeMsg = GoatBridgeMessage(
        id: 'bridge_101',
        action: 'PAYMENT_EVENT',
        payload: {'amount': 100, 'currency': 'USD'},
      );

      service.recordFromBridgeMessage(bridgeMsg);
      expect(service.allLogs.length, equals(1));
      expect(service.allLogs.first.id, equals('bridge_101'));
      expect(service.allLogs.first.action, equals('PAYMENT_EVENT'));
      expect(service.allLogs.first.namespace, equals('payments'));
      expect(service.allLogs.first.isWarmPath, isTrue);
    });

    test('filters logs by namespace and search query', () {
      final service = TelemetryService.instance;
      service.recordIpcMessage(IpcMessageEntry(id: '1', action: 'CHECK_BIOMETRICS'));
      service.recordIpcMessage(IpcMessageEntry(id: '2', action: 'GET_LOCATION'));
      service.recordIpcMessage(IpcMessageEntry(id: '3', action: 'START_BLUETOOTH_DEVICES_DISCOVERY'));

      expect(service.filteredLogs.length, equals(3));

      // Filter by namespace
      service.setFilterNamespace('location');
      expect(service.filteredLogs.length, equals(1));
      expect(service.filteredLogs.first.action, equals('GET_LOCATION'));

      // Filter by search query
      service.setFilterNamespace(null);
      service.setSearchQuery('bluetooth');
      expect(service.filteredLogs.length, equals(1));
      expect(service.filteredLogs.first.action, contains('BLUETOOTH'));
    });

    test('hardware overrides - offline simulation', () async {
      final service = TelemetryService.instance;
      service.toggleOffline(true);
      expect(service.hardwareOverrides.isOffline, isTrue);

      final res = await service.triggerCapabilityAction('GET_NETWORK_TYPE');
      expect(res, isNull);
      expect(service.allLogs.first.status, equals('ERROR'));
      expect(service.allLogs.first.error, contains('Offline mode'));
    });

    test('hardware overrides - GPS spoofing', () async {
      final service = TelemetryService.instance;
      service.setGpsSpoofing(
        enabled: true,
        preset: GpsPreset.defaultPresets[1], // Tokyo
      );

      expect(service.hardwareOverrides.mockGpsEnabled, isTrue);
      final res = await service.triggerCapabilityAction('GET_LOCATION');
      expect(res, isNotNull);
      expect(res!['isMocked'], isTrue);
      expect(res['latitude'], equals(35.6895));
      expect(res['longitude'], equals(139.6917));
    });

    test('hardware overrides - biometric mock modes', () async {
      final service = TelemetryService.instance;

      // Force error mode
      service.setBiometricMockOutcome(BiometricMockOutcome.forceError);
      final errRes = await service.triggerCapabilityAction('AUTHENTICATE_BIOMETRICS');
      expect(errRes, isNull);
      expect(service.allLogs.first.status, equals('ERROR'));
      expect(service.allLogs.first.error, contains('failed'));

      // Force success mode
      service.setBiometricMockOutcome(BiometricMockOutcome.forceSuccess);
      final res = await service.triggerCapabilityAction('AUTHENTICATE_BIOMETRICS');
      expect(res!['success'], isTrue);
      expect(res['authenticated'], isTrue);
    });

    test('runs warm-path latency benchmark suite', () async {
      final service = TelemetryService.instance;
      final stats = await service.runWarmPathBenchmark(iterations: 8);

      expect(stats.totalCount, equals(8));
      expect(stats.averageLatencyMs, greaterThan(0.0));
      expect(service.allLogs.length, greaterThanOrEqualTo(8));
      expect(service.isBenchmarking, isFalse);
    });
  });
}
