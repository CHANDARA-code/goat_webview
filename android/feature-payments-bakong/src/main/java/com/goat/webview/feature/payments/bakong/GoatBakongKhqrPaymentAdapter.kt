package com.goat.webview.feature.payments.bakong

import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentStatus

/**
 * Renders/dismisses the NBC Bakong KHQR EMV-QR code. The QR string itself is generated
 * server-side by the Zone 4 proxy (which holds the merchant's Bakong account credentials) and
 * handed to native as the opaque ephemeral client token — this module only displays it.
 */
interface KhqrPresenter {
    suspend fun showQr(qrString: String, ctx: GoatPaymentContext)
    suspend fun dismissQr(ctx: GoatPaymentContext)
}

/**
 * Built-in Bakong KHQR adapter (Task 10206c). No card rail and no proprietary SDK — the
 * provider surface is a rendered QR code, scanned by any NBC-participating bank app.
 *
 * [processPayment] returns as soon as the QR is presented (status `PROCESSING`), releasing the
 * manager's per-`intentId` mutex/watchdog immediately rather than holding it for the whole
 * scan-and-confirm window. [GoatPaymentGatewayManager] separately schedules the 1s/3s
 * background poll of [queryStatus] (Task 10206 / §5.3) and the `onResume` immediate flush.
 */
class GoatBakongKhqrPaymentAdapter(
    private val presenter: KhqrPresenter
) : GoatPaymentAdapter {
    override val providerId: String = "bakong_khqr"

    override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome {
        val qrString = request.ephemeralClientToken
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, "Missing KHQR payload from the payment proxy.")

        presenter.showQr(qrString, ctx)
        return GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, request.intentId)
    }

    /** Also used directly by the manager's `onAppResume` lifecycle hook and background poller. */
    override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.queryIntent(intentId).status

    override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus {
        presenter.dismissQr(ctx)
        return ctx.proxyClient.cancelIntent(intentId).status
    }
}
