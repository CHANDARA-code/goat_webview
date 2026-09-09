import Foundation
#if canImport(UIKit) && os(iOS)
import UIKit
#endif

public enum SlideOutcome: String, Sendable {
    case idle, sliding, confirmed, cancelled
}

/**
 * The confirmation gesture as a pure state machine, separate from any view.
 *
 * Kept out of the SwiftUI layer on purpose: this decides whether a transaction is authorised, so
 * it has to be exercisable by ordinary unit tests. Mirrors the Android `Web3ConfirmGate`:
 *
 *  - confirmation requires a continuous drag to 100%; releasing early resets rather than latching;
 *  - a touch delivered while another window overlaid this one is discarded (tapjacking, A7);
 *  - when calldata could not be decoded the slider stays locked until the risk is acknowledged.
 */
public final class Web3ConfirmGate: @unchecked Sendable {

    private let requiresRiskAcknowledgement: Bool
    private let completionThreshold: Double

    public private(set) var progress: Double = 0
    public private(set) var outcome: SlideOutcome = .idle
    public private(set) var riskAcknowledged = false
    public private(set) var obscuredTouchRejections = 0

    public init(requiresRiskAcknowledgement: Bool, completionThreshold: Double = 1.0) {
        self.requiresRiskAcknowledgement = requiresRiskAcknowledgement
        self.completionThreshold = completionThreshold
    }

    public convenience init(preview: DecodedTransactionPreview) {
        self.init(requiresRiskAcknowledgement: preview.isUnverifiedContract)
    }

    public var isSliderUnlocked: Bool { !requiresRiskAcknowledgement || riskAcknowledged }

    public func acknowledgeRisk(_ acknowledged: Bool) {
        riskAcknowledged = acknowledged
        if !acknowledged { reset() }
    }

    /// - Parameter obscured: true when the platform reported another window covering this one for
    ///   the touch that produced `fraction`. Such a touch is never trusted.
    @discardableResult
    public func onDrag(_ fraction: Double, obscured: Bool = false) -> SlideOutcome {
        if obscured {
            obscuredTouchRejections += 1
            reset()
            return outcome
        }
        guard isSliderUnlocked else { return outcome }
        guard outcome != .confirmed else { return outcome }

        progress = min(max(fraction, 0), 1)
        outcome = progress >= completionThreshold ? .confirmed : .sliding
        return outcome
    }

    /// A release below the threshold cancels; it must never be treated as a confirmation.
    @discardableResult
    public func onRelease() -> SlideOutcome {
        guard outcome != .confirmed else { return outcome }
        reset()
        outcome = .cancelled
        return outcome
    }

    @discardableResult
    public func onCancel() -> SlideOutcome {
        reset()
        outcome = .cancelled
        return outcome
    }

    public func reset() {
        progress = 0
        outcome = .idle
    }
}

/**
 * The window-level anti-tapjacking protections, behind a seam so the policy is unit-testable
 * without a real `UIWindow`.
 *
 * iOS has no `FLAG_SECURE` or overlay-hiding equivalent — the platform does not let one app draw
 * over another — so the isolation that matters here is presenting in a dedicated window above the
 * app's own content with exclusive touch, which prevents an in-app view from intercepting or
 * sitting over the confirm control.
 */
public protocol Web3SecureWindow: AnyObject {
    func setDedicatedWindow(_ enabled: Bool)
    func setExclusiveTouch(_ enabled: Bool)
    /// Whether the screen is currently being recorded or mirrored. iOS cannot *prevent* capture
    /// from an app, so the honest control is to detect it and warn, not to claim it is blocked.
    var isScreenBeingCaptured: Bool { get }
}

public enum Web3ConfirmWindowGuard {

    public struct AppliedProtections: Equatable, Sendable {
        public let dedicatedWindow: Bool
        public let exclusiveTouch: Bool
        /// True when the modal is being presented while the screen is recorded or mirrored. The
        /// caller should show a warning; unlike Android's FLAG_SECURE, iOS cannot blank the capture.
        public let screenCaptureDetected: Bool
    }

    @discardableResult
    public static func apply(_ window: Web3SecureWindow) -> AppliedProtections {
        window.setDedicatedWindow(true)
        window.setExclusiveTouch(true)
        return AppliedProtections(
            dedicatedWindow: true,
            exclusiveTouch: true,
            screenCaptureDetected: window.isScreenBeingCaptured
        )
    }

    public static func release(_ window: Web3SecureWindow) {
        window.setDedicatedWindow(false)
    }
}

#if canImport(UIKit) && os(iOS)
/// Binds `Web3SecureWindow` to a real `UIWindow` presented above the app's own content.
public final class UIKitWeb3SecureWindow: Web3SecureWindow {

    private let window: UIWindow
    private weak var contentView: UIView?

    public init(window: UIWindow, contentView: UIView? = nil) {
        self.window = window
        self.contentView = contentView
    }

    public func setDedicatedWindow(_ enabled: Bool) {
        window.windowLevel = enabled ? .alert + 1 : .normal
        window.isHidden = !enabled
    }

    public func setExclusiveTouch(_ enabled: Bool) {
        contentView?.isExclusiveTouch = enabled
        for subview in contentView?.subviews ?? [] { subview.isExclusiveTouch = enabled }
    }

    /// iOS has no public API to blank a window in a screen recording, so this reports the
    /// documented `UIScreen.isCaptured` state instead of pretending to block capture.
    public var isScreenBeingCaptured: Bool {
        window.screen.isCaptured
    }
}
#endif
