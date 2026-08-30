import Foundation

/// Raw result classification returned by Alipay's `PayTask` SDK / `alipays://` app2app return.
public enum AlipayResult: Sendable {
    case success
    case canceled
    case failed
}

/**
 * Abstraction over Alipay's iOS `AlipaySDK` / `alipays://` app2app deep link (Task 10206c).
 * Zero compile-time dependency on the proprietary Alipay SDK.
 */
public protocol AlipayLauncher: Sendable {
    func launchPayTask(orderInfo: String, ctx: GoatPaymentContext) async throws -> AlipayResult
}

public struct UnlinkedAlipayLauncher: AlipayLauncher {
    public init() {}
    public func launchPayTask(orderInfo: String, ctx: GoatPaymentContext) async throws -> AlipayResult {
        throw GoatPaymentException(
            code: GoatPaymentErrorCode.paymentFailed,
            reason: "Alipay SDK is not linked on this host. Construct GoatAlipayPaymentAdapter with an " +
                "AlipayLauncher backed by AlipaySDK.shared() or the alipays:// app2app scheme.",
            subCode: GoatPaymentSubCode.authenticationFailed
        )
    }
}

/**
 * Built-in Alipay adapter (Task 10206c). Per Task 10206 / §5.3, the raw deep-link/app2app return
 * result is never trusted directly — `processPayment` always re-verifies the outcome against the
 * Zone 4 proxy (`/confirm`) before it becomes authoritative.
 */
public final class GoatAlipayPaymentAdapter: GoatPaymentAdapter, @unchecked Sendable {
    public let providerId: String = "alipay"
    private let launcher: any AlipayLauncher

    public init(launcher: any AlipayLauncher = UnlinkedAlipayLauncher()) {
        self.launcher = launcher
    }

    public func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        guard let orderInfo = request.ephemeralClientToken else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Missing ephemeral order payload for Alipay PayTask.")
        }

        let provisionalResult = try await launcher.launchPayTask(orderInfo: orderInfo, ctx: ctx)

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
