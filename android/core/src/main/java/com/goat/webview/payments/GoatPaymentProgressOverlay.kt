package com.goat.webview.payments

/** Display data for the native L1 gesture-anchoring progress/confirmation overlay. */
data class GoatPaymentOverlayRequest(
    val provider: String,
    val amount: Long,
    val currency: String,
    val merchantName: String? = null
)

/**
 * L1 Native Progress/Confirmation Overlay presenter (Task 10206 / §7 L1).
 *
 * Displays order amount, currency, and merchant name with a loading indicator immediately upon
 * `REQUEST_PAYMENT`, insulating execution from 2-hop backend RTT timeouts. The user's explicit
 * confirmation tap on this *native* surface anchors a fresh 0ms gesture, so hosts that wire a
 * real presenter satisfy L1 even when the JS-side tap predates a >10s network round trip.
 *
 * Returning `false` (or throwing) is treated as an explicit user dismissal, not a gesture.
 */
fun interface GoatPaymentProgressOverlayPresenter {
    suspend fun present(request: GoatPaymentOverlayRequest): Boolean
}
