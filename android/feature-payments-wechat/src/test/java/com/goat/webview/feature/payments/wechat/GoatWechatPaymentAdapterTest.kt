package com.goat.webview.feature.payments.wechat

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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatWechatPaymentAdapterTest {

    private companion object {
        const val ORDER_TOKEN =
            "appId=wx123;partnerId=1900000109;prepayId=wx2017033010242291;nonceStr=abc123;" +
                "timeStamp=1490840662;package=Sign=WXPay;sign=A1B2C3"
    }

    private fun request(token: String? = ORDER_TOKEN) = GoatPaymentRequest(
        provider = "wechat_pay", orderId = "order_1", intentId = "pi_1", amount = 4999,
        currency = "CNY", nonce = "nonce_1", signedPayload = "irrelevant.irrelevant",
        ephemeralClientToken = token
    )

    private class FakeLauncher(
        var installed: Boolean = true,
        var result: WechatResult = WechatResult.SUCCESS
    ) : WechatPayLauncher {
        var sendCalls = 0
        var lastOrder: WechatPayOrder? = null
        override suspend fun isWechatInstalled(): Boolean = installed
        override suspend fun sendPayRequest(order: WechatPayOrder, ctx: GoatPaymentContext): WechatResult {
            sendCalls++
            lastOrder = order
            return result
        }
    }

    private class FakeProxyClient(private val queryResult: GoatPaymentOutcome) : GoatPaymentServerProxyClient {
        var queryCalls = 0
        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = null
        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult = GoatClaimResult(true)
        override suspend fun fetchClientToken(intentId: String): String = "unused"
        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome = outcome
        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome =
            GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome {
            queryCalls++
            return queryResult
        }
    }

    private fun ctx(proxy: GoatPaymentServerProxyClient) = GoatPaymentContext(appId = "tenant-1", proxyClient = proxy)

    @Test
    fun `provider id is stable`() {
        assertEquals("wechat_pay", GoatWechatPaymentAdapter().providerId)
    }

    @Test
    fun `a provisional SDK success is not trusted until the proxy confirms it`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val adapter = GoatWechatPaymentAdapter(FakeLauncher(result = WechatResult.SUCCESS))

        val outcome = adapter.processPayment(request(), ctx(proxy))

        assertEquals(GoatPaymentStatus.PROCESSING, outcome.status)
        assertEquals("errCode 0 must still be reconciled against the proxy", 1, proxy.queryCalls)
    }

    @Test
    fun `an already-terminal proxy state wins over a provisional failure`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1", "txh_1"))
        val adapter = GoatWechatPaymentAdapter(FakeLauncher(result = WechatResult.FAILED))

        val outcome = adapter.processPayment(request(), ctx(proxy))
        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
    }

    @Test
    fun `user cancellation maps to DISMISSED not FAILED`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val adapter = GoatWechatPaymentAdapter(FakeLauncher(result = WechatResult.CANCELED))
        assertEquals(GoatPaymentStatus.DISMISSED, adapter.processPayment(request(), ctx(proxy)).status)
    }

    @Test
    fun `an absent WeChat client is rejected before any request is sent`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val launcher = FakeLauncher(installed = false)
        val adapter = GoatWechatPaymentAdapter(launcher)

        val error = runCatching { adapter.processPayment(request(), ctx(proxy)) }.exceptionOrNull()
        assertTrue(error is GoatPaymentException)
        assertTrue(error!!.message!!.contains("PROVIDER_NOT_INSTALLED"))
        assertEquals("no request may be sent to an absent client", 0, launcher.sendCalls)
    }

    @Test
    fun `an unlinked host fails closed rather than pretending to pay`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val error = runCatching {
            GoatWechatPaymentAdapter().processPayment(request(), ctx(proxy))
        }.exceptionOrNull()
        assertTrue(error is GoatPaymentException)
        assertTrue(error!!.message!!.contains("PROVIDER_NOT_INSTALLED"))
    }

    @Test
    fun `the signed order envelope is parsed field by field`() {
        val order = GoatWechatPaymentAdapter().parseOrder(ORDER_TOKEN)
        assertEquals("wx123", order.appId)
        assertEquals("1900000109", order.partnerId)
        assertEquals("wx2017033010242291", order.prepayId)
        assertEquals("abc123", order.nonceStr)
        assertEquals("1490840662", order.timeStamp)
        assertEquals("Sign=WXPay", order.packageValue)
        assertEquals("A1B2C3", order.sign)
    }

    @Test
    fun `a truncated order envelope is rejected rather than half-sent to the SDK`() {
        val adapter = GoatWechatPaymentAdapter()
        for (missing in listOf("appId", "partnerId", "prepayId", "nonceStr", "timeStamp", "sign")) {
            val broken = ORDER_TOKEN.split(';')
                .filterNot { it.startsWith("$missing=") }
                .joinToString(";")
            val error = runCatching { adapter.parseOrder(broken) }.exceptionOrNull()
            assertTrue("missing '$missing' must be rejected", error is GoatPaymentException)
            assertTrue(error!!.message!!.contains(missing))
        }
    }

    @Test
    fun `a missing ephemeral token is rejected`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, "pi_1"))
        val error = runCatching {
            GoatWechatPaymentAdapter(FakeLauncher()).processPayment(request(token = null), ctx(proxy))
        }.exceptionOrNull()
        assertTrue(error is GoatPaymentException)
    }

    @Test
    fun `errCode classification follows WeChat's documented values`() {
        assertEquals(WechatResult.SUCCESS, WechatErrorCode.classify(0))
        assertEquals(WechatResult.CANCELED, WechatErrorCode.classify(-2))
        assertEquals(WechatResult.FAILED, WechatErrorCode.classify(-1))
        assertEquals(WechatResult.FAILED, WechatErrorCode.classify(-3))
        assertEquals(WechatResult.FAILED, WechatErrorCode.classify(null))
    }

    @Test
    fun `cancel and query delegate to the authoritative proxy`() = runTest {
        val proxy = FakeProxyClient(GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1"))
        val adapter = GoatWechatPaymentAdapter(FakeLauncher())
        assertEquals(GoatPaymentStatus.SUCCEEDED, adapter.queryStatus("pi_1", ctx(proxy)))
        assertEquals(GoatPaymentStatus.CANCELLED, adapter.cancelPayment("pi_1", ctx(proxy)))
        assertFalse(proxy.queryCalls == 0)
    }
}
