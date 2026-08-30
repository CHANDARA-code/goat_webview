package com.goat.webview.feature.payments.alipay

import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatPaymentSubCode

/** Raw result string classification returned by Alipay's `PayTask.pay()` / `alipays://` app2app return. */
enum class AlipayResult { SUCCESS, CANCELED, FAILED }

/**
 * Abstraction over Alipay's `PayTask` SDK / `alipays://` app2app deep link (Task 10206c). Zero
 * compile-time dependency on the proprietary Alipay SDK — hosts wire a real [AlipayLauncher].
 */
fun interface AlipayLauncher {
    suspend fun launchPayTask(orderInfo: String, ctx: GoatPaymentContext): AlipayResult
}

/**
 * Built-in Alipay adapter (Task 10206c). Per Task 10206 / §5.3, the raw deep-link/app2app
 * return result is never trusted directly — [processPayment] always re-verifies the outcome
 * against the Zone 4 proxy (`/confirm`) before it becomes authoritative.
 */
class GoatAlipayPaymentAdapter(
    private val launcher: AlipayLauncher = UNLINKED_LAUNCHER
) : GoatPaymentAdapter {
    override val providerId: String = "alipay"

    override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome {
        val orderInfo = request.ephemeralClientToken
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, "Missing ephemeral order payload for Alipay PayTask.")

        val provisionalResult = launcher.launchPayTask(orderInfo, ctx)

        // The app2app/SDK result is provisional only — confirm against the authoritative proxy state.
        val authoritative = ctx.proxyClient.queryIntent(request.intentId)
        if (authoritative.status.isTerminal) return authoritative

        return when (provisionalResult) {
            AlipayResult.SUCCESS -> GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, request.intentId)
            AlipayResult.CANCELED -> GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, request.intentId)
            AlipayResult.FAILED -> GoatPaymentOutcome(
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
        val UNLINKED_LAUNCHER = AlipayLauncher { _, _ ->
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "Alipay SDK is not linked on this host. Construct GoatAlipayPaymentAdapter with an " +
                    "AlipayLauncher backed by com.alipay.sdk.app.PayTask or the alipays:// app2app scheme.",
                GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }
    }
}
