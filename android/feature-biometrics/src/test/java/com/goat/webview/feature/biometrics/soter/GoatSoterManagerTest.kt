package com.goat.webview.feature.biometrics.soter

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatSoterManagerTest {

    private class FakeTee(
        var supported: Boolean = true,
        var askRegistered: Boolean = true,
        var authKeyRegistered: Boolean = true,
        var counter: Long = 42L,
        var challengeEcho: String? = null,
        var signature: String = "sig_over_result_json",
        var reportedCounterOverride: Long? = null
    ) : SoterTeeBridge {
        var generateAskCalls = 0
        var generateAuthKeyCalls = 0
        var authenticateCalls = 0

        override suspend fun isNativeSupportSoter() = supported
        override suspend fun hasAskRegistered() = askRegistered
        override suspend fun generateAsk(): Boolean { generateAskCalls++; askRegistered = true; return true }
        override suspend fun hasAuthKeyRegistered(scene: String) = authKeyRegistered
        override suspend fun generateAuthKey(scene: String): Boolean {
            generateAuthKeyCalls++; authKeyRegistered = true; return true
        }
        override suspend fun teeName() = "QSEE"

        override suspend fun authenticate(scene: String, challenge: String): SoterAuthResult {
            authenticateCalls++
            val raw = challengeEcho ?: challenge
            val reported = reportedCounterOverride ?: counter
            return SoterAuthResult(
                resultJson = """{"raw":"$raw","fid":"0","counter":$reported,"tee_n":"QSEE","cpu_id":"84c8a2ef"}""",
                resultJsonSignature = signature,
                challenge = challenge,
                counter = counter,
                fid = "0", cpuId = "84c8a2ef", teeName = "QSEE", teeVersion = "5.0.0"
            )
        }
    }

    private fun manager(tee: FakeTee) = GoatSoterManager(tee)

    @Test
    fun `support is reported honestly on a device without SOTER`() = runTest {
        val report = manager(FakeTee(supported = false)).checkSupport()
        assertFalse(report.supported)
        assertFalse(report.hasAuthKeyRegistered)
        assertEquals(null, report.teeName)
    }

    @Test
    fun `an unsupported device is refused rather than given a fabricated assertion`() = runTest {
        val error = runCatching { manager(FakeTee(supported = false)).authenticate("chal_1") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertEquals(SoterBridgeError.NOT_SUPPORTED, (error as SoterException).code)
    }

    @Test
    fun `key provisioning generates ASK then AuthKey only when absent`() = runTest {
        val tee = FakeTee(askRegistered = false, authKeyRegistered = false)
        assertTrue(manager(tee).prepareKeys())
        assertEquals(1, tee.generateAskCalls)
        assertEquals(1, tee.generateAuthKeyCalls)

        val alreadyProvisioned = FakeTee()
        manager(alreadyProvisioned).prepareKeys()
        assertEquals(0, alreadyProvisioned.generateAskCalls)
        assertEquals(0, alreadyProvisioned.generateAuthKeyCalls)
    }

    @Test
    fun `a successful ceremony returns the signed resultJSON and its counter`() = runTest {
        val tee = FakeTee(counter = 42L)
        val result = manager(tee).authenticate("chal_1")
        assertEquals("42", result["counter"]?.jsonPrimitive?.content)
        assertEquals("sig_over_result_json", result["resultJSONSignature"]?.jsonPrimitive?.content)
        assertTrue(result["resultJSON"]!!.jsonPrimitive.content.contains("chal_1"))
    }

    // ---- The two checks that make SOTER worth using ----

    @Test
    fun `an assertion answering a different challenge is rejected`() = runTest {
        val tee = FakeTee(challengeEcho = "some_other_challenge")
        val error = runCatching { manager(tee).authenticate("chal_1") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertEquals(SoterBridgeError.AUTH_FAILED, (error as SoterException).code)
        assertTrue(error.message!!.contains("CHALLENGE_MISMATCH"))
    }

    @Test
    fun `a replayed counter is rejected`() = runTest {
        val tee = FakeTee(counter = 42L)
        val soter = manager(tee)
        soter.authenticate("chal_1")

        tee.counter = 42L
        val error = runCatching { soter.authenticate("chal_2") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertEquals(SoterBridgeError.REPLAY_DETECTED, (error as SoterException).code)
        assertTrue(error.message!!.contains("COUNTER_REPLAY"))
    }

    @Test
    fun `a counter that goes backwards is rejected`() = runTest {
        val tee = FakeTee(counter = 100L)
        val soter = manager(tee)
        soter.authenticate("chal_1")

        tee.counter = 99L
        val error = runCatching { soter.authenticate("chal_2") }.exceptionOrNull()
        assertEquals(SoterBridgeError.REPLAY_DETECTED, (error as SoterException).code)
    }

    @Test
    fun `an advancing counter is accepted`() = runTest {
        val tee = FakeTee(counter = 42L)
        val soter = manager(tee)
        soter.authenticate("chal_1")
        tee.counter = 43L
        val result = soter.authenticate("chal_2")
        assertEquals("43", result["counter"]?.jsonPrimitive?.content)
    }

    @Test
    fun `a resultJSON whose counter disagrees with the reported one is rejected`() = runTest {
        val tee = FakeTee(counter = 42L, reportedCounterOverride = 999L)
        val error = runCatching { manager(tee).authenticate("chal_1") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertTrue(error!!.message!!.contains("COUNTER_MISMATCH"))
    }

    @Test
    fun `an unsigned assertion is rejected`() = runTest {
        val tee = FakeTee(signature = "")
        val error = runCatching { manager(tee).authenticate("chal_1") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertTrue(error!!.message!!.contains("SIGNATURE_MISSING"))
    }

    @Test
    fun `a blank challenge is refused`() = runTest {
        val error = runCatching { manager(FakeTee()).authenticate("  ") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertEquals(SoterBridgeError.INVALID_STATE, (error as SoterException).code)
    }

    @Test
    fun `authentication without an enrolled AuthKey is refused`() = runTest {
        val tee = FakeTee(authKeyRegistered = false)
        val error = runCatching { manager(tee).authenticate("chal_1") }.exceptionOrNull()
        assertEquals(SoterBridgeError.INVALID_STATE, (error as SoterException).code)
        assertTrue(error.message!!.contains("AUTH_KEY_NOT_FOUND"))
        assertEquals("no ceremony may run without a key", 0, tee.authenticateCalls)
    }

    @Test
    fun `malformed resultJSON is rejected`() = runTest {
        val tee = object : SoterTeeBridge by FakeTee() {
            override suspend fun authenticate(scene: String, challenge: String) = SoterAuthResult(
                resultJson = "not json", resultJsonSignature = "sig", challenge = challenge,
                counter = 1, fid = null, cpuId = null, teeName = null, teeVersion = null
            )
        }
        val error = runCatching { GoatSoterManager(tee).authenticate("chal_1") }.exceptionOrNull()
        assertTrue(error is SoterException)
        assertTrue(error!!.message!!.contains("MALFORMED_RESULT_JSON"))
    }

    @Test
    fun `error codes map onto the normalized bridge codes`() {
        assertEquals(
            SoterBridgeError.NOT_SUPPORTED to "SOTER_NOT_SUPPORTED",
            GoatSoterManager.mapError(SoterErrorCode.NOT_SUPPORTED)
        )
        assertEquals(
            SoterBridgeError.BIOMETRIC_LOCKED to "TOO_MANY_ATTEMPTS",
            GoatSoterManager.mapError(SoterErrorCode.FINGERPRINT_LOCKED)
        )
        assertEquals(
            SoterBridgeError.AUTH_FAILED to "BIOMETRIC_MISMATCH",
            GoatSoterManager.mapError(SoterErrorCode.BIOMETRIC_AUTH_FAILED)
        )
        assertEquals(
            SoterBridgeError.USER_CANCELLED to "USER_CANCELLED",
            GoatSoterManager.mapError(SoterErrorCode.USER_CANCELLED)
        )
        assertEquals(
            SoterBridgeError.INVALID_STATE to "AUTH_KEY_NOT_FOUND",
            GoatSoterManager.mapError(SoterErrorCode.AUTHKEY_NOT_FOUND)
        )
    }

    @Test
    fun `counter store keeps the high-water mark per scene`() {
        val store = InMemorySoterCounterStore()
        store.record("payment", 10)
        store.record("payment", 5)
        assertEquals(10L, store.lastCounter("payment"))
        assertEquals(null, store.lastCounter("login"))
        store.record("login", 3)
        assertEquals(3L, store.lastCounter("login"))
    }
}
