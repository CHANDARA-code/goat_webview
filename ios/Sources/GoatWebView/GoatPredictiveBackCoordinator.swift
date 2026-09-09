import Foundation
#if canImport(UIKit)
import UIKit
#endif

/**
 * Predictive Back Gesture Lifecycle State.
 */
public enum GoatBackGestureState: String, CaseIterable, Codable, Sendable {
    case idle = "IDLE"
    case started = "STARTED"
    case progressing = "PROGRESSING"
    case committed = "COMMITTED"
    case cancelled = "CANCELLED"
}

/**
 * Listener protocol for monitoring interactive predictive back gesture events.
 */
public protocol GoatPredictiveBackListener: AnyObject {
    func onBackStarted(swipeEdge: Int, touchX: Float, touchY: Float)
    func onBackProgressed(progress: Float, touchX: Float, touchY: Float, swipeEdge: Int, transform: GoatPredictiveBackCoordinator.TransformResult)
    func onBackInvoked()
    func onBackCancelled()
}

/**
 * iOS Interactive Edge-Swipe Coordinator & Predictive Back Physics Engine.
 *
 * Coordinates 120 FPS visual transform interpolations (scale 1.0->0.90, alpha 1.0->0.85, translation 0->±150pt),
 * gesture lifecycle state transitions, history depth tracking, commit/abort thresholds (50% progress or >500pt/s velocity),
 * and spring-back restoration matching Android 14+ Predictive Back parity (Task 10126 §R2).
 */
public class GoatPredictiveBackCoordinator: @unchecked Sendable {

    public typealias GestureState = GoatBackGestureState

    /// Shared singleton instance.
    public static let shared = GoatPredictiveBackCoordinator()

    // MARK: - Transform Result Model

    public struct TransformResult: Equatable, Sendable {
        /// Clamped gesture progress in range [0.0, 1.0].
        public let progress: Float
        /// Interpolated scale factor (1.0 -> 0.90).
        public let scale: Float
        /// Interpolated opacity alpha (1.0 -> 0.85).
        public let alpha: Float
        /// Interpolated horizontal translation in points (0 -> ±150.0 pt).
        public let translationX: Float
        /// Interpolated corner radius in points (0 -> 16.0 pt).
        public let cornerRadius: Float
        /// Active swipe edge (0 = Left, 1 = Right).
        public let swipeEdge: Int

        public init(progress: Float, swipeEdge: Int = 0) {
            let clamped = min(max(progress, 0.0), 1.0)
            self.progress = clamped
            self.swipeEdge = swipeEdge
            self.scale = 1.0 - (clamped * 0.10)
            self.alpha = 1.0 - (clamped * 0.15)
            self.translationX = (swipeEdge == 0) ? (clamped * 150.0) : (-clamped * 150.0)
            self.cornerRadius = clamped * 16.0
        }

        public var scaleCGFloat: CGFloat { CGFloat(scale) }
        public var alphaCGFloat: CGFloat { CGFloat(alpha) }
        public var translationXCGFloat: CGFloat { CGFloat(translationX) }
        public var cornerRadiusCGFloat: CGFloat { CGFloat(cornerRadius) }

        #if canImport(UIKit)
        /// Combined CGAffineTransform representation.
        public var transform: CGAffineTransform {
            let translation = CGAffineTransform(translationX: CGFloat(translationX), y: 0)
            let scaling = CGAffineTransform(scaleX: CGFloat(scale), y: CGFloat(scale))
            return scaling.concatenating(translation)
        }
        #endif

        /// Converts physics transform properties into standard bridge dictionary payload.
        public func toDictionary() -> [String: Any] {
            return [
                "action": "PROGRESS",
                "handled": true,
                "progress": Double(progress),
                "interpolatedScale": Double(scale),
                "interpolatedAlpha": Double(alpha),
                "interpolatedTranslationX": Double(translationX),
                "cornerRadius": Double(cornerRadius),
                "swipeEdge": swipeEdge
            ]
        }
    }

    // MARK: - Internal Synchronization & State

    private let lock = NSLock()
    private var _state: GestureState = .idle
    private var _historyDepth: Int = 1
    private var _currentSwipeEdge: Int = 0
    private var _currentProgress: Float = 0.0

    // MARK: - Listeners Registry

    private final class WeakListener {
        weak var value: GoatPredictiveBackListener?
        init(_ value: GoatPredictiveBackListener) {
            self.value = value
        }
    }

    private var listeners: [WeakListener] = []

    // Closure observer registry
    public var onGestureStarted: ((_ swipeEdge: Int, _ touchX: Float, _ touchY: Float) -> Void)?
    public var onGestureProgress: ((_ progress: Float, _ touchX: Float, _ touchY: Float, _ swipeEdge: Int, _ transform: TransformResult) -> Void)?
    public var onGestureInvoked: (() -> Void)?
    public var onGestureCancelled: (() -> Void)?

    // MARK: - Initializer

    public init(initialHistoryDepth: Int = 1) {
        self._historyDepth = max(1, initialHistoryDepth)
    }

    // MARK: - Public State Accessors

    public var state: GestureState {
        lock.lock()
        defer { lock.unlock() }
        return _state
    }

    public var historyDepth: Int {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _historyDepth
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _historyDepth = max(1, newValue)
        }
    }

    public var canGoBack: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _historyDepth > 1
    }

    public var currentSwipeEdge: Int {
        lock.lock()
        defer { lock.unlock() }
        return _currentSwipeEdge
    }

    public var currentProgress: Float {
        lock.lock()
        defer { lock.unlock() }
        return _currentProgress
    }

    // MARK: - History Stack Management

    public func pushHistory() {
        lock.lock()
        defer { lock.unlock() }
        _historyDepth += 1
    }

    @discardableResult
    public func popHistory() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if _historyDepth > 1 {
            _historyDepth -= 1
            return true
        }
        return false
    }

    // MARK: - Listener Management

    public func addListener(_ listener: GoatPredictiveBackListener) {
        lock.lock()
        defer { lock.unlock() }
        listeners.removeAll(where: { $0.value == nil })
        if !listeners.contains(where: { $0.value === listener }) {
            listeners.append(WeakListener(listener))
        }
    }

    public func removeListener(_ listener: GoatPredictiveBackListener) {
        lock.lock()
        defer { lock.unlock() }
        listeners.removeAll(where: { $0.value == nil || $0.value === listener })
    }

    private func activeListeners() -> [GoatPredictiveBackListener] {
        lock.lock()
        defer { lock.unlock() }
        listeners.removeAll(where: { $0.value == nil })
        return listeners.compactMap { $0.value }
    }

    // MARK: - Physics & Threshold Evaluation

    /**
     * Pure calculation of visual transforms for a given progress and swipe edge.
     */
    public func calculateTransform(progress: Float, swipeEdge: Int = 0) -> TransformResult {
        return TransformResult(progress: progress, swipeEdge: swipeEdge)
    }

    /**
     * Evaluates whether the gesture has met the commit threshold (progress >= 50% or velocity > 500 pt/s).
     */
    public func shouldCommit(progress: Float, velocityX: Float) -> Bool {
        let clamped = min(max(progress, 0.0), 1.0)
        return clamped >= 0.50 || abs(velocityX) > 500.0
    }

    // MARK: - Gesture Lifecycle Methods

    public func startGesture(swipeEdge: Int = 0, touchX: Float = 0, touchY: Float = 0) {
        lock.lock()
        _state = .started
        _currentSwipeEdge = swipeEdge
        _currentProgress = 0.0
        lock.unlock()

        let currentListeners = activeListeners()
        currentListeners.forEach { $0.onBackStarted(swipeEdge: swipeEdge, touchX: touchX, touchY: touchY) }
        onGestureStarted?(swipeEdge, touchX, touchY)
    }

    @discardableResult
    public func updateProgress(
        progress: Float,
        touchX: Float = 0,
        touchY: Float = 0,
        swipeEdge: Int? = nil
    ) -> TransformResult {
        lock.lock()
        _state = .progressing
        if let edge = swipeEdge {
            _currentSwipeEdge = edge
        }
        let edge = _currentSwipeEdge
        let clamped = min(max(progress, 0.0), 1.0)
        _currentProgress = clamped
        lock.unlock()

        let transform = TransformResult(progress: clamped, swipeEdge: edge)
        let currentListeners = activeListeners()
        currentListeners.forEach { $0.onBackProgressed(progress: clamped, touchX: touchX, touchY: touchY, swipeEdge: edge, transform: transform) }
        onGestureProgress?(clamped, touchX, touchY, edge, transform)
        return transform
    }

    @discardableResult
    public func invokeBack() -> [String: Any] {
        lock.lock()
        _state = .committed
        let popped = _historyDepth > 1
        if popped {
            _historyDepth -= 1
        }
        let canGoBackNow = _historyDepth > 1
        let poppedRoute = !popped
        lock.unlock()

        let currentListeners = activeListeners()
        currentListeners.forEach { $0.onBackInvoked() }
        onGestureInvoked?()

        return [
            "action": "COMMITTED",
            "invoked": true,
            "canGoBackInWebView": canGoBackNow,
            "poppedRoute": poppedRoute
        ]
    }

    @discardableResult
    public func cancelBack() -> [String: Any] {
        lock.lock()
        _state = .cancelled
        let canGoBackNow = _historyDepth > 1
        lock.unlock()

        let currentListeners = activeListeners()
        currentListeners.forEach { $0.onBackCancelled() }
        onGestureCancelled?()

        return [
            "action": "CANCELLED",
            "cancelled": true,
            "canGoBackInWebView": canGoBackNow
        ]
    }

    public func reset() {
        lock.lock()
        defer { lock.unlock() }
        _state = .idle
        _currentProgress = 0.0
    }

    // MARK: - Spring-Back Animation Helper

    #if canImport(UIKit)
    /**
     * Smoothly restores a view's transform, opacity, and corner radius to default identity state.
     */
    public static func animateSpringBack(
        view: UIView,
        duration: TimeInterval = 0.25,
        damping: CGFloat = 0.85,
        completion: (() -> Void)? = nil
    ) {
        UIView.animate(
            withDuration: duration,
            delay: 0,
            usingSpringWithDamping: damping,
            initialSpringVelocity: 0,
            options: [.curveEaseOut, .allowUserInteraction]
        ) {
            view.transform = .identity
            view.alpha = 1.0
            view.layer.cornerRadius = 0
        } completion: { _ in
            completion?()
        }
    }

    public func animateSpringBack(
        view: UIView,
        duration: TimeInterval = 0.25,
        damping: CGFloat = 0.85,
        completion: (() -> Void)? = nil
    ) {
        Self.animateSpringBack(view: view, duration: duration, damping: damping, completion: completion)
    }

    // MARK: - View Interactive Drag Coordinator

    /**
     * Attaches an edge swipe gesture recognizer to a target view and coordinates 120 FPS interactive pop animations.
     */
    @discardableResult
    public func attach(
        to view: UIView,
        swipeEdge: GoatSwipeEdge = .left,
        edgeThreshold: CGFloat = 25.0,
        targetViewController: UIViewController? = nil,
        onPop: (() -> Void)? = nil
    ) -> GoatEdgeSwipeGestureRecognizer {
        let recognizer = GoatEdgeSwipeGestureRecognizer(
            target: nil,
            action: nil,
            swipeEdge: swipeEdge,
            edgeThreshold: edgeThreshold
        )
        // Task 10173: the recognizer already had this knob but nothing could set it. The
        // container-level dismiss gesture honours the mini-app's SETUP_SWIPE_BEHAVIOR; the
        // WebView's own DOM scrolling is unaffected, since this only gates the edge recognizer.
        recognizer.allowVerticalSwipe = GoatClosingBehaviorController.shared.allowVerticalSwipe

        let edgeInt = swipeEdge.rawValue

        recognizer.onGestureChanged = { [weak self, weak view, weak targetViewController] gesture in
            guard let self = self, let view = view else { return }

            let translation = gesture.translation(in: view)
            let velocity = gesture.velocity(in: view)
            let touchLoc = gesture.location(in: view)
            let viewWidth = max(view.bounds.width, 1.0)
            let rawProgress = Float(abs(translation.x) / viewWidth)

            switch gesture.state {
            case .began:
                self.startGesture(swipeEdge: edgeInt, touchX: Float(touchLoc.x), touchY: Float(touchLoc.y))
            case .changed:
                let transform = self.updateProgress(
                    progress: rawProgress,
                    touchX: Float(touchLoc.x),
                    touchY: Float(touchLoc.y),
                    swipeEdge: edgeInt
                )
                view.transform = transform.transform
                view.alpha = transform.alphaCGFloat
                view.layer.cornerRadius = transform.cornerRadiusCGFloat
                view.layer.masksToBounds = transform.cornerRadius > 0
            case .ended:
                if self.shouldCommit(progress: rawProgress, velocityX: Float(velocity.x)) {
                    let result = self.invokeBack()
                    let poppedRoute = (result["poppedRoute"] as? Bool) ?? false
                    if poppedRoute {
                        if let nav = targetViewController?.navigationController {
                            nav.popViewController(animated: true)
                        } else if let vc = targetViewController {
                            vc.dismiss(animated: true)
                        } else {
                            onPop?()
                        }
                    } else {
                        onPop?()
                    }
                    Self.animateSpringBack(view: view)
                } else {
                    self.cancelBack()
                    Self.animateSpringBack(view: view)
                }
            case .cancelled, .failed:
                self.cancelBack()
                Self.animateSpringBack(view: view)
            default:
                break
            }
        }

        view.addGestureRecognizer(recognizer)
        return recognizer
    }
    #endif
}
