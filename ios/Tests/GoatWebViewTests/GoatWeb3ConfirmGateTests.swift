import XCTest
@testable import GoatWebView

/// Mirrors the Android `Web3ConfirmGateTest` case for case, so the two platforms cannot drift on
/// the rules that decide whether a transaction is authorised.
final class GoatWeb3ConfirmGateTests: XCTestCase {

    private final class FakeWindow: Web3SecureWindow {
        var dedicated = false
        var exclusiveTouch = false
        var captured = false

        func setDedicatedWindow(_ enabled: Bool) { dedicated = enabled }
        func setExclusiveTouch(_ enabled: Bool) { exclusiveTouch = enabled }
        var isScreenBeingCaptured: Bool { captured }
    }

    private func preview(unverified: Bool) -> DecodedTransactionPreview {
        DecodedTransactionPreview(
            networkName: "Ethereum", recipient: "0xdead",
            valueFormatted: "1", feeFormatted: "0.001",
            methodName: "approve", methodDescription: "test",
            isUnverifiedContract: unverified
        )
    }

    // MARK: - Slide gesture

    func testConfirmationRequiresReachingTheFullThreshold() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        XCTAssertEqual(gate.onDrag(0.5), .sliding)
        XCTAssertEqual(gate.onDrag(0.99), .sliding)
        XCTAssertEqual(gate.onDrag(1.0), .confirmed)
    }

    func testReleasingBelowThresholdCancelsAndResetsProgress() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        gate.onDrag(0.95)
        XCTAssertEqual(gate.onRelease(), .cancelled)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
    }

    func testPartialGesturesCannotAccumulateIntoAConfirmation() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        for _ in 0..<20 {
            gate.onDrag(0.9)
            gate.onRelease()
        }
        XCTAssertNotEqual(gate.outcome, .confirmed)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
    }

    func testOnceConfirmedTheOutcomeIsStable() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        gate.onDrag(1.0)
        XCTAssertEqual(gate.onDrag(0.1), .confirmed)
        XCTAssertEqual(gate.onRelease(), .confirmed)
    }

    func testProgressIsClampedToTheValidRange() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        gate.onDrag(-5)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
        gate.onDrag(50)
        XCTAssertEqual(gate.progress, 1, accuracy: 0.0001)
    }

    // MARK: - Tapjacking (threat A7)

    func testTouchDeliveredWhileObscuredIsDiscardedNotConfirmed() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        XCTAssertEqual(gate.onDrag(1.0, obscured: true), .idle)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
        XCTAssertEqual(gate.obscuredTouchRejections, 1)
    }

    func testAnObscuredTouchMidGestureResetsTheWholeGesture() {
        let gate = Web3ConfirmGate(requiresRiskAcknowledgement: false)
        gate.onDrag(0.9)
        gate.onDrag(0.95, obscured: true)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
        XCTAssertEqual(gate.outcome, .idle)
        XCTAssertEqual(gate.onDrag(0.5), .sliding)
    }

    // MARK: - Unverified-contract acknowledgement

    func testSliderIsLockedUntilUnverifiedContractRiskIsAcknowledged() {
        let gate = Web3ConfirmGate(preview: preview(unverified: true))
        XCTAssertFalse(gate.isSliderUnlocked)
        XCTAssertEqual(gate.onDrag(1.0), .idle)

        gate.acknowledgeRisk(true)
        XCTAssertTrue(gate.isSliderUnlocked)
        XCTAssertEqual(gate.onDrag(1.0), .confirmed)
    }

    func testWithdrawingAcknowledgementRelocksAndResets() {
        let gate = Web3ConfirmGate(preview: preview(unverified: true))
        gate.acknowledgeRisk(true)
        gate.onDrag(0.8)
        gate.acknowledgeRisk(false)
        XCTAssertFalse(gate.isSliderUnlocked)
        XCTAssertEqual(gate.progress, 0, accuracy: 0.0001)
    }

    func testAVerifiedContractNeedsNoAcknowledgement() {
        let gate = Web3ConfirmGate(preview: preview(unverified: false))
        XCTAssertTrue(gate.isSliderUnlocked)
        XCTAssertEqual(gate.onDrag(1.0), .confirmed)
    }

    // MARK: - Window protections

    func testDedicatedWindowAndExclusiveTouchAreApplied() {
        let window = FakeWindow()
        let applied = Web3ConfirmWindowGuard.apply(window)
        XCTAssertTrue(window.dedicated)
        XCTAssertTrue(window.exclusiveTouch)
        XCTAssertFalse(applied.screenCaptureDetected)
    }

    func testScreenRecordingIsReportedSoTheModalCanWarn() {
        let window = FakeWindow()
        window.captured = true
        let applied = Web3ConfirmWindowGuard.apply(window)
        XCTAssertTrue(
            applied.screenCaptureDetected,
            "iOS cannot block capture, so it must at least be surfaced"
        )
    }

    func testReleaseTearsDownTheDedicatedWindow() {
        let window = FakeWindow()
        Web3ConfirmWindowGuard.apply(window)
        Web3ConfirmWindowGuard.release(window)
        XCTAssertFalse(window.dedicated)
    }
}
