package com.goat.webview.payments

import com.goat.webview.GoatSecureStorageManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap

/**
 * L4 local idempotency store + Zone 4 tenant public-key cache contract, abstracted so
 * [GoatPaymentGatewayManager] can be unit-tested without an Android `Context`.
 */
interface GoatPaymentIntentStoreApi {
    suspend fun getTerminalOutcome(intentId: String): GoatPaymentOutcome?
    suspend fun putTerminalOutcome(outcome: GoatPaymentOutcome)
    suspend fun getCachedTenantPublicKey(tenantAppId: String): GoatTenantPublicKey?
    suspend fun cacheTenantPublicKey(tenantAppId: String, key: GoatTenantPublicKey)
}

/**
 * L4 two-tier local idempotency store and Zone 4 tenant public-key cache (Task 10206 / §7 L4),
 * backed by [GoatSecureStorageManager]'s per-tenant AES-256-GCM encrypted partition.
 *
 * Terminal outcomes are additionally mirrored in a process-lifetime in-memory map so repeated
 * bridge calls within the same session resolve without a disk round-trip.
 */
class GoatPaymentIntentStore(
    private val secureStorageManager: GoatSecureStorageManager,
    private val appId: String
) : GoatPaymentIntentStoreApi {
    private val memoryOutcomes = ConcurrentHashMap<String, GoatPaymentOutcome>()

    private fun outcomeKey(intentId: String) = "payment_outcome_$intentId"
    private fun tenantKeyCacheKey(tenantAppId: String) = "payment_tenant_key_$tenantAppId"

    override suspend fun getTerminalOutcome(intentId: String): GoatPaymentOutcome? {
        memoryOutcomes[intentId]?.let { return it }
        val raw = secureStorageManager.getSecureValue(appId, outcomeKey(intentId)) ?: return null
        return try {
            val json = Json.parseToJsonElement(raw).jsonObject
            json.toStoredOutcome(intentId).also { memoryOutcomes[intentId] = it }
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun putTerminalOutcome(outcome: GoatPaymentOutcome) {
        if (!outcome.status.isTerminal) return
        memoryOutcomes[outcome.intentId] = outcome
        val json = buildJsonObject {
            put("status", outcome.status.name)
            put("intentId", outcome.intentId)
            outcome.transactionHandle?.let { put("transactionHandle", it) }
            outcome.providerRef?.let { put("providerRef", it) }
            outcome.failureSubCode?.let { put("failureSubCode", it) }
        }
        secureStorageManager.setSecureValue(appId, outcomeKey(outcome.intentId), json.toString())
    }

    override suspend fun getCachedTenantPublicKey(tenantAppId: String): GoatTenantPublicKey? {
        val raw = secureStorageManager.getSecureValue(appId, tenantKeyCacheKey(tenantAppId)) ?: return null
        return try {
            val json = Json.parseToJsonElement(raw).jsonObject
            val key = json["keyBase64"]?.jsonPrimitive?.content ?: return null
            val algo = json["algorithm"]?.jsonPrimitive?.content ?: "Ed25519"
            GoatTenantPublicKey(key, algo)
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun cacheTenantPublicKey(tenantAppId: String, key: GoatTenantPublicKey) {
        val json = buildJsonObject {
            put("keyBase64", key.keyBase64)
            put("algorithm", key.algorithm)
        }
        secureStorageManager.setSecureValue(appId, tenantKeyCacheKey(tenantAppId), json.toString())
    }

    private fun JsonObject.toStoredOutcome(fallbackIntentId: String): GoatPaymentOutcome {
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
