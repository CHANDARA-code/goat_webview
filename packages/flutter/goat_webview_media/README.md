# goat_webview_media

Modular Media Capability Companion Package for [Goat WebView](https://pub.dev/packages/goat_webview).

## Getting Started

Add `goat_webview_media` and `goat_webview` to your `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0
  goat_webview_media: ^1.0.0
```

## Usage — registration is two steps

This companion package needs **both** steps. `register()` alone claims the `media` namespace but
dispatch still throws a `StateError` until the plugin is attached to a live controller.

**1. Register the plugin once at startup**, before `runApp`:

```dart
import 'package:goat_webview_media/goat_webview_media.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoatMediaCapabilityPlugin.register();
  runApp(const MyApp());
}
```

**2. Attach it to every `GoatWebView` controller** in `onWebViewCreated`:

```dart
GoatWebView(
  appId: 'com.example.miniapp',
  initialUrl: 'https://appassets.androidplatform.net/assets/index.html',
  onWebViewCreated: (controller) {
    GoatMediaCapabilityPlugin.attachTo(controller);
  },
)
```

Skipping step 2 is the most common integration mistake: the mini-app's `media` bridge calls fail at
runtime even though the package is installed and registered correctly.

## License

MIT License. See [LICENSE](LICENSE) for details.
