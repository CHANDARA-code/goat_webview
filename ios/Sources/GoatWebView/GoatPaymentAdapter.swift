import Foundation

/**
 * Host-registerable Service Provider Interface for a single payment provider integration
 * (Task 10206 / §5.2). Built-in adapters (Alipay, Stripe, Stripe Link, PayPay, Bakong KHQR)
 * and custom adapters share this contract; `GoatPaymentGatewayManager` never inspects
 * provider-specific behavior beyond it.
 *
 * Registration is strictly host-app compile-time only via
 * `GoatPaymentGatewayManager.registerAdapter` — mini-apps cannot register adapters
 * dynamically via JS or reflection.
 */
public protocol GoatPaymentAdapter: Sendable {
    /// Unique provider identifier, e.g. "alipay", "stripe", "link", "paypay", "bakong_khqr".
    var providerId: String { get }

    /// Drives the provider's native checkout surface for an already-claimed, tokenized `request`.
    func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome

    /// Queries the current provisional status for `intentId`, used for app2app / KHQR polling.
    func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus

    /// Best-effort cancellation of an in-flight or pending `intentId`.
    func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus
}
