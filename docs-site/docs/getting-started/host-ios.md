---
sidebar_position: 7
title: iOS Host Integration (SwiftUI & Swift)
---

# iOS Host Integration (SwiftUI, Swift & UIKit)

The **Goat iOS Framework** (`GoatWebView`) delivers hardware-accelerated WebKit rendering for iOS apps using **SwiftUI** and **UIKit**. It provides native 120Hz interactive edge-swipe gestures, `goat://` custom URL scheme streaming, async `WKScriptMessageHandlerWithReply` IPC dispatching, and WebContent process crash recovery.

---

## 📦 Installation

### Swift Package Manager (Recommended)

In Xcode, select **File > Add Package Dependencies...** and enter:
```text
https://github.com/goat-webview/goatwebview.git
```
Or specify in your `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/goat-webview/goatwebview.git", from: "1.0.0")
]
```

### CocoaPods

Add `GoatWebView` to your `Podfile`:
```ruby
pod 'GoatWebView', '~> 1.0.0'
```

---

## 🚀 SwiftUI Integration (`GoatSwiftUIView`)

`GoatSwiftUIView` wraps the native WebKit container via `UIViewRepresentable` using the **Coordinator Pattern**, keeping bridge callbacks, navigation state, and error handling perfectly synchronized with SwiftUI state:

```swift
import SwiftUI
import GoatWebView

struct MiniAppHostScreen: View {
    @State private var isLoaded = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            GoatSwiftUIView(
                appId: "finance_app",
                initialRoute: "/dashboard",
                onBridgeMessage: { action, payload in
                    handleBridgeMessage(action: action, payload: payload)
                },
                onPageLoaded: { url in
                    withAnimation {
                        isLoaded = true
                    }
                },
                onError: { description in
                    errorMessage = description
                }
            )
            .edgesIgnoringSafeArea(.all)

            if !isLoaded {
                ProgressView("Loading Mini-App...")
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(12)
            }
        }
    }

    private func handleBridgeMessage(action: String, payload: [String: Any]) {
        print("Received bridge action: \(action) with payload: \(payload)")
    }
}
```

---

## 🏛️ UIKit Integration (`GoatView`)

For UIKit-based host architectures, instantiate `GoatView` directly in a `UIViewController`:

```swift
import UIKit
import GoatWebView

class MiniAppViewController: UIViewController {
    private var goatView: GoatView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // 1. Create and position GoatView
        goatView = GoatView(frame: view.bounds)
        goatView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(goatView)

        // 2. Set event handlers
        goatView.onBridgeAction = { [weak self] action, payload in
            return self?.handleAction(action, payload: payload) ?? [:]
        }

        goatView.onPageFinished = { url in
            print("Mini-App finished loading: \(url)")
        }

        goatView.onError = { error in
            print("Mini-App error: \(error)")
        }

        // 3. Initialize mini-app tenant container
        goatView.initialize(appId: "finance_app", initialRoute: "/")
    }

    private func handleAction(_ action: String, payload: [String: Any]) -> [String: Any] {
        switch action {
        case "NATIVE_GET_SESSION_TOKEN":
            return ["token": "session_tok_abc123", "expiresIn": 3600]
        default:
            return [:]
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isMovingFromParent {
            goatView.destroy()
        }
    }
}
```

---

## ⚙️ Core Technical Architecture

### 1. Custom URL Scheme Asset Routing (`GoatURLSchemeHandler`)

To eliminate `file:///` sandbox risks and Same-Origin Policy (CORS) blocks, all mini-app bundles are served via a custom scheme handler:

```
goat://assets/{appId}/index.html
```

- Intercepts requests in-process via `WKURLSchemeHandler`.
- Validates canonical path sandboxing to block directory traversal (`../`).
- Streams local file bytes into `WKURLSchemeTask` with appropriate MIME types (`application/javascript`, `application/wasm`, `text/html`).

### 2. Async Script Message Handlers (`GoatScriptMessageHandler`)

IPC messages dispatched from mini-app JavaScript (`window.webkit.messageHandlers.GoatBridge.postMessage(...)`) are handled with iOS 14+ `WKScriptMessageHandlerWithReply`:

```swift
public func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping (Any?, String?) -> Void
) {
    // 1. Validate payload JSON structure
    // 2. Dispatch to registered native capability handler
    // 3. Enforce strict once-only reply invocation
}
```

### 3. WebContent Process Termination Recovery

When iOS experiences extreme memory pressure, the OS may terminate the out-of-process `WebContent` process (Jetsam). Goat WebView intercepts `webViewWebContentProcessDidTerminate(_:)`:
- Captures the current route state and session ID.
- Automatically reloads the container and re-injects the session snapshot with exponential backoff retries, preventing blank screens or app crashes.

### 4. Native 120Hz Interactive Pop Gesture

By setting `allowsBackForwardNavigationGestures = true` and coordinating edge-swipe recognizers with UIKit navigation controllers, mini-app page transitions respond to iOS interactive back-swipe gestures with native 120 FPS ProMotion fluid dynamics.
