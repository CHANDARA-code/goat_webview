# ``GoatWebView``

Goat WebView is a high-performance, multi-tenant embedded mini-app runtime and native bridge engine for iOS.

## Overview

Goat WebView provides an enterprise-grade WKWebView container architecture featuring:
- **Zero-Trust URL Isolation**: Enforces canonical path traversal guards and custom URL scheme handling (`goat://app/`).
- **141-Action Native Bridge Parity**: Fast, thread-safe message passing between JavaScript and native Swift via `GoatScriptMessageHandler`.
- **Multi-Tenant Sandboxing**: Cryptographically isolated `GoatSecureStorageManager` with dedicated Keychain access groups per mini-app.
- **Renderer Crash Resilience**: Automatic `GoatWebProcessTerminationHandler` with memory budget enforcement and state restoration.
- **Hardware Acceleration**: Metal-backed compositing and responsive gesture coordination for bottom sheets and navigation bars.

## Topics

### Core Engine Architecture
- ``GoatView``
- ``GoatWKWebView``
- ``GoatHeadlessWebView``
- ``GoatURLSchemeHandler``
- ``GoatWebProcessTerminationHandler``

### Bridge & Messaging Subsystem
- ``GoatScriptMessageHandler``
- ``GoatChannelManager``
- ``GoatBridgePlugin``
- ``GoatEventCoalescer``

### Storage & Security
- ``GoatStorageManager``
- ``GoatSecureStorageManager``
- ``GoatCookieManager``
- ``GoatAbuseGuard``
- ``GoatExternalLinkWarningDialog``
- ``GoatPermissionPrimingDialog``

### UI Components & Overlays
- ``GoatNavigationBar``
- ``GoatBottomSheet``
- ``GoatBottomSheetTabsOverlay``
- ``GoatWindowedContainer``
- ``GoatSafeAreaManager``
- ``GoatHapticFeedback``
- ``GoatSwiftUIView``

### Network & Dynamic Updates
- ``GoatRemoteManager``
- ``GoatDeltaPatcher``
- ``GoatOAuthSessionManager``
