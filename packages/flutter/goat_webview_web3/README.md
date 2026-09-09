# goat_webview_web3

Modular Web3 & Wallet Signing Capability Companion Package for Goat WebView.

Registers a `GoatCapabilityPlugin` for the `web3` namespace and routes its actions
over the existing `com.goat.webview/bridge_<viewId>` channel — it adds no new IPC surface.

```dart
import 'package:goat_webview_web3/goat_webview_web3.dart';

GoatWeb3CapabilityPlugin.register();
GoatWeb3CapabilityPlugin.attachTo(controller);
```

Every action it declares is checked against real engine dispatch by
`scripts/verify-flutter-companion-actions.mjs`.
