---
sidebar_position: 2
title: iOS Integration
---

# iOS Framework Integration

Integrate Goat WebView into Swift and SwiftUI applications.

## SwiftUI Integration

```swift
import SwiftUI
import GoatWebView

struct ContentView: View {
    var body: some View {
        GoatSwiftUIView(
            appId: "finance_app",
            initialRoute: "/",
            onBridgeMessage: { action, payload in
                print("Received bridge action: \(action) with payload: \(payload)")
            }
        )
        .edgesIgnoringSafeArea(.all)
    }
}
```

## UIKit Integration

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

        // 2. Set bridge action handler
        goatView.onBridgeAction = { [weak self] action, payload in
            return ["status": "SUCCESS"]
        }

        // 3. Initialize mini-app tenant container
        goatView.initialize(appId: "finance_app", initialRoute: "/")
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isMovingFromParent {
            goatView.destroy()
        }
    }
}
```
