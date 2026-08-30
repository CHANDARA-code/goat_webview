import Foundation

/// Terminal result of presenting the Stripe `PaymentSheet`.
public enum StripeSheetResult: Sendable {
    case completed
    case canceled
    case failed
}

/**
 * Abstraction over the Stripe iOS SDK's `PaymentSheet` entry point (Task 10206c). This module
 * deliberately has zero compile-time dependency on the proprietary `StripePaymentSheet` SPM
 * package — hosts that link the real SDK supply a `StripeSheetLauncher` backed by
 * `StripePaymentSheet.PaymentSheet.present(...)` at construction time.
 */
public protocol StripeSheetLauncher: Sendable {
    func presentPaymentSheet(clientSecret: String, ctx: GoatPaymentContext) async throws -> StripeSheetResult
}

public struct UnlinkedStripeSheetLauncher: StripeSheetLauncher {
    public init() {}
    public func presentPaymentSheet(clientSecret: String, ctx: GoatPaymentContext) async throws -> StripeSheetResult {
        throw GoatPaymentException(
            code: GoatPaymentErrorCode.paymentFailed,
            reason: "Stripe SDK is not linked on this host. Construct GoatStripePaymentAdapter with a " +
                "StripeSheetLauncher backed by StripePaymentSheet.PaymentSheet.",
            subCode: GoatPaymentSubCode.authenticationFailed
        )
    }
}

/**
 * Built-in Stripe adapter (Task 10206c). Card entry stays entirely inside Stripe's own
 * `PaymentSheet` UI — no PAN/CVV ever reaches this class, only the ephemeral single-intent
 * client secret minted by the Zone 4 server proxy.
 */
public final class GoatStripePaymentAdapter: GoatPaymentAdapter, @unchecked Sendable {
    public let providerId: String = "stripe"
    private let launcher: any StripeSheetLauncher

    public init(launcher: any StripeSheetLauncher = UnlinkedStripeSheetLauncher()) {
        self.launcher = launcher
    }

    public func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        guard let clientSecret = request.ephemeralClientToken else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Missing ephemeral client token for Stripe PaymentSheet.")
        }

        switch try await launcher.presentPaymentSheet(clientSecret: clientSecret, ctx: ctx) {
        case .completed:
            return GoatPaymentOutcome(status: .succeeded, intentId: request.intentId)
        case .canceled:
            // Sheet dismissal is non-terminal — the intent stays CLAIMED for retry (Task 10206 / §9).
            return GoatPaymentOutcome(status: .dismissed, intentId: request.intentId)
        case .failed:
            return GoatPaymentOutcome(status: .failed, intentId: request.intentId, failureSubCode: GoatPaymentSubCode.cardDeclinedInsufficientFunds)
        }
    }

    public func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await ctx.proxyClient.queryIntent(intentId).status
    }

    public func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await ctx.proxyClient.cancelIntent(intentId).status
    }
}

/**
 * Built-in Stripe Link adapter (Task 10206c / providerId `"link"`). Reuses the same Stripe
 * `PaymentSheet` launcher — Link renders inside the sheet, or falls back to an allowlisted
 * hosted redirect — so the manager's security gate treats it as a distinct provider.
 */
public final class GoatStripeLinkPaymentAdapter: GoatPaymentAdapter, @unchecked Sendable {
    public let providerId: String = "link"
    private let delegate: GoatStripePaymentAdapter

    public init(launcher: any StripeSheetLauncher = UnlinkedStripeSheetLauncher()) {
        self.delegate = GoatStripePaymentAdapter(launcher: launcher)
    }

    public func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        try await delegate.processPayment(request, ctx: ctx)
    }

    public func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await delegate.queryStatus(intentId, ctx: ctx)
    }

    public func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await delegate.cancelPayment(intentId, ctx: ctx)
    }
}
