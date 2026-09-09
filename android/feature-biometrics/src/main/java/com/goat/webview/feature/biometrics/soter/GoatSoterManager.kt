package com.goat.webview.feature.biometrics.soter

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap

/**
 * Tencent SOTER v2 biometric attestation.
 *
 * Two checks here are the whole point of SOTER over a plain biometric prompt, and both are done
 * on-device *before* the assertion is handed back, so a replayed `resultJSON` never reaches the
 * merchant server:
 *
 *  - `resultJSON.raw` must equal the challenge that was requested. A signature over someone
 *    else's challenge is a captured one.
 *  - `resultJSON.counter` must strictly exceed the highest counter seen for that scene. The TEE's
 *    counter only moves forward, so a repeat or a regression means replay.
 *
 * The server must repeat both checks — this is defence in depth, not a substitute. A device the
 * attacker controls can lie about anything it computes locally.
 */
class GoatSoterManager(
    private val tee: SoterTeeBridge,
    private val counterStore: SoterCounterStore = InMemorySoterCounterStore()
) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    suspend fun checkSupport(scene: String = DEFAULT_SCENE): SoterSupportReport {
        val supported = runCatching { tee.isNativeSupportSoter() }.getOrDefault(false)
        if (!supported) {
            return SoterSupportReport(
                supported = false, hasAskRegistered = false,
                hasAuthKeyRegistered = false, teeName = null
            )
        }
        return SoterSupportReport(
            supported = true,
            hasAskRegistered = runCatching { tee.hasAskRegistered() }.getOrDefault(false),
            hasAuthKeyRegistered = runCatching { tee.hasAuthKeyRegistered(scene) }.getOrDefault(false),
            teeName = runCatching { tee.teeName() }.getOrNull()
        )
    }

    /** Provisions the ASK (attested by the factory ATTK) and then the per-scene AuthKey. */
    suspend fun prepareKeys(scene: String = DEFAULT_SCENE): Boolean {
        requireSupport()
        if (!tee.hasAskRegistered() && !tee.generateAsk()) {
            throw SoterException(
                SoterBridgeError.INVALID_STATE, "ASK_GENERATION_FAILED",
                "The TEE refused to generate an App Secure Key"
            )
        }
        if (!tee.hasAuthKeyRegistered(scene) && !tee.generateAuthKey(scene)) {
            throw SoterException(
                SoterBridgeError.INVALID_STATE, "AUTH_KEY_NOT_FOUND",
                "The TEE refused to generate an AuthKey for scene '$scene'"
            )
        }
        return true
    }

    suspend fun authenticate(challenge: String, scene: String = DEFAULT_SCENE): JsonObject {
        requireSupport()
        if (challenge.isBlank()) {
            throw SoterException(
                SoterBridgeError.INVALID_STATE, "CHALLENGE_MISSING",
                "A server-issued challenge is required"
            )
        }
        if (!tee.hasAuthKeyRegistered(scene)) {
            throw SoterException(
                SoterBridgeError.INVALID_STATE, "AUTH_KEY_NOT_FOUND",
                "No AuthKey is enrolled in the TEE for scene '$scene'"
            )
        }

        val result = tee.authenticate(scene, challenge)
        verifyAssertion(result, challenge, scene)
        counterStore.record(scene, result.counter)

        return buildJsonObject {
            put("resultJSON", result.resultJson)
            put("resultJSONSignature", result.resultJsonSignature)
            put("counter", result.counter)
            put("scene", scene)
            result.fid?.let { put("fid", it) }
            result.teeName?.let { put("tee_n", it) }
            result.teeVersion?.let { put("tee_v", it) }
        }
    }

    /**
     * Rejects an assertion that does not answer *this* challenge, or whose hardware counter did
     * not advance. Either condition means the payload was captured from an earlier ceremony.
     */
    internal fun verifyAssertion(result: SoterAuthResult, challenge: String, scene: String) {
        val parsed = runCatching { json.parseToJsonElement(result.resultJson).jsonObject }.getOrNull()
            ?: throw SoterException(
                SoterBridgeError.AUTH_FAILED, "MALFORMED_RESULT_JSON",
                "The TEE returned a resultJSON that is not a JSON object"
            )

        val raw = parsed["raw"]?.jsonPrimitive?.content
        if (raw != challenge) {
            throw SoterException(
                SoterBridgeError.AUTH_FAILED, "CHALLENGE_MISMATCH",
                "resultJSON.raw does not match the requested challenge"
            )
        }

        val reportedCounter = parsed["counter"]?.jsonPrimitive?.content?.toLongOrNull()
        if (reportedCounter != null && reportedCounter != result.counter) {
            throw SoterException(
                SoterBridgeError.AUTH_FAILED, "COUNTER_MISMATCH",
                "resultJSON.counter disagrees with the reported counter"
            )
        }

        val lastSeen = counterStore.lastCounter(scene)
        if (lastSeen != null && result.counter <= lastSeen) {
            throw SoterException(
                SoterBridgeError.REPLAY_DETECTED, "COUNTER_REPLAY",
                "SOTER counter ${result.counter} did not advance past $lastSeen"
            )
        }

        if (result.resultJsonSignature.isBlank()) {
            throw SoterException(
                SoterBridgeError.AUTH_FAILED, "SIGNATURE_MISSING",
                "The TEE returned no signature over resultJSON"
            )
        }
    }

    private suspend fun requireSupport() {
        val supported = runCatching { tee.isNativeSupportSoter() }.getOrDefault(false)
        if (!supported) {
            throw SoterException(
                SoterBridgeError.NOT_SUPPORTED, "SOTER_NOT_SUPPORTED",
                "This device's TEE does not implement SOTER"
            )
        }
    }

    companion object {
        const val DEFAULT_SCENE = "payment"

        /** Maps a raw SOTER error code onto the normalized bridge code and sub-code. */
        fun mapError(code: Int): Pair<String, String> = when (code) {
            SoterErrorCode.NOT_SUPPORTED -> SoterBridgeError.NOT_SUPPORTED to "SOTER_NOT_SUPPORTED"
            SoterErrorCode.FINGERPRINT_LOCKED -> SoterBridgeError.BIOMETRIC_LOCKED to "TOO_MANY_ATTEMPTS"
            SoterErrorCode.BIOMETRIC_AUTH_FAILED -> SoterBridgeError.AUTH_FAILED to "BIOMETRIC_MISMATCH"
            SoterErrorCode.USER_CANCELLED -> SoterBridgeError.USER_CANCELLED to "USER_CANCELLED"
            SoterErrorCode.AUTHKEY_NOT_FOUND -> SoterBridgeError.INVALID_STATE to "AUTH_KEY_NOT_FOUND"
            SoterErrorCode.COUNTER_REPLAY -> SoterBridgeError.REPLAY_DETECTED to "COUNTER_REPLAY"
            SoterErrorCode.CHALLENGE_MISMATCH -> SoterBridgeError.AUTH_FAILED to "CHALLENGE_MISMATCH"
            else -> SoterBridgeError.AUTH_FAILED to "UNKNOWN"
        }
    }
}

interface SoterCounterStore {
    fun lastCounter(scene: String): Long?
    fun record(scene: String, counter: Long)
}

/**
 * Process-local high-water mark. Deliberately not persisted: a counter that survives a reinstall
 * would let a restored backup block a legitimate ceremony, and the authoritative replay check is
 * the merchant server's anyway.
 */
class InMemorySoterCounterStore : SoterCounterStore {
    private val counters = ConcurrentHashMap<String, Long>()
    override fun lastCounter(scene: String): Long? = counters[scene]
    override fun record(scene: String, counter: Long) {
        counters.compute(scene) { _, existing -> if (existing == null || counter > existing) counter else existing }
    }
}
