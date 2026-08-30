import Foundation

/// Raw result classification returned by PayPay's OPA SDK / `paypay://` app2app return.
public enum PayPayResult: Sendable {
    case success
    case canceled
    case failed
}

/**
 * Abstraction over PayPay's OPA (Online Payment API) SDK / `paypay://` app2app deep link
 * (Task 10206c). Zero compile-time dependency on the proprietary PayPay SDK.
 */
public protocol PayPayLauncher: Sendable {
    func launchOpaPayment(merchantPaymentId: String, ctx: GoatPaymentContext) async throws -> PayPayResult
}

public struct UnlinkedPayPayLauncher: PayPayLauncher {
    public init() {}
    public func launchOpaPayment(merchantPaymentId: String, ctx: GoatPaymentContext) async throws -> PayPayResult {
        throw GoatPaymentException(
            code: GoatPaymentErrorCode.paymentFailed,
            reason: "PayPay SDK is not linked on this host. Construct GoatPayPayPaymentAdapter with a " +
                "PayPayLauncher backed by the PayPay OPA SDK or the paypay:// app2app scheme.",
            subCode: GoatPaymentSubCode.authenticationFailed
        )
    }
}

/**
 * Built-in PayPay adapter (Task 10206c). The OPA payment is created server-side by the Zone 4
 * proxy; like Alipay, the app2app return value is provisional and always re-verified against
 * the proxy's authoritative state before it can become terminal.
 */
public final class GoatPayPayPaymentAdapter: GoatPaymentAdapter, @unchecked Sendable {
    public let providerId: String = "paypay"
    private let launcher: any PayPayLauncher

    public init(launcher: any PayPayLauncher = UnlinkedPayPayLauncher()) {
        self.launcher = launcher
    }

    public func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        guard let merchantPaymentId = request.ephemeralClientToken else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Missing ephemeral merchantPaymentId for PayPay OPA.")
        }

        let provisionalResult = try await launcher.launchOpaPayment(merchantPaymentId: merchantPaymentId, ctx: ctx)

        let authoritative = try await ctx.proxyClient.queryIntent(request.intentId)
        if authoritative.status.isTerminal { return authoritative }

        switch provisionalResult {
        case .success:
            return GoatPaymentOutcome(status: .processing, intentId: request.intentId)
        case .canceled:
            return GoatPaymentOutcome(status: .dismissed, intentId: request.intentId)
        case .failed:
            return GoatPaymentOutcome(status: .failed, intentId: request.intentId, failureSubCode: GoatPaymentSubCode.authenticationFailed)
        }
    }

    public func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await ctx.proxyClient.queryIntent(intentId).status
    }

    public func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await ctx.proxyClient.cancelIntent(intentId).status
    }
}
