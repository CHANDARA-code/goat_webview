#if os(iOS)
import XCTest
#if canImport(UIKit)
#if canImport(UIKit)
import UIKit
#endif
#endif
@testable import GoatWebView

final class GoatNavigationCoordinatorTests: XCTestCase {

    // MARK: - Mock Listener Helper

    private class MockPredictiveBackListener: GoatPredictiveBackListener {
        var startCount = 0
        var progressCount = 0
        var invokeCount = 0
        var cancelCount = 0

        var lastSwipeEdge: Int?
        var lastTouchX: Float?
        var lastTouchY: Float?
        var lastProgress: Float?
        var lastTransform: GoatPredictiveBackCoordinator.TransformResult?

        func onBackStarted(swipeEdge: Int, touchX: Float, touchY: Float) {
            startCount += 1
            lastSwipeEdge = swipeEdge
            lastTouchX = touchX
            lastTouchY = touchY
        }

        func onBackProgressed(
            progress: Float,
            touchX: Float,
            touchY: Float,
            swipeEdge: Int,
            transform: GoatPredictiveBackCoordinator.TransformResult
        ) {
            progressCount += 1
            lastProgress = progress
            lastTouchX = touchX
            lastTouchY = touchY
            lastSwipeEdge = swipeEdge
            lastTransform = transform
        }

        func onBackInvoked() {
            invokeCount += 1
        }

        func onBackCancelled() {
            cancelCount += 1
        }
    }

    // MARK: - 1. Initial State & Default Depth

    func testInitialStateAndDefaultDepth() {
        let coordinator = GoatPredictiveBackCoordinator()
        XCTAssertEqual(coordinator.state, .idle)
        XCTAssertEqual(coordinator.historyDepth, 1)
        XCTAssertFalse(coordinator.canGoBack)
        XCTAssertEqual(coordinator.currentProgress, 0.0)
        XCTAssertEqual(coordinator.currentSwipeEdge, 0)
    }

    // MARK: - 2. 120 FPS Transform Calculations (0%, 50%, 100%)

    func test120FPSTransformCalculations() {
        let coordinator = GoatPredictiveBackCoordinator()

        // 0% progress (Left edge)
        let t0 = coordinator.calculateTransform(progress: 0.0, swipeEdge: 0)
        XCTAssertEqual(t0.progress, 0.0, accuracy: 0.001)
        XCTAssertEqual(t0.scale, 1.0, accuracy: 0.001)
        XCTAssertEqual(t0.alpha, 1.0, accuracy: 0.001)
        XCTAssertEqual(t0.translationX, 0.0, accuracy: 0.001)
        XCTAssertEqual(t0.cornerRadius, 0.0, accuracy: 0.001)
        XCTAssertEqual(t0.swipeEdge, 0)

        // 50% progress (Left edge: scale -> 0.95, alpha -> 0.925, translationX -> +75.0)
        let t50 = coordinator.calculateTransform(progress: 0.5, swipeEdge: 0)
        XCTAssertEqual(t50.progress, 0.5, accuracy: 0.001)
        XCTAssertEqual(t50.scale, 0.95, accuracy: 0.001)
        XCTAssertEqual(t50.alpha, 0.925, accuracy: 0.001)
        XCTAssertEqual(t50.translationX, 75.0, accuracy: 0.001)
        XCTAssertEqual(t50.cornerRadius, 8.0, accuracy: 0.001)

        // 100% progress (Left edge: scale -> 0.90, alpha -> 0.85, translationX -> +150.0)
        let t100 = coordinator.calculateTransform(progress: 1.0, swipeEdge: 0)
        XCTAssertEqual(t100.progress, 1.0, accuracy: 0.001)
        XCTAssertEqual(t100.scale, 0.90, accuracy: 0.001)
        XCTAssertEqual(t100.alpha, 0.85, accuracy: 0.001)
        XCTAssertEqual(t100.translationX, 150.0, accuracy: 0.001)
        XCTAssertEqual(t100.cornerRadius, 16.0, accuracy: 0.001)

        // Dictionary serialization verification
        let dict = t50.toDictionary()
        XCTAssertEqual(dict["action"] as? String, "PROGRESS")
        XCTAssertEqual(dict["handled"] as? Bool, true)
        XCTAssertEqual((dict["interpolatedScale"] as? Double) ?? 0.0, 0.95, accuracy: 0.001)
        XCTAssertEqual((dict["interpolatedAlpha"] as? Double) ?? 0.0, 0.925, accuracy: 0.001)
        XCTAssertEqual((dict["interpolatedTranslationX"] as? Double) ?? 0.0, 75.0, accuracy: 0.001)
        XCTAssertEqual((dict["cornerRadius"] as? Double) ?? 0.0, 8.0, accuracy: 0.001)
    }

    // MARK: - 3. Left Edge vs Right Edge Translation Directions

    func testLeftEdgeVsRightEdgeTranslation() {
        let coordinator = GoatPredictiveBackCoordinator()

        // Left edge (swipeEdge = 0) translation must be positive (+75pt at 50%, +150pt at 100%)
        let leftT = coordinator.calculateTransform(progress: 0.5, swipeEdge: 0)
        XCTAssertEqual(leftT.translationX, 75.0, accuracy: 0.001)
        let leftT100 = coordinator.calculateTransform(progress: 1.0, swipeEdge: 0)
        XCTAssertEqual(leftT100.translationX, 150.0, accuracy: 0.001)

        // Right edge (swipeEdge = 1) translation must be negative (-75pt at 50%, -150pt at 100%)
        let rightT = coordinator.calculateTransform(progress: 0.5, swipeEdge: 1)
        XCTAssertEqual(rightT.translationX, -75.0, accuracy: 0.001)
        let rightT100 = coordinator.calculateTransform(progress: 1.0, swipeEdge: 1)
        XCTAssertEqual(rightT100.translationX, -150.0, accuracy: 0.001)

        // Scale and alpha must be identical regardless of swipe edge
        XCTAssertEqual(leftT.scale, rightT.scale, accuracy: 0.001)
        XCTAssertEqual(leftT.alpha, rightT.alpha, accuracy: 0.001)
    }

    // MARK: - 4. Progress Clamping to [0.0, 1.0]

    func testProgressClamping() {
        let coordinator = GoatPredictiveBackCoordinator()

        // Underflow (-0.5) must clamp to 0.0
        let underflow = coordinator.calculateTransform(progress: -0.5, swipeEdge: 0)
        XCTAssertEqual(underflow.progress, 0.0, accuracy: 0.001)
        XCTAssertEqual(underflow.scale, 1.0, accuracy: 0.001)
        XCTAssertEqual(underflow.alpha, 1.0, accuracy: 0.001)
        XCTAssertEqual(underflow.translationX, 0.0, accuracy: 0.001)

        // Overflow (1.75) must clamp to 1.0
        let overflow = coordinator.calculateTransform(progress: 1.75, swipeEdge: 0)
        XCTAssertEqual(overflow.progress, 1.0, accuracy: 0.001)
        XCTAssertEqual(overflow.scale, 0.90, accuracy: 0.001)
        XCTAssertEqual(overflow.alpha, 0.85, accuracy: 0.001)
        XCTAssertEqual(overflow.translationX, 150.0, accuracy: 0.001)
    }

    // MARK: - 5. Gesture Cancellation & Spring-Back

    func testGestureCancellationAndSpringBack() {
        let coordinator = GoatPredictiveBackCoordinator()
        coordinator.startGesture(swipeEdge: 0, touchX: 10, touchY: 100)
        XCTAssertEqual(coordinator.state, .started)

        coordinator.updateProgress(progress: 0.35, touchX: 80, touchY: 100, swipeEdge: 0)
        XCTAssertEqual(coordinator.state, .progressing)

        let cancelRes = coordinator.cancelBack()
        XCTAssertEqual(cancelRes["action"] as? String, "CANCELLED")
        XCTAssertEqual(coordinator.state, .cancelled)

        #if canImport(UIKit)
        let testView = UIView(frame: CGRect(x: 0, y: 0, width: 300, height: 600))
        testView.transform = CGAffineTransform(translationX: 80, y: 0).scaledBy(x: 0.95, y: 0.95)
        testView.alpha = 0.90
        testView.layer.cornerRadius = 8.0

        let exp = expectation(description: "Spring back animation completion")
        coordinator.animateSpringBack(view: testView) {
            XCTAssertEqual(testView.transform, CGAffineTransform.identity)
            XCTAssertEqual(testView.alpha, 1.0, accuracy: 0.01)
            XCTAssertEqual(testView.layer.cornerRadius, 0.0, accuracy: 0.01)
            exp.fulfill()
        }
        wait(for: [exp], timeout: 2.0)
        #endif
    }

    // MARK: - 6. Predictive Back Invocation with Multi-Depth History Stack

    func testPredictiveBackInvocationMultiDepthHistory() {
        let coordinator = GoatPredictiveBackCoordinator(initialHistoryDepth: 1)
        XCTAssertFalse(coordinator.canGoBack)

        // Push routes: depth -> 2, 3
        coordinator.pushHistory()
        coordinator.pushHistory()
        XCTAssertEqual(coordinator.historyDepth, 3)
        XCTAssertTrue(coordinator.canGoBack)

        // First pop: depth 3 -> 2 (canGoBack = true, poppedRoute = false)
        let res1 = coordinator.invokeBack()
        XCTAssertEqual(res1["action"] as? String, "COMMITTED")
        XCTAssertEqual(res1["canGoBackInWebView"] as? Bool, true)
        XCTAssertEqual(res1["poppedRoute"] as? Bool, false)
        XCTAssertEqual(coordinator.historyDepth, 2)
        XCTAssertTrue(coordinator.canGoBack)

        // Second pop: depth 2 -> 1 (canGoBack = false, poppedRoute = false)
        let res2 = coordinator.invokeBack()
        XCTAssertEqual(res2["action"] as? String, "COMMITTED")
        XCTAssertEqual(res2["canGoBackInWebView"] as? Bool, false)
        XCTAssertEqual(res2["poppedRoute"] as? Bool, false)
        XCTAssertEqual(coordinator.historyDepth, 1)
        XCTAssertFalse(coordinator.canGoBack)

        // Third pop at root: depth 1 stays 1 (canGoBack = false, poppedRoute = true -> pops host view controller)
        let res3 = coordinator.invokeBack()
        XCTAssertEqual(res3["action"] as? String, "COMMITTED")
        XCTAssertEqual(res3["canGoBackInWebView"] as? Bool, false)
        XCTAssertEqual(res3["poppedRoute"] as? Bool, true)
        XCTAssertEqual(coordinator.historyDepth, 1)
    }

    // MARK: - 7. Velocity Threshold Commit Logic (> 500 pt/s)

    func testVelocityThresholdCommitLogic() {
        let coordinator = GoatPredictiveBackCoordinator()

        // Low progress, low velocity -> Do not commit
        XCTAssertFalse(coordinator.shouldCommit(progress: 0.20, velocityX: 200.0))
        XCTAssertFalse(coordinator.shouldCommit(progress: 0.49, velocityX: 500.0))

        // Low progress, high flick velocity (> 500 pt/s) -> Commit
        XCTAssertTrue(coordinator.shouldCommit(progress: 0.20, velocityX: 650.0))
        XCTAssertTrue(coordinator.shouldCommit(progress: 0.05, velocityX: 850.0))
        XCTAssertTrue(coordinator.shouldCommit(progress: 0.49, velocityX: 500.1))

        // High progress (>= 50%), zero or low velocity -> Commit
        XCTAssertTrue(coordinator.shouldCommit(progress: 0.50, velocityX: 0.0))
        XCTAssertTrue(coordinator.shouldCommit(progress: 0.75, velocityX: 50.0))
        XCTAssertTrue(coordinator.shouldCommit(progress: 1.0, velocityX: -100.0))
    }

    // MARK: - 8. Gesture Listener Lifecycle Callbacks

    func testGestureListenerLifecycleCallbacks() {
        let coordinator = GoatPredictiveBackCoordinator()
        let mockListener = MockPredictiveBackListener()
        coordinator.addListener(mockListener)

        var closureStarted = false
        var closureStartEdge: Int?
        var closureStartX: Float?
        var closureStartY: Float?
        var closureProgress: Float?
        var closureProgressEdge: Int?
        var closureTransform: GoatPredictiveBackCoordinator.TransformResult?
        var closureInvoked = false
        var closureCancelled = false

        coordinator.onGestureStarted = { edge, x, y in
            closureStarted = true
            closureStartEdge = edge
            closureStartX = x
            closureStartY = y
        }

        coordinator.onGestureProgress = { p, x, y, edge, t in
            closureProgress = p
            closureProgressEdge = edge
            closureTransform = t
        }

        coordinator.onGestureInvoked = {
            closureInvoked = true
        }

        coordinator.onGestureCancelled = {
            closureCancelled = true
        }

        // Start gesture
        coordinator.startGesture(swipeEdge: 0, touchX: 12.0, touchY: 45.0)
        XCTAssertTrue(closureStarted)
        XCTAssertEqual(closureStartEdge, 0)
        XCTAssertEqual(closureStartX, Float(12.0))
        XCTAssertEqual(closureStartY, Float(45.0))
        XCTAssertEqual(mockListener.startCount, 1)
        XCTAssertEqual(mockListener.lastSwipeEdge, 0)
        XCTAssertEqual(mockListener.lastTouchX, Float(12.0))
        XCTAssertEqual(mockListener.lastTouchY, Float(45.0))

        // Progress update (40% progress)
        let transform = coordinator.updateProgress(progress: 0.40, touchX: 100, touchY: 45, swipeEdge: 0)
        XCTAssertEqual(closureProgress, Float(0.40))
        XCTAssertEqual(closureProgressEdge, 0)
        XCTAssertEqual(closureTransform?.scale ?? 0, 0.96, accuracy: 0.001)
        XCTAssertEqual(mockListener.progressCount, 1)
        XCTAssertEqual(mockListener.lastProgress, Float(0.40))
        XCTAssertEqual(mockListener.lastTransform?.scale ?? 0, 0.96, accuracy: 0.001)
        XCTAssertEqual(transform.scale, 0.96, accuracy: 0.001)

        // Invoke back
        coordinator.invokeBack()
        XCTAssertTrue(closureInvoked)
        XCTAssertEqual(mockListener.invokeCount, 1)

        // Reset and test cancellation
        coordinator.reset()
        XCTAssertEqual(coordinator.state, .idle)

        coordinator.startGesture(swipeEdge: 1, touchX: 380, touchY: 200)
        XCTAssertEqual(closureStartEdge, 1)
        XCTAssertEqual(closureStartX, Float(380.0))
        XCTAssertEqual(closureStartY, Float(200.0))

        coordinator.cancelBack()
        XCTAssertTrue(closureCancelled)
        XCTAssertEqual(mockListener.cancelCount, 1)

        // Remove listener
        coordinator.removeListener(mockListener)
        coordinator.startGesture(swipeEdge: 0, touchX: 0, touchY: 0)
        XCTAssertEqual(mockListener.startCount, 2) // unchanged after removal
    }

    // MARK: - 9. History Depth Lower Bound of 1

    func testHistoryDepthLowerBoundOfOne() {
        let coordinator = GoatPredictiveBackCoordinator(initialHistoryDepth: -10)
        XCTAssertEqual(coordinator.historyDepth, 1)

        coordinator.historyDepth = 0
        XCTAssertEqual(coordinator.historyDepth, 1)

        coordinator.historyDepth = -50
        XCTAssertEqual(coordinator.historyDepth, 1)

        let popped = coordinator.popHistory()
        XCTAssertFalse(popped)
        XCTAssertEqual(coordinator.historyDepth, 1)
    }

    // MARK: - 10. GoatEdgeSwipeGestureRecognizer Edge Gating & Velocity Filtering

    #if canImport(UIKit)
    func testGoatEdgeSwipeGestureRecognizerEdgeGatingAndVelocityFiltering() {
        let recognizer = GoatEdgeSwipeGestureRecognizer(
            target: nil,
            action: nil,
            swipeEdge: .left,
            edgeThreshold: 25.0
        )
        let screenBounds = CGRect(x: 0, y: 0, width: 390, height: 844)

        // --- Left Edge Touch Origin Tests ---
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 0, y: 200), bounds: screenBounds))
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 15, y: 200), bounds: screenBounds))
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 25, y: 200), bounds: screenBounds))
        XCTAssertFalse(recognizer.isTouchWithinEdge(CGPoint(x: 26, y: 200), bounds: screenBounds))
        XCTAssertFalse(recognizer.isTouchWithinEdge(CGPoint(x: 200, y: 200), bounds: screenBounds))

        // --- Right Edge Touch Origin Tests ---
        recognizer.swipeEdge = .right
        // Right edge margin: [390 - 25 = 365 .. 390]
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 390, y: 200), bounds: screenBounds))
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 375, y: 200), bounds: screenBounds))
        XCTAssertTrue(recognizer.isTouchWithinEdge(CGPoint(x: 365, y: 200), bounds: screenBounds))
        XCTAssertFalse(recognizer.isTouchWithinEdge(CGPoint(x: 364, y: 200), bounds: screenBounds))
        XCTAssertFalse(recognizer.isTouchWithinEdge(CGPoint(x: 10, y: 200), bounds: screenBounds))

        // --- Velocity Filtering Tests (Left Edge: requires vx > 0 and |vx| > |vy|) ---
        recognizer.swipeEdge = .left
        // Valid horizontal drag rightwards
        XCTAssertTrue(recognizer.validateVelocity(CGPoint(x: 600, y: 50)))
        // Wrong direction (dragging leftwards from left edge)
        XCTAssertFalse(recognizer.validateVelocity(CGPoint(x: -600, y: 50)))
        // Vertical drag dominating
        XCTAssertFalse(recognizer.validateVelocity(CGPoint(x: 50, y: 600)))
        // Diagonal drag with vertical dominant
        XCTAssertFalse(recognizer.validateVelocity(CGPoint(x: 200, y: 350)))

        // --- Velocity Filtering Tests (Right Edge: requires vx < 0 and |vx| > |vy|) ---
        recognizer.swipeEdge = .right
        // Valid horizontal drag leftwards
        XCTAssertTrue(recognizer.validateVelocity(CGPoint(x: -600, y: 50)))
        // Wrong direction (dragging rightwards from right edge)
        XCTAssertFalse(recognizer.validateVelocity(CGPoint(x: 600, y: 50)))
        // Vertical drag dominating
        XCTAssertFalse(recognizer.validateVelocity(CGPoint(x: -50, y: 600)))
    }
    #endif

    // MARK: - 11. Script Message Handler Bridge Integration

    func testBridgePredictiveBackIntegration() async throws {
        let coordinator = GoatPredictiveBackCoordinator(initialHistoryDepth: 1)
        let handler = GoatScriptMessageHandler(
            appId: "test_tenant",
            predictiveBackCoordinator: coordinator
        )

        // 1. PREDICTIVE_BACK_PROGRESS
        let progressPayload: [String: Any] = [
            "progress": 0.5,
            "touchX": 120.0,
            "touchY": 250.0,
            "swipeEdge": 0
        ]
        let progressRes = try await handler.dispatchDirect(action: "PREDICTIVE_BACK_PROGRESS", payload: progressPayload)
        XCTAssertEqual(progressRes["action"] as? String, "PROGRESS")
        XCTAssertEqual(progressRes["handled"] as? Bool, true)
        XCTAssertEqual((progressRes["interpolatedScale"] as? Double) ?? 0.0, 0.95, accuracy: 0.001)
        XCTAssertEqual((progressRes["interpolatedAlpha"] as? Double) ?? 0.0, 0.925, accuracy: 0.001)
        XCTAssertEqual((progressRes["interpolatedTranslationX"] as? Double) ?? 0.0, 75.0, accuracy: 0.001)
        XCTAssertEqual(coordinator.state, .progressing)

        // 2. Navigation Push & Stack Sync
        let pushRes = try await handler.dispatchDirect(action: "NAV_PUSH", payload: ["url": "/detail"])
        XCTAssertEqual(pushRes["pushed"] as? Bool, true)
        XCTAssertEqual(coordinator.historyDepth, 2)
        XCTAssertTrue(coordinator.canGoBack)

        let canGoBackRes = try await handler.dispatchDirect(action: "CAN_GO_BACK", payload: [:])
        XCTAssertEqual(canGoBackRes["canGoBack"] as? Bool, true)

        // 3. PREDICTIVE_BACK_INVOKE
        let invokeRes = try await handler.dispatchDirect(action: "PREDICTIVE_BACK_INVOKE", payload: [:])
        XCTAssertEqual(invokeRes["action"] as? String, "COMMITTED")
        XCTAssertEqual(invokeRes["invoked"] as? Bool, true)
        XCTAssertEqual(invokeRes["canGoBackInWebView"] as? Bool, false)
        XCTAssertEqual(invokeRes["poppedRoute"] as? Bool, false)
        XCTAssertEqual(coordinator.historyDepth, 1)

        // 4. PREDICTIVE_BACK_CANCEL
        let cancelRes = try await handler.dispatchDirect(action: "PREDICTIVE_BACK_CANCEL", payload: [:])
        XCTAssertEqual(cancelRes["action"] as? String, "CANCELLED")
        XCTAssertEqual(cancelRes["cancelled"] as? Bool, true)
    }

    // MARK: - 12. Interactive View Attachment

    #if canImport(UIKit)
    func testInteractiveViewAttachment() {
        let coordinator = GoatPredictiveBackCoordinator()
        let containerView = UIView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        var didPop = false

        let recognizer = coordinator.attach(to: containerView, swipeEdge: .left, edgeThreshold: 30.0) {
            didPop = true
        }

        XCTAssertEqual(containerView.gestureRecognizers?.count, 1)
        XCTAssertTrue(containerView.gestureRecognizers?.first === recognizer)
        XCTAssertEqual(recognizer.swipeEdge, .left)
        XCTAssertEqual(recognizer.edgeThreshold, 30.0)
        XCTAssertFalse(didPop)
    }
    #endif
}
#endif // os(iOS)
