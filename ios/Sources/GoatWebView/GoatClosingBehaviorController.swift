import Foundation

/**
 * Mini-app closing and swipe-dismiss behaviour (Task 10173, iOS side).
 *
 * A mini-app mid-form-entry sets `needConfirmation` so the host asks before dismissing, and leaves
 * `allowVerticalSwipe` false so the container's drag-to-dismiss gesture cannot pull the sheet away.
 *
 * Both flags are per-route rather than per-mini-app and reset when a new route loads, so a
 * confirmation armed on a form screen cannot keep blocking dismissal once the user has navigated
 * off it. Mirrors the Android controller so the bridge behaves identically on both platforms.
 */
public final class GoatClosingBehaviorController: @unchecked Sendable {

    public static let shared = GoatClosingBehaviorController()

    private let lock = NSLock()
    private var _needConfirmation = false
    private var _allowVerticalSwipe = false

    public init() {}

    /// True when a dismissal must route through a confirmation dialog first.
    public var needConfirmation: Bool {
        lock.lock(); defer { lock.unlock() }
        return _needConfirmation
    }

    /// True when the container-level vertical drag-to-dismiss gesture is permitted.
    public var allowVerticalSwipe: Bool {
        lock.lock(); defer { lock.unlock() }
        return _allowVerticalSwipe
    }

    public func setNeedConfirmation(_ value: Bool) {
        lock.lock(); _needConfirmation = value; lock.unlock()
    }

    public func setAllowVerticalSwipe(_ value: Bool) {
        lock.lock(); _allowVerticalSwipe = value; lock.unlock()
    }

    /**
     * Called when a new mini-app route loads.
     *
     * Without this a mini-app that armed confirmation on a form screen would keep intercepting
     * dismissal on an unrelated route, asking the user to discard changes that do not exist.
     */
    public func resetForNewRoute() {
        lock.lock()
        _needConfirmation = false
        _allowVerticalSwipe = false
        lock.unlock()
    }

    /**
     * Whether a close request should be intercepted.
     *
     * Its own function rather than reading `needConfirmation` at each call site, so every dismissal
     * path -- back gesture, edge swipe, native close button -- asks the same question.
     */
    public func shouldConfirmClose() -> Bool { needConfirmation }

    internal func resetForTesting() { resetForNewRoute() }
}
