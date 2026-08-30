import SwiftUI
import GoatWebView

/**
 * Floating Developer Debug HUD Wrapper for iOS Showcase.
 */
struct GoatDebugHUDView: View {
    @ObservedObject var telemetryManager: GoatTelemetryManager = .shared
    @ObservedObject var overrideManager: GoatHardwareOverrideManager = .shared

    var body: some View {
        GoatFloatingDebugHUD(
            telemetryManager: telemetryManager,
            overrideManager: overrideManager
        )
    }
}
