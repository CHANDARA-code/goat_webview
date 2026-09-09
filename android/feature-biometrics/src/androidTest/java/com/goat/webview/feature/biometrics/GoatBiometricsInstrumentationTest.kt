package com.goat.webview.feature.biometrics

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Task 10187's claim was that "biometrics and location modules invoke real Android APIs and return
 * real device data in an instrumented test". This file previously asserted `assertTrue(true)` — it
 * ran on a device and verified nothing, which is the vacuous-gate pattern this repo has been
 * caught by more than once. These assertions actually read the platform.
 *
 * Deliberately does NOT attempt a biometric ceremony: that needs an enrolled fingerprint/face and
 * a human, so it cannot run unattended.
 *
 * **How much this actually guards, measured not assumed.** Replacing the plugin's
 * `BiometricManager` call with a hardcoded `BIOMETRIC_SUCCESS` was tried on an SM-N975F and these
 * tests still passed — because that device *has* enrolled biometrics, so the fake answer and the
 * true answer coincide. The cross-check therefore catches a wrong mapping or a hardcoded `false`,
 * and catches a hardcoded `true` only on a device whose real answer differs (no hardware, or
 * hardware with nothing enrolled). Run it on such a device to get the stronger guarantee. This is
 * still strictly more than the `assertTrue(true)` it replaced, but it is not mutation-proof and
 * should not be described as if it were.
 */
@RunWith(AndroidJUnit4::class)
class GoatBiometricsInstrumentationTest {

    private val context: Context get() = ApplicationProvider.getApplicationContext()

    @Test
    fun checkSupportReportsWhatThePlatformActuallySays() = runBlocking {
        val plugin = GoatBiometricsPlugin(context)
        val result = plugin.execute("CHECK_BIOMETRIC_SUPPORT", buildJsonObject { })
        assertTrue("CHECK_BIOMETRIC_SUPPORT must succeed on a device", result.isSuccess)

        val data = result.getOrThrow()
        val reported = data["supported"]?.jsonPrimitive?.content?.toBoolean()
        assertNotNull("a support verdict must be returned", reported)

        // Cross-check against the platform directly: the plugin must not invent an answer.
        val platformStatus = BiometricManager.from(context).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.BIOMETRIC_WEAK
        )
        val platformSaysAvailable = platformStatus == BiometricManager.BIOMETRIC_SUCCESS
        assertEquals(
            "plugin verdict must match BiometricManager, not a hardcoded default",
            platformSaysAvailable,
            reported
        )
    }

    @Test
    fun passkeySupportIsDerivedFromRealDeviceCapability() {
        val plugin = GoatPasskeyPlugin(context)
        val report = plugin.checkSupport()

        // On any device this suite can run on, the capability probe must complete and agree with
        // itself: PRF requires a platform authenticator, and a vault mode requires hardware.
        if (report.prfSupported) {
            assertTrue("PRF cannot be supported without a platform authenticator", report.platformAuthenticator)
        }
        if (report.supported) {
            assertTrue("support implies a platform authenticator", report.platformAuthenticator)
            assertTrue("support implies enrolled biometrics", report.hasEnrolledBiometrics)
        }
        assertEquals(
            "a WebView has no conditional-UI surface, on any device",
            false,
            report.conditionalMediation
        )
        assertTrue(
            "vaultMode must be a known value, got '${report.vaultMode}'",
            report.vaultMode in setOf("webauthn_prf", "hardware_keystore", "none")
        )
    }

    @Test
    fun anUnsupportedActionIsRejectedOnDeviceToo() = runBlocking {
        val result = GoatBiometricsPlugin(context).execute("NOT_A_REAL_ACTION", buildJsonObject { })
        assertTrue("an unknown action must fail closed on a device", result.isFailure)
    }
}
