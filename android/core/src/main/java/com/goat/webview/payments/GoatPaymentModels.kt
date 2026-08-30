package com.goat.webview.payments


/**
 * Terminal and non-terminal payment intent states (Task 10206 / §9 state machine).
 * `SUCCEEDED` is monotonically immutable once reached — see [GoatPaymentGatewayManager].
 */
enum class GoatPaymentStatus {
    CREATED,
    CLAIMED,
    PROCESSING,
    DISMISSED,
    AUTHORIZED,
    SUCCEEDED,
    FAILED,
    CANCELLED,
    EXPIRED;

    val isTerminal: Boolean
        get() = this == SUCCEEDED || this == FAILED || this == CANCELLED || this == EXPIRED

    companion object {
        fun fromWire(value: String?): GoatPaymentStatus? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

/** Standard bridge error codes for the Payment Security Gate (Task 10206 / §8). */
object GoatPaymentErrorCode {
    const val GESTURE_REQUIRED = "GESTURE_REQUIRED"
    const val ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED"
    const val GATEWAY_NOT_ALLOWED = "GATEWAY_NOT_ALLOWED"
    const val PAYMENT_INTENT_INVALID = "PAYMENT_INTENT_INVALID"
    const val PAYMENT_INTENT_EXPIRED = "PAYMENT_INTENT_EXPIRED"
    const val PAYMENT_INTENT_MISMATCH = "PAYMENT_INTENT_MISMATCH"
    const val PROVIDER_NOT_REGISTERED = "PROVIDER_NOT_REGISTERED"
    const val PAYMENT_IN_PROGRESS = "PAYMENT_IN_PROGRESS"
    const val PAYMENT_CANCELLED = "PAYMENT_CANCELLED"
    const val PAYMENT_FAILED = "PAYMENT_FAILED"
    const val PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT"
}

/** Actionable, non-sensitive failure sub-codes (Task 10206 / §8). */
object GoatPaymentSubCode {
    const val CARD_DECLINED_INSUFFICIENT_FUNDS = "CARD_DECLINED_INSUFFICIENT_FUNDS"
    const val CARD_EXPIRED = "CARD_EXPIRED"
    const val AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    const val NETWORK_TIMEOUT = "NETWORK_TIMEOUT"
    const val STUCK_PAYMENT_WATCHDOG_RELEASED = "STUCK_PAYMENT_WATCHDOG_RELEASED"
}

/**
 * Thrown by any layer of the Payment Security Gate; carries a safe [code]/[subCode] pair.
 *
 * The bridge transport (`GoatWebMessageListener`) currently serializes failures via
 * `exception.message` only, so [code] (and [subCode], if present) are embedded as a parseable
 * `"CODE: reason [SUB_CODE]"` prefix — matching the existing `GESTURE_REQUIRED: ...` /
 * `DOMAIN_NOT_ALLOWED: ...` convention used elsewhere in `GoatBridgeActionHandler`.
 */
class GoatPaymentException(
    val code: String,
    val reason: String,
    val subCode: String? = null
) : Exception(buildString {
    append(code)
    append(": ")
    append(reason)
    if (subCode != null) {
        append(" [")
        append(subCode)
        append("]")
    }
})

/**
 * Untrusted, JS-originated payment request payload (Zone 0). `expiresAt` is deliberately absent
 * here — it is only ever trusted from inside the decoded, signature-verified [GoatSignedIntentPayload]
 * (see L2 in [GoatPaymentGatewayManager]), never as a bare JS-supplied field. Every field except
 * [ephemeralClientToken] arrives verbatim from the bridge; [ephemeralClientToken] is injected
 * natively by [GoatPaymentGatewayManager] after L3 tokenization and never touches JS.
 */
data class GoatPaymentRequest(
    val provider: String,
    val orderId: String,
    val intentId: String,
    val amount: Long,
    val currency: String,
    val nonce: String,
    val signedPayload: String,
    val ephemeralClientToken: String? = null
)

/**
 * The canonical, backend-signed fields for a payment intent (Task 10206 / §7 L2).
 *
 * Encoded on the wire as `signedPayload = base64(canonical) + "." + base64(signature)` — a
 * compact, self-contained format that lets native verify the signature AND detect
 * amount/currency/order tampering (anti-TOCTOU, A1) without any extra network round trip:
 * the JS-supplied top-level [GoatPaymentRequest] fields are display-only and must match the
 * values embedded inside the signed segment.
 */
data class GoatSignedIntentPayload(
    val intentId: String,
    val orderId: String,
    val amount: Long,
    val currency: String,
    val provider: String,
    val nonce: String,
    val expiresAt: Long
) {
    /** Deterministic canonical byte encoding for signature verification (order matters). */
    fun canonicalBytes(): ByteArray = canonicalString().toByteArray(Charsets.UTF_8)

    private fun canonicalString(): String =
        "$intentId|$orderId|$amount|$currency|$provider|$nonce|$expiresAt"

    fun encode(sign: (ByteArray) -> ByteArray): String {
        val canonicalB64 = java.util.Base64.getEncoder().encodeToString(canonicalBytes())
        val sigB64 = java.util.Base64.getEncoder().encodeToString(sign(canonicalBytes()))
        return "$canonicalB64.$sigB64"
    }

    companion object {
        /**
         * Splits a `signedPayload` wire string into its decoded canonical fields and raw
         * signature bytes. Returns `null` if the format is malformed (treated as
         * [GoatPaymentErrorCode.PAYMENT_INTENT_INVALID] by the caller).
         */
        fun decode(signedPayload: String): Pair<GoatSignedIntentPayload, ByteArray>? {
            val parts = signedPayload.split(".")
            if (parts.size != 2) return null
            return try {
                val canonicalStr = String(java.util.Base64.getDecoder().decode(parts[0]), Charsets.UTF_8)
                val sigBytes = java.util.Base64.getDecoder().decode(parts[1])
                val fields = canonicalStr.split("|")
                if (fields.size != 7) return null
                val payload = GoatSignedIntentPayload(
                    intentId = fields[0],
                    orderId = fields[1],
                    amount = fields[2].toLong(),
                    currency = fields[3],
                    provider = fields[4],
                    nonce = fields[5],
                    expiresAt = fields[6].toLong()
                )
                payload to sigBytes
            } catch (_: Exception) {
                null
            }
        }
    }
}

/** Outcome returned by a [GoatPaymentAdapter] after driving the provider's checkout surface. */
data class GoatPaymentOutcome(
    val status: GoatPaymentStatus,
    val intentId: String,
    val transactionHandle: String? = null,
    val providerRef: String? = null,
    val failureSubCode: String? = null
)

/**
 * Capability-scoped execution context handed to adapters. Deliberately does NOT expose
 * [com.goat.webview.GoatSecureStorageManager], the tenant signing key, or an arbitrary
 * `Context`/`Activity` reference (Task 10206 / §5.2).
 */
class GoatPaymentContext(
    val appId: String,
    val proxyClient: GoatPaymentServerProxyClient,
    val presenterHandle: Any? = null,
    val logger: (String) -> Unit = {}
)

/**
 * Result of the L1-L5 security gate evaluation. `null` [outcome] plus non-null [rejection]
 * means the request never reached [GoatPaymentGatewayManager.route].
 */
internal data class GoatPaymentGateResult(
    val allowed: Boolean,
    val rejection: GoatPaymentException? = null
)
