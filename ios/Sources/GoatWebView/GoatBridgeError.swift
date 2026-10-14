import Foundation

/**
 * Errors thrown by the GoatWebView native bridge and security subsystems.
 *
 * Extracted into its own file so it is available on all platforms (macOS, iOS, etc.) without
 * depending on UIKit or WKWebView. This lets non-UIKit managers (GoatSslPinningManager,
 * GoatWebSocketManager, GoatOAuthSessionManager, GoatNavigationBar) use it without
 * requiring an `#if os(iOS)` guard.
 */
public enum GoatBridgeError: Error, LocalizedError, Equatable {
    case unsupportedAction(String)
    case invalidPayload(String)
    case viewDisposed
    case securityViolation(String)
    /// Thrown when biometric / device-passcode authentication fails or is cancelled.
    case authFailed(String)
    /// Thrown when an outbound URL is blocked by SSRF-protection rules.
    case ssrfBlocked(String)
    /// Thrown when a feature is not supported on the current OS version.
    case notSupported(String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedAction(let action):
            return "Unsupported native action: \(action)"
        case .invalidPayload(let msg):
            return "Invalid payload: \(msg)"
        case .viewDisposed:
            return "WebView instance disposed"
        case .securityViolation(let reason):
            return "Security violation: \(reason)"
        case .authFailed(let code):
            return "Authentication failed: \(code)"
        case .ssrfBlocked(let reason):
            return "SSRF blocked: \(reason)"
        case .notSupported(let msg):
            return "Not supported: \(msg)"
        }
    }
}

