import Foundation

/**
 * Host-configurable popup and new-window routing policies (Task 10183 / Pillar 1).
 *
 * Defines the routing behavior when `window.open()` or `target="_blank"` link taps
 * are intercepted in sandboxed mini-app WebViews.
 */
public enum GoatPopupRoutingPolicy: String, Codable, CaseIterable, Sendable, Equatable, Hashable {
    /// Same-origin popups route to secondary modal container; cross-origin popups route to system browser.
    case auto = "AUTO"

    /// Always route to OS system browser (Safari) after external link warning confirmation.
    case systemBrowser = "SYSTEM_BROWSER"

    /// Always open in secondary `GoatWindowedContainer` modal WebView sharing tenant sandbox.
    case modal = "MODAL"

    /// Navigate the current WebView frame directly without opening a secondary window.
    case sameFrame = "SAME_FRAME"

    /// Reject and cancel the popup creation request without action.
    case block = "BLOCK"

    /**
     * Parses a string representation into a valid `GoatPopupRoutingPolicy`.
     * Supports both uppercase SNAKE_CASE and camelCase / lowercase variants.
     */
    public init(from string: String?) {
        guard let raw = string?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            self = .auto
            return
        }

        let normalized = raw.uppercased().replacingOccurrences(of: "-", with: "_")
        switch normalized {
        case "AUTO":
            self = .auto
        case "SYSTEM_BROWSER", "SYSTEMBROWSER":
            self = .systemBrowser
        case "MODAL":
            self = .modal
        case "SAME_FRAME", "SAMEFRAME":
            self = .sameFrame
        case "BLOCK", "CANCEL", "REJECT":
            self = .block
        default:
            self = .auto
        }
    }
}
