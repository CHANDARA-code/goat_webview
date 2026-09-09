import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
import 'package:goat_webview_location/goat_webview_location.dart';
import 'package:goat_webview_media/goat_webview_media.dart';
import 'package:goat_webview_network/goat_webview_network.dart';
import 'package:goat_webview_payments/goat_webview_payments.dart';
import 'package:goat_webview_scanner/goat_webview_scanner.dart';
import 'package:goat_webview_sensors/goat_webview_sensors.dart';
import 'package:goat_webview_web3/goat_webview_web3.dart';

export 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
export 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
export 'package:goat_webview_location/goat_webview_location.dart';
export 'package:goat_webview_media/goat_webview_media.dart';
export 'package:goat_webview_network/goat_webview_network.dart';
export 'package:goat_webview_payments/goat_webview_payments.dart';
export 'package:goat_webview_scanner/goat_webview_scanner.dart';
export 'package:goat_webview_sensors/goat_webview_sensors.dart';
export 'package:goat_webview_web3/goat_webview_web3.dart';

/// Option B of the dual-distribution model in TASK_PORTABLE_MINIAPP_DSL_ADAPTERS.md §1: one
/// dependency that pulls every capability companion, for hosts that want the full 18-domain
/// surface without picking modules. Option A remains depending on the individual packages.
///
/// This umbrella is Dart-side only. It does NOT change which native feature modules get linked —
/// `goat_webview/android/build.gradle` decides that, and today it links `:features-all-in`
/// unconditionally.

/// Registers every capability companion with the global [GoatCapabilityRegistry].
void registerAllGoatCapabilities() {
  GoatBiometricsCapabilityPlugin.register();
  GoatBluetoothCapabilityPlugin.register();
  GoatLocationCapabilityPlugin.register();
  GoatMediaCapabilityPlugin.register();
  GoatNetworkCapabilityPlugin.register();
  GoatPaymentsCapabilityPlugin.register();
  GoatScannerCapabilityPlugin.register();
  GoatSensorsCapabilityPlugin.register();
  GoatWeb3CapabilityPlugin.register();
}

/// Attaches every registered companion to [controller]'s native bridge channel.
void attachAllGoatCapabilities(GoatWebViewController controller) {
  GoatBiometricsCapabilityPlugin.attachTo(controller);
  GoatBluetoothCapabilityPlugin.attachTo(controller);
  GoatLocationCapabilityPlugin.attachTo(controller);
  GoatMediaCapabilityPlugin.attachTo(controller);
  GoatNetworkCapabilityPlugin.attachTo(controller);
  GoatPaymentsCapabilityPlugin.attachTo(controller);
  GoatScannerCapabilityPlugin.attachTo(controller);
  GoatSensorsCapabilityPlugin.attachTo(controller);
  GoatWeb3CapabilityPlugin.attachTo(controller);
}

/// Detaches every companion from its bridge channel. Call on dispose.
void detachAllGoatCapabilities() {
  GoatBiometricsCapabilityPlugin.detach();
  GoatBluetoothCapabilityPlugin.detach();
  GoatLocationCapabilityPlugin.detach();
  GoatMediaCapabilityPlugin.detach();
  GoatNetworkCapabilityPlugin.detach();
  GoatPaymentsCapabilityPlugin.detach();
  GoatScannerCapabilityPlugin.detach();
  GoatSensorsCapabilityPlugin.detach();
  GoatWeb3CapabilityPlugin.detach();
}
