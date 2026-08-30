package com.goat.webview.feature.payments.paypay

import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatPaymentSubCode

/** Raw result classification returned by PayPay's OPA SDK / `paypay://` app2app return. */
enum class PayPayResult { SUCCESS, CANCELED, FAILED }

/**
 * Abstraction over PayPay's OPA (Online Payment API) SDK / `paypay://` app2app deep link
 * (Task 10206c). Zero compile-time dependency on the proprietary PayPay SDK.
 */
fun interface PayPayLauncher {
    suspend fun launchOpaPayment(merchantPaymentId: String, ctx: GoatPaymentContext): PayPayResult
}

/**
 * Built-in PayPay adapter (Task 10206c). The OPA payment is created server-side by the Zone 4
 * proxy; like Alipay, the app2app return value is provisional and always re-verified against
 * the proxy's authoritative state before it can become terminal.
 */
class GoatPayPayPaymentAdapter(
    private val launcher: PayPayLauncher = UNLINKED_LAUNCHER
) : GoatPaymentAdapter {
    override val providerId: String = "paypay"

    override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome {
        val merchantPaymentId = request.ephemeralClientToken
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, "Missing ephemeral merchantPaymentId for PayPay OPA.")

        val provisionalResult = launcher.launchOpaPayment(merchantPaymentId, ctx)

        val authoritative = ctx.proxyClient.queryIntent(request.intentId)
        if (authoritative.status.isTerminal) return authoritative

        return when (provisionalResult) {
            PayPayResult.SUCCESS -> GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, request.intentId)
            PayPayResult.CANCELED -> GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, request.intentId)
            PayPayResult.FAILED -> GoatPaymentOutcome(
                GoatPaymentStatus.FAILED,
                request.intentId,
                failureSubCode = GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }
    }

    override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.queryIntent(intentId).status

    override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.cancelIntent(intentId).status

    companion object {
        val UNLINKED_LAUNCHER = PayPayLauncher { _, _ ->
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "PayPay SDK is not linked on this host. Construct GoatPayPayPaymentAdapter with a " +
                    "PayPayLauncher backed by the PayPay OPA SDK or the paypay:// app2app scheme.",
                GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }
    }
}
