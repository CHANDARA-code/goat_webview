package com.goat.webview.feature.biometrics.soter

object SoterErrorCode {
    const val OK = 0
    const val NOT_SUPPORTED = 1001
    const val FINGERPRINT_LOCKED = 1002
    const val BIOMETRIC_AUTH_FAILED = 1003
    const val USER_CANCELLED = 1004
    const val AUTHKEY_NOT_FOUND = 1005
    const val COUNTER_REPLAY = 1006
    const val CHALLENGE_MISMATCH = 1007
}

/** Bridge-level codes the mapping table in the spec normalises SOTER onto. */
object SoterBridgeError {
    const val NOT_SUPPORTED = "NOT_SUPPORTED"
    const val BIOMETRIC_LOCKED = "BIOMETRIC_LOCKED"
    const val AUTH_FAILED = "AUTH_FAILED"
    const val USER_CANCELLED = "USER_CANCELLED"
    const val INVALID_STATE = "INVALID_STATE"
    const val REPLAY_DETECTED = "REPLAY_DETECTED"
}

class SoterException(val code: String, val subCode: String, message: String) :
    Exception("$code: $message [$subCode]")

/**
 * The TEE's signed assertion. `raw` echoes the server challenge and `counter` is a hardware
 * monotonic value — together they are what make a captured `resultJSON` useless to replay.
 */
data class SoterAuthResult(
    val resultJson: String,
    val resultJsonSignature: String,
    val challenge: String,
    val counter: Long,
    val fid: String?,
    val cpuId: String?,
    val teeName: String?,
    val teeVersion: String?
)

data class SoterSupportReport(
    val supported: Boolean,
    val hasAskRegistered: Boolean,
    val hasAuthKeyRegistered: Boolean,
    val teeName: String?
)

/**
 * The device's SOTER TEE, behind an interface.
 *
 * Zero compile-time dependency on Tencent's SOTER library — the attestation chain
 * (ATTK -> ASK -> AuthKey) lives in vendor TEE code that only exists on Qualcomm/Samsung/MTK
 * devices that ship it. A host on such a device wires a real implementation; everywhere else
 * `isNativeSupportSoter()` returns false and callers get `NOT_SUPPORTED` rather than a fabricated
 * signature.
 */
interface SoterTeeBridge {
    suspend fun isNativeSupportSoter(): Boolean
    suspend fun hasAskRegistered(): Boolean
    suspend fun generateAsk(): Boolean
    suspend fun hasAuthKeyRegistered(scene: String): Boolean
    suspend fun generateAuthKey(scene: String): Boolean
    suspend fun teeName(): String?
    /** Runs the biometric ceremony and returns the TEE-signed assertion over [challenge]. */
    suspend fun authenticate(scene: String, challenge: String): SoterAuthResult
}
