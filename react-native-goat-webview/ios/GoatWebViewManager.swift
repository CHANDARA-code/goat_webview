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
}
