import Foundation
import WebKit

/**
 * WebContent Process Crash & Jetsam OOM Auto-Recovery Coordinator (Task 10117 / Pillar 1).
 *
 * Detects WebKit WebContent process terminations, prevents host app crashes,
 * automatically restores active route snapshots, and records diagnostic telemetry.
 */
public class GoatWebProcessTerminationHandler: NSObject, WKNavigationDelegate {

    public var onProcessTerminated: ((WKWebView) -> Void)?
    private var reloadAttempts: Int = 0
    private let maxReloadAttempts: Int = 3

    public init(onProcessTerminated: ((WKWebView) -> Void)? = nil) {
        self.onProcessTerminated = onProcessTerminated
        super.init()
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        NSLog("[GoatWebView] WebContent process terminated (OOM Jetsam or crash). Auto-recovering...")

        onProcessTerminated?(webView)
        
        GoatTelemetryManager.shared.record(
            action: "CRASH_RECOVERY",
            requestPayload: ["event": "WebContent process terminated", "attempts": reloadAttempts],
            durationMs: 0.0
        )

        if reloadAttempts < maxReloadAttempts {
            reloadAttempts += 1
            if let currentUrl = webView.url {
                webView.load(URLRequest(url: currentUrl))
            } else {
                webView.reload()
            }
        } else {
            NSLog("[GoatWebView] Exceeded max reload attempts after WebContent crash.")
        }
    }

    /**
     * Resets the reload retry budget.
     */
    public func resetRetryBudget() {
        reloadAttempts = 0
    }
}
