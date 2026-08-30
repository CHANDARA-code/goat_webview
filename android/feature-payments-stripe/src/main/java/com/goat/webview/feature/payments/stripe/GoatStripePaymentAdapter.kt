package com.goat.webview.feature.payments.stripe

import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatPaymentSubCode

/** Terminal result of presenting the Stripe `PaymentSheet`. */
enum class StripeSheetResult { COMPLETED, CANCELED, FAILED }

/**
 * Abstraction over the Stripe Android SDK's `PaymentSheet` entry point (Task 10206c). This
 * module deliberately has zero compile-time dependency on the proprietary `com.stripe:stripe-android`
 * artifact — hosts that link the real SDK supply a [StripeSheetLauncher] backed by
 * `com.stripe.android.paymentsheet.PaymentSheet.present(...)` at construction time.
 */
fun interface StripeSheetLauncher {
    suspend fun presentPaymentSheet(clientSecret: String, ctx: GoatPaymentContext): StripeSheetResult
}

/**
 * Built-in Stripe adapter (Task 10206c). Card entry stays entirely inside Stripe's own
 * `PaymentSheet` UI — no PAN/CVV ever reaches this class, only the ephemeral single-intent
 * client secret minted by the Zone 4 server proxy.
 */
class GoatStripePaymentAdapter(
    private val launcher: StripeSheetLauncher = UNLINKED_LAUNCHER
) : GoatPaymentAdapter {
    override val providerId: String = "stripe"

    override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome {
        val clientSecret = request.ephemeralClientToken
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, "Missing ephemeral client token for Stripe PaymentSheet.")

        return when (launcher.presentPaymentSheet(clientSecret, ctx)) {
            StripeSheetResult.COMPLETED -> GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, request.intentId)
            // Sheet dismissal is non-terminal — the intent stays CLAIMED for retry (Task 10206 / §9).
            StripeSheetResult.CANCELED -> GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, request.intentId)
            StripeSheetResult.FAILED -> GoatPaymentOutcome(
                GoatPaymentStatus.FAILED,
                request.intentId,
                failureSubCode = GoatPaymentSubCode.CARD_DECLINED_INSUFFICIENT_FUNDS
            )
        }
    }

    override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.queryIntent(intentId).status

    override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.cancelIntent(intentId).status

    companion object {
        /** Fails loudly rather than silently when no real Stripe SDK launcher has been wired. */
        val UNLINKED_LAUNCHER = StripeSheetLauncher { _, _ ->
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "Stripe SDK is not linked on this host. Construct GoatStripePaymentAdapter with a " +
                    "StripeSheetLauncher backed by com.stripe.android.paymentsheet.PaymentSheet.",
                GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }
    }
}

/**
 * Built-in Stripe Link adapter (Task 10206c / providerId `"link"`). Reuses the same Stripe
 * `PaymentSheet` launcher — Link renders inside the sheet, or falls back to an allowlisted
 * hosted redirect — so the manager's security gate treats it as a distinct, independently
 * registrable provider from `"stripe"`.
 */
class GoatStripeLinkPaymentAdapter(
    private val launcher: StripeSheetLauncher = GoatStripePaymentAdapter.UNLINKED_LAUNCHER
) : GoatPaymentAdapter {
    override val providerId: String = "link"

    private val delegate = GoatStripePaymentAdapter(launcher)

    override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome =
        delegate.processPayment(request, ctx)

    override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        delegate.queryStatus(intentId, ctx)

    override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        delegate.cancelPayment(intentId, ctx)
}
