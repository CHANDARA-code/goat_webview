package com.goat.webview.feature.payments.stripe

import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentServerProxyClient
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatTenantPublicKey
import com.goat.webview.payments.GoatClaimResult
import com.goat.webview.payments.GoatPaymentOutcome
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

class GoatStripePaymentAdapterTest {

    private val ctx = GoatPaymentContext(appId = "tenant-1", proxyClient = NoOpProxyClient())

    private fun request(token: String? = "cs_test_secret") = GoatPaymentRequest(
        provider = "stripe", orderId = "order_1", intentId = "pi_1", amount = 4999,
        currency = "USD", nonce = "nonce_1", signedPayload = "irrelevant.irrelevant",
        ephemeralClientToken = token
    )

    @Test
    fun `completed sheet resolves SUCCEEDED`() = runTest {
        val adapter = GoatStripePaymentAdapter(StripeSheetLauncher { _, _ -> StripeSheetResult.COMPLETED })
        val outcome = adapter.processPayment(request(), ctx)
        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
    }

    @Test
    fun `canceled sheet resolves non-terminal DISMISSED`() = runTest {
        val adapter = GoatStripePaymentAdapter(StripeSheetLauncher { _, _ -> StripeSheetResult.CANCELED })
        val outcome = adapter.processPayment(request(), ctx)
        assertEquals(GoatPaymentStatus.DISMISSED, outcome.status)
    }

    @Test
    fun `failed sheet resolves FAILED with a safe sub-code`() = runTest {
        val adapter = GoatStripePaymentAdapter(StripeSheetLauncher { _, _ -> StripeSheetResult.FAILED })
        val outcome = adapter.processPayment(request(), ctx)
        assertEquals(GoatPaymentStatus.FAILED, outcome.status)
        assertEquals("CARD_DECLINED_INSUFFICIENT_FUNDS", outcome.failureSubCode)
    }

    @Test
    fun `missing ephemeral token throws before touching the launcher`() = runTest {
        val adapter = GoatStripePaymentAdapter(StripeSheetLauncher { _, _ -> fail("launcher must not be invoked"); StripeSheetResult.FAILED })
        try {
            adapter.processPayment(request(token = null), ctx)
            fail("Expected GoatPaymentException")
        } catch (e: GoatPaymentException) {
            assertEquals(GoatPaymentErrorCode.PAYMENT_FAILED, e.code)
        }
    }

    @Test
    fun `unlinked default launcher fails loudly instead of silently succeeding`() = runTest {
        val adapter = GoatStripePaymentAdapter()
        try {
            adapter.processPayment(request(), ctx)
            fail("Expected GoatPaymentException")
        } catch (e: GoatPaymentException) {
            assertEquals(GoatPaymentErrorCode.PAYMENT_FAILED, e.code)
        }
    }

    @Test
    fun `link adapter registers under a distinct providerId and shares sheet behavior`() = runTest {
        val adapter = GoatStripeLinkPaymentAdapter(StripeSheetLauncher { _, _ -> StripeSheetResult.COMPLETED })
        assertEquals("link", adapter.providerId)
        val outcome = adapter.processPayment(request(), ctx)
        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
    }

    private class NoOpProxyClient : GoatPaymentServerProxyClient {
        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = null
        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult = GoatClaimResult(true)
        override suspend fun fetchClientToken(intentId: String): String = "unused"
        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome = outcome
        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome = GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, intentId)
    }
}
