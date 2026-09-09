import Foundation
import React

/**
 * `RCTViewManager` mounting `GoatWebViewViewIOS` for the `<GoatWebView />` React Native component
 * (Task 10164), the iOS counterpart of `GoatWebViewManager.kt`. Uses the classic view-manager
 * bridge (matching this package's existing Android implementation, which also predates Fabric
 * codegen — see Task 10143 for the future New Architecture migration) rather than a Fabric
 * component, so no additional codegen step is required to link this module.
 */
@objc(GoatWebViewManager)
public final class GoatWebViewManager: RCTViewManager {

    public override static func requiresMainQueueSetup() -> Bool {
        true
    }

    public override func view() -> UIView! {
        GoatWebViewViewIOS(frame: .zero)
    }

    @objc public func goBack(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.goBack()
        }
    }

    @objc public func goForward(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.goForward()
        }
    }

    @objc public func reload(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.reload()
        }
    }

    @objc public func stopLoading(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.stopLoading()
        }
    }

    @objc public func injectJavaScript(_ reactTag: NSNumber, script: String) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.injectJavaScript(script)
        }
    }

    @objc public func requestFocus(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.requestFocus()
        }
    }

    @objc public func postMessage(_ reactTag: NSNumber, data: String) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.postMessage(data)
        }
    }

    @objc public func clearFormData(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.clearFormData()
        }
    }

    @objc public func clearCache(_ reactTag: NSNumber, includeDiskFiles: Bool) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.clearCache(includeDiskFiles)
        }
    }

    @objc public func clearHistory(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            (viewRegistry?[reactTag] as? GoatWebViewViewIOS)?.clearHistory()
        }
    }
}
