package com.goat.webview.payments

import android.net.Uri
import com.goat.webview.GoatSecurityManager
import com.goat.webview.security.GoatAbuseGuardManager
import com.goat.webview.security.GoatContentBlocker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap

/**
 * Core native payment gateway proxy manager and Payment Security Gate orchestrator
 * (Task 10206 / §5.1). Owns the adapter registry, the in-memory thread-safe mutex map guarding
 * `intentId`, the L1-L5 gate, and the local idempotency/pending-intent bookkeeping.
 *
 * The only path from the untrusted web context to money is [requestPayment] — there is no
 * fast path, no bypass action, and no free-form field the web context can use to smuggle data.
 */
class GoatPaymentGatewayManager(
    private val appId: String,
    private val proxyClient: GoatPaymentServerProxyClient,
    private val intentStore: GoatPaymentIntentStoreApi,
    private val abuseGuardManager: GoatAbuseGuardManager,
    private val allowedOrigins: Set<String> = GoatSecurityManager.DEFAULT_WHITELISTED_ORIGINS,
    private val allowedGatewayDomains: Set<String> = emptySet(),
    /** HTTPS Universal/App Link domains trusted for app2app payment returns (Task 10206 / §7 L5). */
    private val allowedReturnDomains: Set<String> = emptySet(),
    private val overlayPresenter: GoatPaymentProgressOverlayPresenter? = null,
    private val presenterHandleProvider: (() -> Any?)? = null,
    private val watchdogMs: Long = DEFAULT_WATCHDOG_MS,
    /** Fired whenever a terminal outcome is reached asynchronously (no pending bridge call to resolve),
     *  e.g. from [onAppResume] or the KHQR background poller. Hosts wire this to emit `ON_PAYMENT_RESULT`. */
    private val onAsyncTerminalOutcome: ((GoatPaymentOutcome) -> Unit)? = null,
    /** Scope backing the KHQR background poller — outlives any single bridge call's watchdog window. */
    private val backgroundScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
    private val khqrFastPollIntervalMs: Long = 1_000L,
    private val khqrSlowPollIntervalMs: Long = 3_000L,
    private val khqrFastPollWindowMs: Long = 15_000L,
    private val khqrMaxPollDurationMs: Long = 3 * 60_000L
) {
    companion object {
        const val DEFAULT_WATCHDOG_MS = 45_000L
        val BUILT_IN_PROVIDERS = setOf("alipay", "stripe", "link", "paypay", "bakong_khqr", "wechat_pay")
        private const val KHQR_PROVIDER_ID = "bakong_khqr"
    }

    private val adapters = ConcurrentHashMap<String, GoatPaymentAdapter>()
    private val intentMutexes = ConcurrentHashMap<String, Mutex>()
    private val lockAcquiredAt = ConcurrentHashMap<String, Long>()
    private val pendingProviderByIntent = ConcurrentHashMap<String, String>()

    /**
     * Registers a [GoatPaymentAdapter]. Strictly callable only by host application code during
     * startup (Task 10206 / §5.2) — mini-apps cannot reach this from JS. Refuses to silently
     * shadow a built-in provider unless [allowOverride] is set.
     */
    fun registerAdapter(adapter: GoatPaymentAdapter, allowOverride: Boolean = false) {
        require(adapter.providerId.isNotBlank()) { "providerId must not be blank" }
        if (!allowOverride && adapter.providerId in BUILT_IN_PROVIDERS && adapters.containsKey(adapter.providerId)) {
            throw IllegalArgumentException(
                "Provider '${adapter.providerId}' is already registered as built-in; pass allowOverride=true to replace it."
            )
        }
        adapters[adapter.providerId] = adapter
    }

    fun getRegisteredProviderIds(): Set<String> = adapters.keys.toSet()

    /**
     * Entry point for the `REQUEST_PAYMENT` bridge action. Acquires the per-`intentId` mutex,
     * runs the full L1-L5 gate, routes to the registered adapter, and returns the
     * server-confirmed authoritative outcome.
     */
    suspend fun requestPayment(
        request: GoatPaymentRequest,
        callerOrigin: String?,
        gatewayDomain: String? = null
    ): GoatPaymentOutcome {
        releaseOrphanedLocks()

        val mutex = intentMutexes.computeIfAbsent(request.intentId) { Mutex() }
        if (!mutex.tryLock()) {
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_IN_PROGRESS,
                "Another bridge call for intentId '${request.intentId}' is mid-flight."
            )
        }
        lockAcquiredAt[request.intentId] = System.currentTimeMillis()
        try {
            return withTimeout(watchdogMs) {
                executeGatedPayment(request, callerOrigin, gatewayDomain)
            }
        } catch (e: TimeoutCancellationException) {
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_TIMEOUT,
                "Adapter exceeded ${watchdogMs}ms in-flight watchdog.",
                GoatPaymentSubCode.STUCK_PAYMENT_WATCHDOG_RELEASED
            )
        } finally {
            lockAcquiredAt.remove(request.intentId)
            if (mutex.isLocked) mutex.unlock()
        }
    }

    /** Entry point for `QUERY_PAYMENT_STATUS`. Not gesture-gated — used by `onAppResume` polling too. */
    suspend fun queryPaymentStatus(intentId: String): GoatPaymentOutcome {
        intentStore.getTerminalOutcome(intentId)?.let { return it }
        val outcome = proxyClient.queryIntent(intentId)
        if (outcome.status.isTerminal) {
            intentStore.putTerminalOutcome(outcome)
            pendingProviderByIntent.remove(intentId)
        }
        return outcome
    }

    /** Entry point for `CANCEL_PAYMENT`. `SUCCEEDED` is immutable — the proxy enforces this server-side. */
    suspend fun cancelPayment(intentId: String): GoatPaymentOutcome {
        intentStore.getTerminalOutcome(intentId)?.let { return it }

        pendingProviderByIntent[intentId]?.let { providerId ->
            adapters[providerId]?.let { adapter ->
                try {
                    adapter.cancelPayment(intentId, buildContext())
                } catch (_: Exception) {
                    // Best-effort; the server proxy remains the authority on final state.
                }
            }
        }

        val outcome = proxyClient.cancelIntent(intentId)
        if (outcome.status.isTerminal) {
            intentStore.putTerminalOutcome(outcome)
            pendingProviderByIntent.remove(intentId)
        }
        return outcome
    }

    /**
     * Flushes status queries for all backgrounded/pending intents. Triggered on host `onResume`
     * (Task 10206 / §5.1) so app2app and Bakong KHQR flows resolve immediately when the user
     * returns to the app instead of waiting for the next poll tick.
     */
    suspend fun onAppResume() {
        val snapshot = pendingProviderByIntent.entries.toList()
        for ((intentId, providerId) in snapshot) {
            val adapter = adapters[providerId] ?: continue
            try {
                val status = adapter.queryStatus(intentId, buildContext())
                if (status.isTerminal) {
                    val confirmed = proxyClient.confirmIntent(intentId, GoatPaymentOutcome(status, intentId))
                    intentStore.putTerminalOutcome(confirmed)
                    pendingProviderByIntent.remove(intentId)
                    onAsyncTerminalOutcome?.invoke(confirmed)
                }
            } catch (_: Exception) {
                // Leave as pending; next resume or poll tick will retry.
            }
        }
    }

    /**
     * Host-facing entry point for app2app payment return navigation (Task 10206 / §7 L5, A3) —
     * call this from the host Activity's `onNewIntent`/deep-link handler, mirroring
     * [com.goat.webview.auth.GoatOAuthSessionManager.handleRedirectUri]. Returns `null` and does
     * nothing if [uri] is not an HTTPS Universal/App Link matching [allowedReturnDomains] —
     * a legacy custom-scheme return is silently ignored rather than trusted.
     *
     * The return URL itself is never trusted for the payment outcome: a valid return only
     * triggers an immediate re-check against the server proxy, exactly like [onAppResume].
     */
    suspend fun handleReturnUrl(uri: Uri): GoatPaymentOutcome? {
        if (!GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowedReturnDomains)) {
            return null
        }
        val intentId = GoatPaymentReturnLinkVerifier.extractQueryParam(uri, "intentId")
            ?: return null

        intentStore.getTerminalOutcome(intentId)?.let { return it }

        return try {
            val outcome = proxyClient.queryIntent(intentId)
            if (outcome.status.isTerminal) {
                intentStore.putTerminalOutcome(outcome)
                pendingProviderByIntent.remove(intentId)
                onAsyncTerminalOutcome?.invoke(outcome)
            }
            outcome
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun executeGatedPayment(
        request: GoatPaymentRequest,
        callerOrigin: String?,
        gatewayDomain: String?
    ): GoatPaymentOutcome {
        gateL1Gesture(request)
        gateL5OriginAndGateway(callerOrigin, gatewayDomain)
        gateL2SignatureAndIntegrity(request)

        // L4a — local idempotency: a terminal result already exists, never re-charge.
        intentStore.getTerminalOutcome(request.intentId)?.let { return it }

        // L4b — server-authoritative claim.
        val claim = proxyClient.claimIntent(request.intentId, appId)
        if (!claim.claimed) {
            claim.priorOutcome?.let {
                if (it.status.isTerminal) intentStore.putTerminalOutcome(it)
                return it
            }
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS, "Intent already claimed by another request.")
        }

        // L3 — ephemeral single-intent client token, native memory only, never returned to JS.
        val clientToken = proxyClient.fetchClientToken(request.intentId)

        val adapter = adapters[request.provider]
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PROVIDER_NOT_REGISTERED, "No adapter registered for provider '${request.provider}'.")

        pendingProviderByIntent[request.intentId] = request.provider

        val tokenizedRequest = request.copy(ephemeralClientToken = clientToken)
        val adapterOutcome = adapter.processPayment(tokenizedRequest, buildContext())

        val confirmed = proxyClient.confirmIntent(request.intentId, adapterOutcome)
        if (confirmed.status.isTerminal) {
            intentStore.putTerminalOutcome(confirmed)
            pendingProviderByIntent.remove(request.intentId)
        } else if (request.provider == KHQR_PROVIDER_ID) {
            scheduleKhqrBackgroundPolling(request.intentId)
        }
        return confirmed
    }

    /**
     * Background 1s/3s poll of a pending KHQR intent (Task 10206 / §5.3), running on
     * [backgroundScope] — independent of any single bridge call's mutex/watchdog window — for up
     * to [khqrMaxPollDurationMs]. Reports completion via [onAsyncTerminalOutcome], the same path
     * used by [onAppResume].
     */
    private fun scheduleKhqrBackgroundPolling(intentId: String) {
        backgroundScope.launch {
            val adapter = adapters[KHQR_PROVIDER_ID] ?: return@launch
            val startedAt = System.currentTimeMillis()
            while (System.currentTimeMillis() - startedAt < khqrMaxPollDurationMs) {
                val elapsed = System.currentTimeMillis() - startedAt
                delay(if (elapsed < khqrFastPollWindowMs) khqrFastPollIntervalMs else khqrSlowPollIntervalMs)
                try {
                    val status = adapter.queryStatus(intentId, buildContext())
                    if (status.isTerminal) {
                        val confirmed = proxyClient.confirmIntent(intentId, GoatPaymentOutcome(status, intentId))
                        intentStore.putTerminalOutcome(confirmed)
                        pendingProviderByIntent.remove(intentId)
                        onAsyncTerminalOutcome?.invoke(confirmed)
                        return@launch
                    }
                } catch (_: Exception) {
                    // Transient network error — retry on the next tick.
                }
            }
        }
    }

    private suspend fun gateL1Gesture(request: GoatPaymentRequest) {
        if (abuseGuardManager.isGestureFresh()) return

        val overlay = overlayPresenter
            ?: throw GoatPaymentException(GoatPaymentErrorCode.GESTURE_REQUIRED, "Privileged action 'REQUEST_PAYMENT' requires a recent user gesture (< 10s).")

        val confirmed = try {
            overlay.present(GoatPaymentOverlayRequest(request.provider, request.amount, request.currency))
        } catch (_: Exception) {
            false
        }
        if (!confirmed) {
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_CANCELLED, "User declined the native payment confirmation overlay.")
        }
        // The overlay confirmation tap is itself a genuine, fresh native gesture.
        abuseGuardManager.recordUserGesture()
    }

    private fun gateL5OriginAndGateway(callerOrigin: String?, gatewayDomain: String?) {
        if (!GoatSecurityManager.isOriginAllowed(callerOrigin, allowedOrigins)) {
            throw GoatPaymentException(GoatPaymentErrorCode.ORIGIN_NOT_ALLOWED, "Caller frame origin '$callerOrigin' is not sandboxed.")
        }
        if (gatewayDomain != null && allowedGatewayDomains.isNotEmpty()) {
            val uri = Uri.parse("https://$gatewayDomain")
            if (!GoatContentBlocker.isUriAllowed(uri, allowedGatewayDomains, tenantDomain = "__no_default__")) {
                throw GoatPaymentException(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED, "Gateway domain '$gatewayDomain' is not in manifest.security.paymentGateways.")
            }
        }
    }

    private suspend fun gateL2SignatureAndIntegrity(request: GoatPaymentRequest) {
        val decoded = GoatSignedIntentPayload.decode(request.signedPayload)
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, "Malformed signedPayload.")
        val (signed, sigBytes) = decoded

        val tenantKey = intentStore.getCachedTenantPublicKey(appId)
            ?: proxyClient.fetchTenantPublicKey(appId)?.also { intentStore.cacheTenantPublicKey(appId, it) }
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, "No tenant public key provisioned by Zone 4 directory.")

        val isEd25519 = tenantKey.algorithm.equals("Ed25519", ignoreCase = true)
        val algorithm = if (isEd25519) "Ed25519" else GoatSecurityManager.ALGORITHM_ECDSA
        val keyAlgorithm = if (isEd25519) "Ed25519" else GoatSecurityManager.KEY_ALGORITHM_EC

        val publicKey = try {
            GoatSecurityManager.decodePublicKey(GoatSecurityManager.decodeBase64Signature(tenantKey.keyBase64), keyAlgorithm)
        } catch (e: Exception) {
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, "Malformed tenant public key.")
        }

        val valid = GoatSecurityManager.verifyBytesSignature(signed.canonicalBytes(), sigBytes, publicKey, algorithm)
        if (!valid) {
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, "Backend payload signature verification failed.")
        }

        if (System.currentTimeMillis() > signed.expiresAt) {
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_EXPIRED, "Payment intent expired at ${signed.expiresAt}.")
        }

        // Anti-TOCTOU (A1): JS-supplied top-level fields are display-only and must match the signed truth.
        if (signed.intentId != request.intentId ||
            signed.orderId != request.orderId ||
            signed.amount != request.amount ||
            signed.currency != request.currency ||
            signed.provider != request.provider
        ) {
            throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_MISMATCH, "Request fields do not match the signed intent payload.")
        }
    }

    private fun releaseOrphanedLocks() {
        val now = System.currentTimeMillis()
        for ((intentId, acquiredAt) in lockAcquiredAt) {
            if (now - acquiredAt > watchdogMs) {
                intentMutexes[intentId]?.let { m -> try { if (m.isLocked) m.unlock() } catch (_: Throwable) {} }
                lockAcquiredAt.remove(intentId)
            }
        }
    }

    private fun buildContext(): GoatPaymentContext =
        GoatPaymentContext(appId = appId, proxyClient = proxyClient, presenterHandle = presenterHandleProvider?.invoke())
}
