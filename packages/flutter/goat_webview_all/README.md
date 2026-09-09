# goat_webview_all

Option B umbrella: every Goat WebView Flutter capability companion in one dependency.

```dart
import 'package:goat_webview_all/goat_webview_all.dart';

registerAllGoatCapabilities();
attachAllGoatCapabilities(controller);
// ...
detachAllGoatCapabilities();
```

Prefer depending on the individual `goat_webview_*` packages (Option A) if you only need a few
capabilities. Note this umbrella is Dart-side only — it does not change native linking.
