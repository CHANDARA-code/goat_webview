import SwiftUI
import GoatWebView

/**
 * Domain Mini-App Container View Wrapper for iOS Showcase.
 */
struct MiniAppContainerView: View {
    let tab: GoatShowcaseTab
    @ObservedObject var navBarState: GoatNavBarState
    @ObservedObject var telemetryManager: GoatTelemetryManager = .shared

    var body: some View {
        GoatShowcaseContainerView(
            tab: tab,
            navBarState: navBarState,
            telemetryManager: telemetryManager
        )
    }
}
