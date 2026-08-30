package com.goat.webview.feature.payments.paypay

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
import org.junit.Assert.fail
import org.junit.Test

class GoatPayPayPaymentAdapterTest {

    private fun request(token: String? = "merchant_payment_id_1") = GoatPaymentRequest(
        provider = "paypay", orderId = "order_1", intentId = "pi_1", amount = 4999,
        currency = "JPY", nonce = "nonce_1", signedPayload = "irrelevant.irrelevant",
        ephemeralClientToken = token
    )

    @Test
    fun `successful OPA app2app return stays provisional until the proxy confirms`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatPayPayPaymentAdapter(PayPayLauncher { _, _ -> PayPayResult.SUCCESS })

        val outcome = adapter.processPayment(request(), ctx)

        assertEquals(GoatPaymentStatus.PROCESSING, outcome.status)
    }

    @Test
    fun `missing ephemeral token throws without invoking the launcher`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.CLAIMED, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatPayPayPaymentAdapter(PayPayLauncher { _, _ -> fail("must not be invoked"); PayPayResult.FAILED })

        try {
            adapter.processPayment(request(token = null), ctx)
            fail("Expected GoatPaymentException")
        } catch (_: GoatPaymentException) {
            // expected
        }
    }

    @Test
    fun `failed app2app return maps to FAILED with AUTHENTICATION_FAILED sub-code`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.CLAIMED, "pi_1"))
        val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)
        val adapter = GoatPayPayPaymentAdapter(PayPayLauncher { _, _ -> PayPayResult.FAILED })

        val outcome = adapter.processPayment(request(), ctx)

        assertEquals(GoatPaymentStatus.FAILED, outcome.status)
        assertEquals("AUTHENTICATION_FAILED", outcome.failureSubCode)
    }

    private class FakeProxyClient(private val queryResult: GoatPaymentOutcome) : GoatPaymentServerProxyClient {
        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = null
        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult = GoatClaimResult(true)
        override suspend fun fetchClientToken(intentId: String): String = "unused"
        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome = outcome
        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome = queryResult
    }
}
