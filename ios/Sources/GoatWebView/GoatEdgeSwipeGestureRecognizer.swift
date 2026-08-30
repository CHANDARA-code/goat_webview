import Foundation
#if canImport(UIKit)
import UIKit
#endif

/**
 * Screen edge specification for edge swipe gestures.
 * - left (0): Swiping from the left edge towards the right.
 * - right (1): Swiping from the right edge towards the left.
 */
public enum GoatSwipeEdge: Int, CaseIterable, Codable, Sendable {
    case left = 0
    case right = 1
}

/**
 * Specialized UIPanGestureRecognizer subclass that tracks interactive finger drags originating
 * strictly from screen edge margins (<= 25pt default) with horizontal-dominant velocity gating.
 *
 * Implements iOS Interactive Edge-Swipe navigation (Task 10126 §R2) coordinating 120 FPS
 * view controller pop transitions and avoiding touch deadlocks with internal Web horizontal
 * scroll views (carousels, tabs, maps).
 */
#if canImport(UIKit)
open class GoatEdgeSwipeGestureRecognizer: UIPanGestureRecognizer, UIGestureRecognizerDelegate {

    /// Configurable swipe edge boundary (.left = 0, .right = 1).
    public var swipeEdge: GoatSwipeEdge = .left

    /// Maximum distance from the screen edge (in points) within which touch must originate. Default: 25.0 pt.
    public var edgeThreshold: CGFloat = 25.0

    /// Whether vertical drags are permitted to trigger the edge gesture. Default: false.
    public var allowVerticalSwipe: Bool = false

    /// The recorded initial touch position in view coordinates.
    public private(set) var touchOrigin: CGPoint = .zero

    /// The timestamp when the gesture first began tracking.
    public private(set) var initialTouchTimestamp: TimeInterval = 0

    /// Optional closure callback triggered whenever gesture state updates.
    public var onGestureChanged: ((GoatEdgeSwipeGestureRecognizer) -> Void)?

    // MARK: - Initializers

    public init(
        target: Any?,
        action: Selector?,
        swipeEdge: GoatSwipeEdge = .left,
        edgeThreshold: CGFloat = 25.0
    ) {
        self.swipeEdge = swipeEdge
        self.edgeThreshold = edgeThreshold
        super.init(target: target, action: action)
        configureDefaults()
    }

    public override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        configureDefaults()
    }

    public required init?(coder: NSCoder) {
        super.init(target: nil, action: nil)
        configureDefaults()
    }

    private func configureDefaults() {
        maximumNumberOfTouches = 1
        minimumNumberOfTouches = 1
        cancelsTouchesInView = true
        delegate = self
        addTarget(self, action: #selector(handleInternalGestureAction(_:)))
    }

    @objc private func handleInternalGestureAction(_ sender: GoatEdgeSwipeGestureRecognizer) {
        onGestureChanged?(sender)
    }

    // MARK: - Lifecycle & State

    open override func reset() {
        super.reset()
        touchOrigin = .zero
        initialTouchTimestamp = 0
    }

    open override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)

        guard let firstTouch = touches.first, let targetView = self.view else {
            state = .failed
            return
        }

        let location = firstTouch.location(in: targetView)
        touchOrigin = location
        initialTouchTimestamp = event.timestamp

        // Gate recognition: touch must start strictly within the edge margin
        if !isTouchWithinEdge(location, bounds: targetView.bounds) {
            state = .failed
        }
    }

    open override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)

        if state == .possible || state == .began {
            guard let targetView = self.view else { return }
            let vel = velocity(in: targetView)

            // If vertical scroll intent dominates and vertical swipes are disallowed, fail gesture
            if !allowVerticalSwipe && abs(vel.y) > abs(vel.x) && (abs(vel.y) > 20.0 || abs(vel.x) > 20.0) {
                state = .failed
            }
        }
    }

    // MARK: - Edge & Direction Validation Helpers

    /**
     * Evaluates whether a touch origin point falls within the active edge threshold boundary.
     */
    public func isTouchWithinEdge(_ point: CGPoint, bounds: CGRect) -> Bool {
        guard bounds.width > 0 else { return false }
        switch swipeEdge {
        case .left:
            return point.x >= 0 && point.x <= edgeThreshold
        case .right:
            return point.x >= (bounds.width - edgeThreshold) && point.x <= bounds.width
        }
    }

    /**
     * Evaluates whether a velocity vector is horizontally dominant and moving in the valid swipe direction.
     */
    public func validateVelocity(_ velocity: CGPoint) -> Bool {
        let absVx = abs(velocity.x)
        let absVy = abs(velocity.y)

        // Must be horizontally dominant
        guard absVx > absVy else { return false }

        // Must travel in the correct direction
        switch swipeEdge {
        case .left:
            return velocity.x > 0
        case .right:
            return velocity.x < 0
        }
    }

    // MARK: - UIGestureRecognizerDelegate

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let targetView = self.view else { return false }
        let vel = velocity(in: targetView)
        return validateVelocity(vel)
    }

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // Prevent simultaneous recognition with internal horizontal scroll gestures when tracking
        if state == .began || state == .changed {
            return false
        }
        return false
    }

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // When touch originates at the screen edge, edge swipe takes priority over inner scroll pans
        if otherGestureRecognizer is UIPanGestureRecognizer && otherGestureRecognizer != self {
            if let targetView = self.view, isTouchWithinEdge(touchOrigin, bounds: targetView.bounds) {
                return true
            }
        }
        return false
    }

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRequireFailureOf otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        return false
    }
}
#endif
