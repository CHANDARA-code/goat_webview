# goat_webview_sensors

Modular Hardware Sensors Capability Companion Package for Goat WebView.

Registers a `GoatCapabilityPlugin` for the `sensors` namespace and routes its actions
over the existing `com.goat.webview/bridge_<viewId>` channel — it adds no new IPC surface.

```dart
import 'package:goat_webview_sensors/goat_webview_sensors.dart';

GoatSensorsCapabilityPlugin.register();
GoatSensorsCapabilityPlugin.attachTo(controller);
```

Every action it declares is checked against real engine dispatch by
`scripts/verify-flutter-companion-actions.mjs`.
