import Foundation

/**
 * Renders/dismisses the NBC Bakong KHQR EMV-QR code. The QR string itself is generated
 * server-side by the Zone 4 proxy (which holds the merchant's Bakong account credentials) and
 * handed to native as the opaque ephemeral client token — this module only displays it.
 */
public protocol KhqrPresenter: Sendable {
    func showQr(_ qrString: String, ctx: GoatPaymentContext) async
    func dismissQr(ctx: GoatPaymentContext) async
}

/**
 * Built-in Bakong KHQR adapter (Task 10206c). No card rail and no proprietary SDK — the
 * provider surface is a rendered QR code, scanned by any NBC-participating bank app.
 *
 * `processPayment` returns as soon as the QR is presented (status `.processing`), releasing the
 * manager's per-`intentId` lock/watchdog immediately rather than holding it for the whole
 * scan-and-confirm window. `GoatPaymentGatewayManager` separately schedules the 1s/3s
 * background poll of `queryStatus` and the `onResume` immediate flush.
 */
public final class GoatBakongKhqrPaymentAdapter: GoatPaymentAdapter, @unchecked Sendable {
    public let providerId: String = "bakong_khqr"
    private let presenter: any KhqrPresenter

    public init(presenter: any KhqrPresenter) {
        self.presenter = presenter
    }

    public func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        guard let qrString = request.ephemeralClientToken else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Missing KHQR payload from the payment proxy.")
        }
        await presenter.showQr(qrString, ctx: ctx)
        return GoatPaymentOutcome(status: .processing, intentId: request.intentId)
    }

    /// Also used directly by the manager's `onAppResume` lifecycle hook and background poller.
    public func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        try await ctx.proxyClient.queryIntent(intentId).status
    }

    public func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        await presenter.dismissQr(ctx: ctx)
        return try await ctx.proxyClient.cancelIntent(intentId).status
    }
}
