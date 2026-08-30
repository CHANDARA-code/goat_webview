package com.goat.webview.payments

/**
 * Host-registerable Service Provider Interface for a single payment provider integration
 * (Task 10206 / §5.2). Built-in adapters (Alipay, Stripe, Stripe Link, PayPay, Bakong KHQR)
 * and custom adapters share this contract; [GoatPaymentGatewayManager] never inspects
 * provider-specific behavior beyond it.
 *
 * Registration is strictly host-app compile-time only via
 * [GoatPaymentGatewayManager.registerAdapter] — mini-apps cannot register adapters
 * dynamically via JS or reflection.
 */
interface GoatPaymentAdapter {
    /** Unique provider identifier, e.g. "alipay", "stripe", "link", "paypay", "bakong_khqr". */
    val providerId: String

    /**
     * Drives the provider's native checkout surface (payment sheet, app2app deep link, or
     * hosted/allowlisted checkout) for an already-claimed, tokenized [request].
     */
    suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome

    /** Queries the current provisional status for [intentId], used for app2app / KHQR polling. */
    suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus

    /** Best-effort cancellation of an in-flight or pending [intentId]. */
    suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus
}
