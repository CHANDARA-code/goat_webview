# goat_webview_network

Modular Network & SSL Security Capability Companion Package for [Goat WebView](https://pub.dev/packages/goat_webview).

## Getting Started

Add `goat_webview_network` and `goat_webview` to your `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0
  goat_webview_network: ^1.0.0
```

## Usage — registration is two steps

This companion package needs **both** steps. `register()` alone claims the `network` namespace but
dispatch still throws a `StateError` until the plugin is attached to a live controller.

**1. Register the plugin once at startup**, before `runApp`:

```dart
import 'package:goat_webview_network/goat_webview_network.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoatNetworkCapabilityPlugin.register();
  runApp(const MyApp());
}
```

**2. Attach it to every `GoatWebView` controller** in `onWebViewCreated`:

```dart
GoatWebView(
  appId: 'com.example.miniapp',
  initialUrl: 'https://appassets.androidplatform.net/assets/index.html',
  onWebViewCreated: (controller) {
    GoatNetworkCapabilityPlugin.attachTo(controller);
  },
)
```

Skipping step 2 is the most common integration mistake: the mini-app's `network` bridge calls fail at
runtime even though the package is installed and registered correctly.

## License

MIT License. See [LICENSE](LICENSE) for details.
