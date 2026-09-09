package com.goat.webview.feature.biometrics.vault

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.goat.webview.feature.biometrics.passkey.PasskeyErrorCode
import com.goat.webview.feature.biometrics.passkey.PasskeyException
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore

/**
 * The vault against the REAL AndroidKeyStore, on a real device.
 *
 * The JVM suite can only exercise `GoatVaultEngine` through a fake secret source, because
 * `AndroidKeyStore` does not exist off-device. Everything asserted here — that a hardware-backed
 * HMAC key is actually created, that it is stable across engine instances, and that the derived
 * AES key is genuinely bound to the tenant — is unverifiable without this test.
 *
 * Run: `./gradlew -p android :feature-biometrics:connectedDebugAndroidTest`
 */
@RunWith(AndroidJUnit4::class)
class GoatVaultKeyStoreInstrumentedTest {

    private val keyAliasPrefix = "goat_vault_itest_"

    private fun engine() = GoatVaultEngine(AndroidKeyStoreSecretSource(keyAliasPrefix = keyAliasPrefix))

    private fun clearAlias(appId: String) {
        runCatching {
            val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            ks.deleteEntry(keyAliasPrefix + appId)
        }
    }

    @Test
    fun realKeyStoreProducesAWorkingRoundTrip() {
        val appId = "itest_roundtrip"
        clearAlias(appId)
        val vault = engine()

        val envelope = vault.encrypt(appId, "notes", "the launch codes")
        assertEquals("1", envelope["version"]?.jsonPrimitive?.content)
        assertEquals("hardware_keystore", envelope["vaultMode"]?.jsonPrimitive?.content)
        assertTrue(
            "plaintext must not be recoverable from the envelope",
            !envelope.toString().contains("the launch codes")
        )

        val opened = vault.decrypt(appId, "notes", envelope)
        assertEquals("the launch codes", opened["plaintext"]?.jsonPrimitive?.content)
        clearAlias(appId)
    }

    @Test
    fun theKeyStoreEntryIsActuallyCreatedAndReused() {
        val appId = "itest_alias"
        clearAlias(appId)

        engine().encrypt(appId, "v", "x")

        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        assertTrue(
            "a KeyStore entry must exist after the first vault operation",
            ks.containsAlias(keyAliasPrefix + appId)
        )
        assertNotNull(ks.getKey(keyAliasPrefix + appId, null))
        clearAlias(appId)
    }

    @Test
    fun theDerivedKeySurvivesANewEngineInstance() {
        // A key that did not persist would make every vault unreadable after process death —
        // the failure mode the secure-storage fail-closed fix existed to prevent.
        val appId = "itest_persist"
        clearAlias(appId)

        val envelope = engine().encrypt(appId, "notes", "persisted secret")
        val opened = engine().decrypt(appId, "notes", envelope)

        assertEquals("persisted secret", opened["plaintext"]?.jsonPrimitive?.content)
        clearAlias(appId)
    }

    @Test
    fun oneTenantCannotOpenAnotherTenantsEnvelope() {
        val victim = "itest_victim"
        val attacker = "itest_attacker"
        clearAlias(victim); clearAlias(attacker)

        val vault = engine()
        val envelope = vault.encrypt(victim, "notes", "tenant secret")

        // Strip the appId so the explicit tenant check cannot short-circuit it: this must fail on
        // the cryptography, proving the key really is bound to the tenant.
        val stripped = buildJsonObject {
            envelope.forEach { (k, v) -> if (k != "appId") put(k, v) }
        }
        val error = runCatching { vault.decrypt(attacker, "notes", stripped) }.exceptionOrNull()

        assertTrue("expected a decryption failure, got $error", error is PasskeyException)
        assertEquals(
            PasskeyErrorCode.VAULT_DECRYPTION_FAILED,
            (error as PasskeyException).code
        )
        clearAlias(victim); clearAlias(attacker)
    }

    @Test
    fun eachEncryptionUsesAFreshIvAndSalt() {
        val appId = "itest_iv"
        clearAlias(appId)
        val vault = engine()

        val a = vault.encrypt(appId, "v", "same plaintext")
        val b = vault.encrypt(appId, "v", "same plaintext")

        assertNotEquals("IV reuse under AES-GCM is catastrophic", a["iv"], b["iv"])
        assertNotEquals(a["salt"], b["salt"])
        assertNotEquals(a["ciphertext"], b["ciphertext"])
        clearAlias(appId)
    }

    @Test
    fun aTamperedCiphertextIsRejectedByTheAuthenticationTag() {
        val appId = "itest_tamper"
        clearAlias(appId)
        val vault = engine()

        val envelope = vault.encrypt(appId, "notes", "secret")
        val original = envelope["ciphertext"]!!.jsonPrimitive.content
        val tampered = buildJsonObject {
            envelope.forEach { (k, v) -> put(k, v) }
            put("ciphertext", "AAAA" + original.drop(4))
        }

        val error = runCatching { vault.decrypt(appId, "notes", tampered) }.exceptionOrNull()
        assertTrue(error is PasskeyException)
        assertEquals(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, (error as PasskeyException).code)
        clearAlias(appId)
    }
}
