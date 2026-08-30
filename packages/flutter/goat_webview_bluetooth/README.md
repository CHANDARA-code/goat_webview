# goat_webview_bluetooth

Modular Bluetooth Low Energy (BLE) Capability Companion Package for [Goat WebView](https://pub.dev/packages/goat_webview).

## Getting Started

Add `goat_webview_bluetooth` and `goat_webview` to your `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0
  goat_webview_bluetooth: ^1.0.0
```

## Usage — registration is two steps

This companion package needs **both** steps. `register()` alone claims the `bluetooth` namespace but
dispatch still throws a `StateError` until the plugin is attached to a live controller.

**1. Register the plugin once at startup**, before `runApp`:

```dart
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoatBluetoothCapabilityPlugin.register();
  runApp(const MyApp());
}
```

**2. Attach it to every `GoatWebView` controller** in `onWebViewCreated`:

```dart
GoatWebView(
  appId: 'com.example.miniapp',
  initialUrl: 'https://appassets.androidplatform.net/assets/index.html',
  onWebViewCreated: (controller) {
    GoatBluetoothCapabilityPlugin.attachTo(controller);
  },
)
```

Skipping step 2 is the most common integration mistake: the mini-app's `bluetooth` bridge calls fail at
runtime even though the package is installed and registered correctly.

## License

MIT License. See [LICENSE](LICENSE) for details.
