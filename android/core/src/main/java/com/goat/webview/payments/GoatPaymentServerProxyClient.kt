package com.goat.webview.payments

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.net.HttpURLConnection
import java.net.URL

/** Zone 4 tenant public key directory entry, cached client-side via [GoatPaymentIntentStore]. */
data class GoatTenantPublicKey(val keyBase64: String, val algorithm: String)

/** Outcome of a `POST /pay/intents/:id/claim` call — either freshly claimed or already-terminal. */
data class GoatClaimResult(val claimed: Boolean, val priorOutcome: GoatPaymentOutcome? = null)

/**
 * Native-side client for the Zone 4 Goat Server Payment Proxy (Task 10206 / §5.4).
 * The default implementation never returns PSP secrets — only opaque, single-intent tokens.
 */
interface GoatPaymentServerProxyClient {
    suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey?
    suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult
    suspend fun fetchClientToken(intentId: String): String
    suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome
    suspend fun cancelIntent(intentId: String): GoatPaymentOutcome
    suspend fun queryIntent(intentId: String): GoatPaymentOutcome
}

/**
 * Default HTTPS implementation of [GoatPaymentServerProxyClient], reusing the same
 * `HttpURLConnection` transport pattern as `GoatBridgeActionHandler.handleApiRequest`.
 */
class GoatDefaultPaymentServerProxyClient(
    private val baseUrl: String,
    private val timeoutMs: Int = 10_000
) : GoatPaymentServerProxyClient {

    private suspend fun request(
        method: String,
        path: String,
        body: JsonObject? = null
    ): JsonObject = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = timeoutMs
                readTimeout = timeoutMs
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
                if (body != null) {
                    doOutput = true
                    outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            val parsed = Json.parseToJsonElement(text).jsonObject
            if (code !in 200..299) {
                val errMsg = parsed["error"]?.jsonPrimitive?.content ?: "Payment proxy request failed ($code)"
                throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, errMsg, GoatPaymentSubCode.NETWORK_TIMEOUT)
            }
            parsed
        } finally {
            conn?.disconnect()
        }
    }

    override suspend fun fetchTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? {
        return try {
            val res = request("GET", "/tenant-keys/$tenantAppId")
            val key = res["publicKeyBase64"]?.jsonPrimitive?.content ?: return null
            val algo = res["algorithm"]?.jsonPrimitive?.content ?: "Ed25519"
            GoatTenantPublicKey(key, algo)
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun claimIntent(intentId: String, tenantAppId: String): GoatClaimResult {
        val res = request("POST", "/pay/intents/$intentId/claim", buildJsonObject { put("tenantAppId", tenantAppId) })
        val claimed = res["claimed"]?.jsonPrimitive?.content?.toBoolean() ?: false
        if (claimed) return GoatClaimResult(true)
        val prior = res["priorOutcome"]?.jsonObject ?: return GoatClaimResult(false)
        return GoatClaimResult(false, prior.toOutcome(intentId))
    }

    override suspend fun fetchClientToken(intentId: String): String {
        val res = request("GET", "/pay/intents/$intentId/client-token")
        return res["clientToken"]?.jsonPrimitive?.content
            ?: throw GoatPaymentException(GoatPaymentErrorCode.PAYMENT_FAILED, "Missing client token from proxy")
    }

    override suspend fun confirmIntent(intentId: String, outcome: GoatPaymentOutcome): GoatPaymentOutcome {
        val res = request(
            "POST",
            "/pay/intents/$intentId/confirm",
            buildJsonObject {
                put("status", outcome.status.name)
                outcome.transactionHandle?.let { put("transactionHandle", it) }
                outcome.providerRef?.let { put("providerRef", it) }
                outcome.failureSubCode?.let { put("failureSubCode", it) }
            }
        )
        return res.toOutcome(intentId)
    }

    override suspend fun cancelIntent(intentId: String): GoatPaymentOutcome {
        val res = request("POST", "/pay/intents/$intentId/cancel")
        return res.toOutcome(intentId)
    }

    override suspend fun queryIntent(intentId: String): GoatPaymentOutcome {
        val res = request("GET", "/pay/intents/$intentId")
        return res.toOutcome(intentId)
    }

    private fun JsonObject.toOutcome(fallbackIntentId: String): GoatPaymentOutcome {
        val status = GoatPaymentStatus.fromWire(this["status"]?.jsonPrimitive?.content) ?: GoatPaymentStatus.FAILED
        return GoatPaymentOutcome(
            status = status,
            intentId = this["intentId"]?.jsonPrimitive?.content ?: fallbackIntentId,
            transactionHandle = this["transactionHandle"]?.jsonPrimitive?.content,
            providerRef = this["providerRef"]?.jsonPrimitive?.content,
            failureSubCode = this["failureSubCode"]?.jsonPrimitive?.content
        )
    }
}
