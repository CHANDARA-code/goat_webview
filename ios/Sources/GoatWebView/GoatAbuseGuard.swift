import Foundation

/**
 * Generic Anti-Abuse Guardrails Manager for iOS (Task 10199 / Pillar 3).
 *
 * Implements:
 * 1. User-gesture freshness gate (default 10s window) for privileged actions.
 * 2. Repeated dialog cooldown (blocks > 3 dialog requests of the same type within 3s).
 */
public class GoatAbuseGuard {
    public static let shared = GoatAbuseGuard()

    public static let privilegedActions: Set<String> = [
        "BIOMETRIC_AUTH",
        "GET_LOCATION",
        "CHOOSE_LOCATION",
        "OPEN_LOCATION",
        "SHARE_SHEET",
        "SHARE_TO_STORY",
        "MAKE_PHONE_CALL",
        "SEND_SMS",
        "IAP_PURCHASE",
        "OPEN_INVOICE",
        "WEB3_SIGN_TRANSACTION",
        "WEB3_SIGN_MESSAGE",
        "CANCEL_PAYMENT"
    ]

    private let lock = NSLock()
    private var lastUserTouchTimestamp: TimeInterval = Date().timeIntervalSince1970
    private var dialogRequestTimestamps: [String: [TimeInterval]] = [:]

    public let defaultGestureWindow: TimeInterval
    public let maxDialogRequests: Int
    public let dialogWindow: TimeInterval

    public init(
        defaultGestureWindow: TimeInterval = 10.0,
        maxDialogRequests: Int = 3,
        dialogWindow: TimeInterval = 3.0
    ) {
        self.defaultGestureWindow = defaultGestureWindow
        self.maxDialogRequests = maxDialogRequests
        self.dialogWindow = dialogWindow
    }

    /**
     * Records a genuine user touch/tap gesture.
     */
    public func recordUserGesture(at timestamp: TimeInterval = Date().timeIntervalSince1970) {
        lock.lock()
        defer { lock.unlock() }
        lastUserTouchTimestamp = timestamp
    }

    /**
     * Verifies if the most recent user touch is fresh within the allowed window.
     */
    public func isGestureFresh(window: TimeInterval? = nil, now: TimeInterval = Date().timeIntervalSince1970) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let allowed = window ?? defaultGestureWindow
        return (now - lastUserTouchTimestamp) <= allowed
    }

    /**
     * Checks if a native dialog type should be throttled due to rapid spam (> maxDialogRequests in dialogWindow).
     */
    public func shouldThrottleDialog(
        dialogType: String,
        maxRequests: Int? = nil,
        window: TimeInterval? = nil,
        now: TimeInterval = Date().timeIntervalSince1970
    ) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let limit = maxRequests ?? maxDialogRequests
        let win = window ?? dialogWindow

        var timestamps = dialogRequestTimestamps[dialogType] ?? []
        // Purge expired timestamps
        timestamps = timestamps.filter { (now - $0) <= win }

        if timestamps.count >= limit {
            dialogRequestTimestamps[dialogType] = timestamps
            return true
        }

        timestamps.append(now)
        dialogRequestTimestamps[dialogType] = timestamps
        return false
    }

    /**
     * Resets abuse guard state.
     */
    public func reset() {
        lock.lock()
        defer { lock.unlock() }
        lastUserTouchTimestamp = 0
        dialogRequestTimestamps.removeAll()
    }
}
