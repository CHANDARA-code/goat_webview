package com.goat.webview.feature.payments.bakong

import com.goat.webview.payments.GoatClaimResult
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentServerProxyClient
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatTenantPublicKey
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class GoatBakongKhqrPaymentAdapterTest {

    private fun request(token: String? = "khqr_string_payload") = GoatPaymentRequest(
        provider = "bakong_khqr", orderId = "order_1", intentId = "pi_1", amount = 5000,
        currency = "KHR", nonce = "nonce_1", signedPayload = "irrelevant.irrelevant",
        ephemeralClientToken = token
    )

    @Test
    fun `renders the QR and returns immediately without blocking on settlement`() = runTest {
        val presenter = RecordingPresenter()
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = NoOpProxyClient())
        val adapter = GoatBakongKhqrPaymentAdapter(presenter)

        val outcome = adapter.processPayment(request(), ctx)

        assertEquals(GoatPaymentStatus.PROCESSING, outcome.status)
        assertTrue(presenter.shown)
        assertTrue("dismissQr must not be called while the payment is still pending", !presenter.dismissed)
    }

    @Test
    fun `missing KHQR payload throws without presenting anything`() = runTest {
        val presenter = RecordingPresenter()
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = NoOpProxyClient())
        val adapter = GoatBakongKhqrPaymentAdapter(presenter)

        try {
            adapter.processPayment(request(token = null), ctx)
            fail("Expected GoatPaymentException")
        } catch (_: GoatPaymentException) {
            // expected
        }
        assertTrue(!presenter.shown)
    }

    @Test
    fun `cancelPayment dismisses the QR and delegates to the proxy`() = runTest {
        val presenter = RecordingPresenter()
        val proxy = NoOpProxyClient()
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatBakongKhqrPaymentAdapter(presenter)

        val status = adapter.cancelPayment("pi_1", ctx)

        assertTrue(presenter.dismissed)
        assertEquals(GoatPaymentStatus.CANCELLED, status)
    }

    @Test
    fun `queryStatus delegates straight to the proxy for onResume flushes`() = runTest {
        val proxy = NoOpProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatBakongKhqrPaymentAdapter(RecordingPresenter())

        val status = adapter.queryStatus("pi_1", ctx)

        assertEquals(GoatPaymentStatus.SUCCEEDED, status)
    }

    private class RecordingPresenter : KhqrPresenter {
        var shown = false
        var dismissed = false
        override suspend fun showQr(qrString: String, ctx: GoatPaymentContext) { shown = true }
        override suspend fun dismissQr(ctx: GoatPaymentContext) { dismissed = true }
    }

    private class NoOpProxyClient(
        private val queryResult: GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1")
    ) : GoatPaymentServerProxyClient {
        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = null
        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult = GoatClaimResult(true)
        override suspend fun fetchClientToken(intentId: String): String = "unused"
        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome = outcome
        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome = queryResult
    }
}
