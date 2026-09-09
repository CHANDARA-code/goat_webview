package com.goat.webview.feature.payments.alipay

import com.goat.webview.payments.GoatClaimResult
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentServerProxyClient
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatTenantPublicKey
import kotlinx.coroutines.test.runTest
import com.goat.webview.payments.GoatPaymentSubCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class GoatAlipayPaymentAdapterTest {

    private fun request() = GoatPaymentRequest(
        provider = "alipay", orderId = "order_1", intentId = "pi_1", amount = 4999,
        currency = "USD", nonce = "nonce_1", signedPayload = "irrelevant.irrelevant",
        ephemeralClientToken = "order_info_blob"
    )

    @Test
    fun `provisional deep-link SUCCESS is not trusted until the proxy confirms it`() = runTest {
        val proxy = FakeProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatAlipayPaymentAdapter(AlipayLauncher { _, _ -> AlipayResult.SUCCESS })

        val outcome = adapter.processPayment(request(), ctx)

        // Not blindly SUCCEEDED just because the SDK said so — proxy is still PROCESSING.
        assertEquals(GoatPaymentStatus.PROCESSING, outcome.status)
        assertEquals(1, proxy.queryCalls)
    }

    @Test
    fun `already-terminal proxy state wins over a provisional FAILED deep-link result`() = runTest {
        val proxy = FakeProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1", "txh_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatAlipayPaymentAdapter(AlipayLauncher { _, _ -> AlipayResult.FAILED })

        val outcome = adapter.processPayment(request(), ctx)

        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
    }

    @Test
    fun `canceled deep-link maps to non-terminal DISMISSED`() = runTest {
        val proxy = FakeProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.CLAIMED, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatAlipayPaymentAdapter(AlipayLauncher { _, _ -> AlipayResult.CANCELED })

        val outcome = adapter.processPayment(request(), ctx)

        assertEquals(GoatPaymentStatus.DISMISSED, outcome.status)
    }

    @Test
    fun `resultStatus 8000 and 6004 stay non-terminal so onAppResume can reconcile them`() = runTest {
        // Collapsing either into FAILED would report a payment as failed while it settles, and
        // would drop the intent from the pending set the resume hook re-queries.
        for (code in listOf(AlipayResultCode.PROCESSING, AlipayResultCode.RESULT_UNKNOWN)) {
            val classified = AlipayResultCode.classify(code)
            val proxy = FakeProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
            val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
            val adapter = GoatAlipayPaymentAdapter(AlipayLauncher { _, _ -> classified })

            val outcome = adapter.processPayment(request(), ctx)
            assertEquals("resultStatus $code must stay in flight", GoatPaymentStatus.PROCESSING, outcome.status)
            assertFalse("resultStatus $code must not be terminal", outcome.status.isTerminal)
        }
    }

    @Test
    fun `every documented Alipay resultStatus maps to the right classification`() {
        assertEquals(AlipayResult.SUCCESS, AlipayResultCode.classify("9000"))
        assertEquals(AlipayResult.PROCESSING, AlipayResultCode.classify("8000"))
        assertEquals(AlipayResult.FAILED, AlipayResultCode.classify("4000"))
        assertEquals(AlipayResult.CANCELED, AlipayResultCode.classify("6001"))
        assertEquals(AlipayResult.FAILED, AlipayResultCode.classify("6002"))
        assertEquals(AlipayResult.UNKNOWN, AlipayResultCode.classify("6004"))
        assertEquals(AlipayResult.UNKNOWN, AlipayResultCode.classify(null))
        assertEquals(AlipayResult.UNKNOWN, AlipayResultCode.classify("not-a-code"))
    }

    @Test
    fun `a network error carries an actionable sub-code`() {
        assertEquals(GoatPaymentSubCode.NETWORK_TIMEOUT, AlipayResultCode.subCodeFor("6002"))
        assertEquals(GoatPaymentSubCode.AUTHENTICATION_FAILED, AlipayResultCode.subCodeFor("4000"))
        assertEquals(null, AlipayResultCode.subCodeFor("9000"))
    }

    @Test
    fun `user cancellation is DISMISSED, never FAILED`() = runTest {
        val proxy = FakeProxyClient(queryResult = GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatAlipayPaymentAdapter(AlipayLauncher { _, _ -> AlipayResultCode.classify("6001") })
        assertEquals(GoatPaymentStatus.DISMISSED, adapter.processPayment(request(), ctx).status)
    }

    private class FakeProxyClient(private val queryResult: GoatPaymentOutcome) : GoatPaymentServerProxyClient {
        var queryCalls = 0
        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = null
        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult = GoatClaimResult(true)
        override suspend fun fetchClientToken(intentId: String): String = "unused"
        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome = outcome
        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome {
            queryCalls++
            return queryResult
        }
    }
}
