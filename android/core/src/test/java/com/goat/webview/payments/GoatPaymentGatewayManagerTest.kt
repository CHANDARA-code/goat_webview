package com.goat.webview.payments

import com.goat.webview.GoatSecurityManager
import com.goat.webview.security.GoatAbuseGuardManager
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.util.concurrent.ConcurrentHashMap

class GoatPaymentGatewayManagerTest {

    private val validOrigin = "https://tenant-1.appassets.androidplatform.net"

    private lateinit var keyPair: KeyPair
    private lateinit var abuseGuard: GoatAbuseGuardManager
    private lateinit var proxy: FakeProxyClient
    private lateinit var store: FakeIntentStore
    private lateinit var manager: GoatPaymentGatewayManager

    @Before
    fun setUp() {
        keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        abuseGuard = GoatAbuseGuardManager()
        abuseGuard.reset()
        proxy = FakeProxyClient()
        store = FakeIntentStore()
        proxy.tenantKeys["tenant-1"] = GoatTenantPublicKey(GoatSecurityManager.encodeBase64(keyPair.public.encoded), "Ed25519")
        manager = GoatPaymentGatewayManager(
            appId = "tenant-1",
            proxyClient = proxy,
            intentStore = store,
            abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin)
        )
    }

    private fun freshGesture() = abuseGuard.recordUserGesture()

    private fun signedRequest(
        intentId: String = "pi_1",
        orderId: String = "order_1",
        amount: Long = 4999,
        currency: String = "USD",
        provider: String = "stripe",
        nonce: String = "nonce_1",
        expiresAt: Long = System.currentTimeMillis() + 300_000,
        displayAmount: Long = amount
    ): GoatPaymentRequest {
        val signedPayload = GoatSignedIntentPayload(intentId, orderId, amount, currency, provider, nonce, expiresAt)
            .encode { data -> GoatSecurityManager.signBytes(data, keyPair.private, "Ed25519") }
        return GoatPaymentRequest(
            provider = provider,
            orderId = orderId,
            intentId = intentId,
            amount = displayAmount,
            currency = currency,
            nonce = nonce,
            signedPayload = signedPayload
        )
    }

    // ---- L1: Gesture gate ----------------------------------------------------------------

    @Test
    fun `rejects with GESTURE_REQUIRED when gesture is stale and no overlay configured`() = runTest {
        manager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
        val ex = expectPaymentException { manager.requestPayment(signedRequest(), validOrigin) }
        assertEquals(GoatPaymentErrorCode.GESTURE_REQUIRED, ex.code)
    }

    @Test
    fun `overlay confirmation anchors a fresh gesture and allows a stale-gesture request through`() = runTest {
        var overlayShown = false
        val overlayManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin),
            overlayPresenter = GoatPaymentProgressOverlayPresenter { overlayShown = true; true }
        )
        overlayManager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })

        val outcome = overlayManager.requestPayment(signedRequest(), validOrigin)

        assertTrue(overlayShown)
        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
    }

    @Test
    fun `overlay decline maps to PAYMENT_CANCELLED without invoking the adapter`() = runTest {
        val overlayManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin),
            overlayPresenter = GoatPaymentProgressOverlayPresenter { false }
        )
        val adapter = FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) }
        overlayManager.registerAdapter(adapter)

        val ex = expectPaymentException { overlayManager.requestPayment(signedRequest(), validOrigin) }

        assertEquals(GoatPaymentErrorCode.PAYMENT_CANCELLED, ex.code)
        assertEquals(0, adapter.processCalls)
    }

    // ---- L2: Signature integrity, expiry, anti-TOCTOU -------------------------------------

    @Test
    fun `rejects tampered signature with PAYMENT_INTENT_INVALID`() = runTest {
        freshGesture()
        val tampered = signedRequest().copy(signedPayload = "not-a-valid-signature")
        val ex = expectPaymentException { manager.requestPayment(tampered, validOrigin) }
        assertEquals(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, ex.code)
    }

    @Test
    fun `rejects expired intent with PAYMENT_INTENT_EXPIRED`() = runTest {
        freshGesture()
        val expired = signedRequest(expiresAt = System.currentTimeMillis() - 1_000)
        val ex = expectPaymentException { manager.requestPayment(expired, validOrigin) }
        assertEquals(GoatPaymentErrorCode.PAYMENT_INTENT_EXPIRED, ex.code)
    }

    @Test
    fun `rejects amount tampering after signing with PAYMENT_INTENT_MISMATCH`() = runTest {
        freshGesture()
        val tampered = signedRequest(amount = 4999, displayAmount = 1)
        val ex = expectPaymentException { manager.requestPayment(tampered, validOrigin) }
        assertEquals(GoatPaymentErrorCode.PAYMENT_INTENT_MISMATCH, ex.code)
    }

    @Test
    fun `rejects a device-supplied public key fallback`() = runTest {
        freshGesture()
        // No key provisioned for this tenant in the Zone 4 directory or cache.
        proxy.tenantKeys.remove("tenant-1")
        val ex = expectPaymentException { manager.requestPayment(signedRequest(), validOrigin) }
        assertEquals(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, ex.code)
    }

    // ---- L5: Origin / gateway allowlist ----------------------------------------------------

    @Test
    fun `rejects disallowed caller origin with ORIGIN_NOT_ALLOWED`() = runTest {
        freshGesture()
        val ex = expectPaymentException { manager.requestPayment(signedRequest(), "https://evil.example.com") }
        assertEquals(GoatPaymentErrorCode.ORIGIN_NOT_ALLOWED, ex.code)
    }

    @Test
    fun `rejects disallowed gateway domain with GATEWAY_NOT_ALLOWED`() = runTest {
        freshGesture()
        val gatedManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), allowedGatewayDomains = setOf("checkout.stripe.com")
        )
        gatedManager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
        val ex = expectPaymentException {
            gatedManager.requestPayment(signedRequest(), validOrigin, gatewayDomain = "phishing.example.com")
        }
        assertEquals(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED, ex.code)
    }

    // ---- Adapter registry / routing --------------------------------------------------------

    @Test
    fun `rejects unregistered provider with PROVIDER_NOT_REGISTERED`() = runTest {
        freshGesture()
        val ex = expectPaymentException { manager.requestPayment(signedRequest(provider = "unknown_psp"), validOrigin) }
        assertEquals(GoatPaymentErrorCode.PROVIDER_NOT_REGISTERED, ex.code)
    }

    @Test
    fun `refuses to silently shadow a built-in provider without allowOverride`() {
        manager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
        try {
            manager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
            fail("Expected IllegalArgumentException")
        } catch (_: IllegalArgumentException) {
            // expected
        }
    }

    // ---- L4: Idempotency, claim conflicts, mutex -------------------------------------------

    @Test
    fun `successful payment is claimed, tokenized, confirmed, and cached`() = runTest {
        freshGesture()
        val adapter = FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId, "txh_1") }
        manager.registerAdapter(adapter)

        val outcome = manager.requestPayment(signedRequest(), validOrigin)

        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome.status)
        assertEquals(1, proxy.claimCalls)
        assertEquals(1, proxy.clientTokenCalls)
        assertEquals(1, proxy.confirmCalls)
        assertNotNull(store.terminal["pi_1"])
        assertNotNull(adapter.lastRequest?.ephemeralClientToken)
    }

    @Test
    fun `repeated bridge calls for an already-terminal intent do not re-charge`() = runTest {
        freshGesture()
        val adapter = FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) }
        manager.registerAdapter(adapter)

        manager.requestPayment(signedRequest(), validOrigin)
        freshGesture()
        val second = manager.requestPayment(signedRequest(), validOrigin)

        assertEquals(GoatPaymentStatus.SUCCEEDED, second.status)
        assertEquals(1, adapter.processCalls)
    }

    @Test
    fun `server-side claim conflict returns the proxy prior outcome without invoking the adapter`() = runTest {
        freshGesture()
        proxy.claimedSet.add("pi_1")
        proxy.terminalOutcomes["pi_1"] = GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1", "txh_prior")
        val adapter = FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) }
        manager.registerAdapter(adapter)

        val outcome = manager.requestPayment(signedRequest(), validOrigin)

        assertEquals("txh_prior", outcome.transactionHandle)
        assertEquals(0, adapter.processCalls)
    }

    @Test
    fun `concurrent duplicate REQUEST_PAYMENT calls for the same intentId reject the second`() = runTest {
        freshGesture()
        val adapter = FakeAdapter("stripe") { delay(200); GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) }
        manager.registerAdapter(adapter)
        val req = signedRequest()

        val first = async { manager.requestPayment(req, validOrigin) }
        yield()
        val second = expectPaymentException { manager.requestPayment(req, validOrigin) }

        assertEquals(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS, second.code)
        assertEquals(GoatPaymentStatus.SUCCEEDED, first.await().status)
    }

    @Test
    fun `watchdog auto-releases the mutex after the in-flight timeout`() = runTest {
        freshGesture()
        val shortWatchdogManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), watchdogMs = 50
        )
        shortWatchdogManager.registerAdapter(FakeAdapter("stripe") { delay(10_000); GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
        val req = signedRequest()

        val timeoutEx = expectPaymentException { shortWatchdogManager.requestPayment(req, validOrigin) }
        assertEquals(GoatPaymentErrorCode.PAYMENT_TIMEOUT, timeoutEx.code)
        assertEquals(GoatPaymentSubCode.STUCK_PAYMENT_WATCHDOG_RELEASED, timeoutEx.subCode)
        assertEquals(1, proxy.claimCalls)

        // The mutex must have been released: a second attempt reaches executeGatedPayment again
        // (proven by a second claim call), rather than short-circuiting on PAYMENT_IN_PROGRESS.
        freshGesture()
        try {
            shortWatchdogManager.requestPayment(req, validOrigin)
        } catch (_: GoatPaymentException) {
            // The proxy's own claim ledger may still legitimately reject the retry; that is a
            // separate concern from the local mutex, which is what this test verifies.
        }
        assertEquals(2, proxy.claimCalls)
    }

    // ---- Non-terminal states & resumability ------------------------------------------------

    @Test
    fun `DISMISSED is non-terminal and is not persisted as a final outcome`() = runTest {
        freshGesture()
        manager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, it.intentId) })

        val outcome = manager.requestPayment(signedRequest(), validOrigin)

        assertEquals(GoatPaymentStatus.DISMISSED, outcome.status)
        assertNull(store.terminal["pi_1"])
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `bakong_khqr background poller reaches a terminal state without holding the mutex`() = runTest {
        freshGesture()
        var asyncOutcome: GoatPaymentOutcome? = null
        val adapter = FakeAdapter("bakong_khqr") { GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, it.intentId) }
        adapter.queryStatusResult = GoatPaymentStatus.PROCESSING
        val khqrManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), onAsyncTerminalOutcome = { asyncOutcome = it },
            backgroundScope = this, khqrFastPollIntervalMs = 1_000L, khqrFastPollWindowMs = 15_000L
        )
        khqrManager.registerAdapter(adapter)

        val initial = khqrManager.requestPayment(signedRequest(provider = "bakong_khqr"), validOrigin)
        assertEquals(GoatPaymentStatus.PROCESSING, initial.status)

        // The bridge call already returned — the mutex/watchdog is not held during polling.
        adapter.queryStatusResult = GoatPaymentStatus.SUCCEEDED
        testScheduler.advanceTimeBy(1_500L)
        testScheduler.runCurrent()

        assertEquals(GoatPaymentStatus.SUCCEEDED, asyncOutcome?.status)
        assertNotNull(store.terminal["pi_1"])
    }

    @Test
    fun `onAppResume flushes a backgrounded KHQR intent to a terminal state and fires the async callback`() = runTest {
        freshGesture()
        var asyncOutcome: GoatPaymentOutcome? = null
        val resumeManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), onAsyncTerminalOutcome = { asyncOutcome = it }
        )
        val adapter = FakeAdapter("bakong_khqr") { GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, it.intentId) }
        adapter.queryStatusResult = GoatPaymentStatus.SUCCEEDED
        resumeManager.registerAdapter(adapter)

        val initial = resumeManager.requestPayment(signedRequest(provider = "bakong_khqr"), validOrigin)
        assertEquals(GoatPaymentStatus.DISMISSED, initial.status)

        resumeManager.onAppResume()

        assertEquals(GoatPaymentStatus.SUCCEEDED, asyncOutcome?.status)
        assertNotNull(store.terminal["pi_1"])
    }

    // ---- L5: App2App Universal/App Link return verification --------------------------------

    @Test
    fun `a verified HTTPS return link re-checks the proxy and resolves to the terminal outcome`() = runTest {
        freshGesture()
        val returnManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), allowedReturnDomains = setOf("pay.tenant-1.com")
        )
        returnManager.registerAdapter(FakeAdapter("alipay") { GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, it.intentId) })
        returnManager.requestPayment(signedRequest(provider = "alipay"), validOrigin)
        proxy.terminalOutcomes["pi_1"] = GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_1", "txh_return")

        val outcome = returnManager.handleReturnUrl(android.net.Uri.parse("https://pay.tenant-1.com/payment/return?intentId=pi_1"))

        assertEquals(GoatPaymentStatus.SUCCEEDED, outcome?.status)
        assertEquals("txh_return", outcome?.transactionHandle)
        assertNotNull(store.terminal["pi_1"])
    }

    @Test
    fun `an unverified custom-scheme return link is ignored and never reaches the proxy`() = runTest {
        val returnManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), allowedReturnDomains = setOf("pay.tenant-1.com")
        )
        proxy.terminalOutcomes["pi_forged"] = GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, "pi_forged")

        val outcome = returnManager.handleReturnUrl(android.net.Uri.parse("goat://pay.tenant-1.com/payment/return?intentId=pi_forged"))

        assertNull(outcome)
        assertEquals(0, proxy.queryCalls)
    }

    @Test
    fun `a return link on a non-allowlisted domain is rejected`() = runTest {
        val returnManager = GoatPaymentGatewayManager(
            appId = "tenant-1", proxyClient = proxy, intentStore = store, abuseGuardManager = abuseGuard,
            allowedOrigins = setOf(validOrigin), allowedReturnDomains = setOf("pay.tenant-1.com")
        )
        val outcome = returnManager.handleReturnUrl(android.net.Uri.parse("https://evil.example.com/return?intentId=pi_1"))
        assertNull(outcome)
        assertEquals(0, proxy.queryCalls)
    }

    @Test
    fun `a return link with no allowedReturnDomains configured on the manager rejects everything`() = runTest {
        val outcome = manager.handleReturnUrl(android.net.Uri.parse("https://pay.tenant-1.com/payment/return?intentId=pi_1"))
        assertNull(outcome)
    }

    // ---- Monotonic state engine (proxy-enforced) -------------------------------------------

    @Test
    fun `a SUCCEEDED intent cannot be downgraded by a subsequent client cancel`() = runTest {
        freshGesture()
        manager.registerAdapter(FakeAdapter("stripe") { GoatPaymentOutcome(GoatPaymentStatus.SUCCEEDED, it.intentId) })
        manager.requestPayment(signedRequest(), validOrigin)

        val cancelled = manager.cancelPayment("pi_1")

        assertEquals(GoatPaymentStatus.SUCCEEDED, cancelled.status)
    }

    private suspend fun expectPaymentException(block: suspend () -> Unit): GoatPaymentException {
        try {
            block()
        } catch (e: GoatPaymentException) {
            return e
        }
        fail("Expected GoatPaymentException to be thrown")
        throw IllegalStateException("unreachable")
    }

    // ---- Fakes --------------------------------------------------------------------------

    private class FakeIntentStore : GoatPaymentIntentStoreApi {
        val terminal = ConcurrentHashMap<String, GoatPaymentOutcome>()
        val tenantKeys = ConcurrentHashMap<String, GoatTenantPublicKey>()

        override suspend fun getTerminalOutcome(intentId: String): GoatPaymentOutcome? = terminal[intentId]

        override suspend fun putTerminalOutcome(outcome: GoatPaymentOutcome) {
            if (outcome.status.isTerminal) terminal[outcome.intentId] = outcome
        }

        override suspend fun getCachedTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = tenantKeys[tenantAppId]

        override suspend fun cacheTenantPublicKey(tenantAppId: String, key: GoatTenantPublicKey) {
            tenantKeys[tenantAppId] = key
        }
    }

    private class FakeProxyClient : GoatPaymentServerProxyClient {
        val tenantKeys = ConcurrentHashMap<String, GoatTenantPublicKey>()
        val claimedSet: MutableSet<String> = ConcurrentHashMap.newKeySet()
        val terminalOutcomes = ConcurrentHashMap<String, GoatPaymentOutcome>()
        var claimCalls = 0
        var clientTokenCalls = 0
        var confirmCalls = 0
        var cancelCalls = 0
        var queryCalls = 0

        override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? = tenantKeys[tenantAppId]

        override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult {
            claimCalls++
            if (claimedSet.contains(intentId)) {
                return GoatClaimResult(false, terminalOutcomes[intentId])
            }
            claimedSet.add(intentId)
            return GoatClaimResult(true)
        }

        override suspend fun fetchClientToken(intentId: String): String {
            clientTokenCalls++
            return "ephemeral_token_$intentId"
        }

        override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome {
            confirmCalls++
            val existing = terminalOutcomes[intentId]
            // Monotonic rule: a terminal SUCCEEDED state is immutable.
            val finalOutcome = if (existing?.status == GoatPaymentStatus.SUCCEEDED) existing else outcome
            if (finalOutcome.status.isTerminal) terminalOutcomes[intentId] = finalOutcome
            return finalOutcome
        }

        override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome {
            cancelCalls++
            val existing = terminalOutcomes[intentId]
            if (existing?.status == GoatPaymentStatus.SUCCEEDED) return existing
            val cancelled = GoatPaymentOutcome(GoatPaymentStatus.CANCELLED, intentId)
            terminalOutcomes[intentId] = cancelled
            return cancelled
        }

        override suspend fun queryIntent(intentId: String): GoatPaymentOutcome {
            queryCalls++
            return terminalOutcomes[intentId] ?: GoatPaymentOutcome(GoatPaymentStatus.CREATED, intentId)
        }
    }

    private class FakeAdapter(
        override val providerId: String,
        private val onProcess: suspend (GoatPaymentRequest) -> GoatPaymentOutcome
    ) : GoatPaymentAdapter {
        var processCalls = 0
        var lastRequest: GoatPaymentRequest? = null
        var queryStatusResult: GoatPaymentStatus? = null

        override suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome {
            processCalls++
            lastRequest = request
            return onProcess(request)
        }

        override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
            queryStatusResult ?: GoatPaymentStatus.PROCESSING

        override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
            GoatPaymentStatus.CANCELLED
    }
}
