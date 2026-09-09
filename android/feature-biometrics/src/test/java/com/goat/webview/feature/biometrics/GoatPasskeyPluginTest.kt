package com.goat.webview.feature.biometrics

import android.content.Context
import android.content.ContextWrapper
import com.goat.webview.feature.biometrics.passkey.CredentialManagerEngine
import com.goat.webview.feature.biometrics.passkey.PasskeyErrorCode
import com.goat.webview.feature.biometrics.passkey.PasskeyException
import com.goat.webview.feature.biometrics.passkey.RpIdValidator
import com.goat.webview.feature.biometrics.vault.GoatVaultEngine
import com.goat.webview.feature.biometrics.vault.VaultKeyStoreSecretSource
import com.goat.webview.manifest.MiniAppManifest
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class GoatPasskeyPluginTest {

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    /** Deterministic stand-in for the AndroidKeyStore HMAC secret, which needs a device. */
    private class FakeSecretSource(private val seed: String = "device") : VaultKeyStoreSecretSource {
        override val isHardwareBacked = false
        override fun deviceSecret(appId: String, vaultId: String): ByteArray =
            MessageDigest.getInstance("SHA-256").digest("$seed:$appId:$vaultId".toByteArray())
    }

    private class FailingSecretSource : VaultKeyStoreSecretSource {
        override val isHardwareBacked = true
        override fun deviceSecret(appId: String, vaultId: String): ByteArray =
            throw PasskeyException(PasskeyErrorCode.VAULT_UNAVAILABLE, "KeyStore unavailable")
    }

    private class FakeEngine(
        var registerJson: String = REGISTRATION_JSON,
        var assertJson: String = ASSERTION_JSON,
        var failWith: PasskeyException? = null
    ) : CredentialManagerEngine {
        var lastRegisterOptions: String? = null
        var lastAssertOptions: String? = null

        override suspend fun register(optionsJson: String): String {
            failWith?.let { throw it }
            lastRegisterOptions = optionsJson
            return registerJson
        }

        override suspend fun assert(optionsJson: String): String {
            failWith?.let { throw it }
            lastAssertOptions = optionsJson
            return assertJson
        }
    }

    companion object {
        const val PRF_MASTER_KEY = "TUFTVEVSS0VZX0RPX05PVF9MRUFL"

        val REGISTRATION_JSON = """
            {"id":"cred-1","rawId":"cred-1","type":"public-key",
             "response":{"clientDataJSON":"Y2Q","attestationObject":"YW8","publicKey":"cGs"},
             "clientExtensionResults":{"credProps":{"rk":true},"prf":{"enabled":true,"results":{"first":"$PRF_MASTER_KEY"}}}}
        """.trimIndent()

        val ASSERTION_JSON = """
            {"id":"cred-1","rawId":"cred-1","type":"public-key",
             "response":{"clientDataJSON":"Y2Q","authenticatorData":"YWQ","signature":"c2ln"},
             "clientExtensionResults":{"prf":{"results":{"first":"$PRF_MASTER_KEY"}}}}
        """.trimIndent()
    }

    private fun manifestFor(vararg rpIds: String) = MiniAppManifest(
        appId = "com.merchant.shop",
        version = "1.0.0",
        allowedRpIds = rpIds.toList()
    )

    private fun plugin(
        engine: CredentialManagerEngine = FakeEngine(),
        manifest: MiniAppManifest? = manifestFor("shop.superapp.com"),
        appId: String = "com.merchant.shop",
        secretSource: VaultKeyStoreSecretSource = FakeSecretSource()
    ) = GoatPasskeyPlugin(
        context = FakeTestContext(),
        appIdProvider = { appId },
        engine = engine,
        rpIdValidator = RpIdValidator { if (it == manifest?.appId) manifest else null },
        vaultEngine = GoatVaultEngine(secretSource)
    )

    @Test
    fun testPluginIdentityAndActionSurface() {
        val p = plugin()
        assertEquals("passkey", p.pluginId)
        listOf(
            "PASSKEY_CHECK_SUPPORT", "CHECK_PASSKEY_SUPPORT", "PASSKEY_REGISTER", "REGISTER_CREDENTIAL",
            "PASSKEY_ASSERT", "ASSERT_CREDENTIAL", "VAULT_ENCRYPT", "VAULT_DECRYPT"
        ).forEach { assertTrue("$it not handled", p.canHandle(it)) }
        assertFalse(p.canHandle("BIOMETRIC_AUTH"))
    }

    @Test
    fun testCheckSupportReportsCapabilityShape() = runTest {
        val res = plugin().execute("PASSKEY_CHECK_SUPPORT", buildJsonObject { })
        assertTrue(res.isSuccess)
        val data = res.getOrNull()!!
        listOf("supported", "platformAuthenticator", "prfSupported", "biometryType", "vaultMode")
            .forEach { assertNotNull("$it missing from support report", data[it]) }
        assertEquals("false", data["conditionalMediation"]?.jsonPrimitive?.content)
    }

    // ---- Vector 5: the PRF master key must never leave native memory ----

    @Test
    fun testRegisterScrubsPrfFromClientExtensionResults() = runTest {
        val res = plugin().execute("PASSKEY_REGISTER", buildJsonObject {
            put("optionsJson", """{"rp":{"id":"shop.superapp.com"}}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.exceptionOrNull()?.message ?: "", res.isSuccess)

        val serialized = res.getOrNull().toString()
        assertFalse("PRF master key leaked to the WebView", serialized.contains(PRF_MASTER_KEY))
        assertFalse("prf key survived sanitization", serialized.contains("\"prf\""))
        assertTrue("unrelated extensions must survive", serialized.contains("credProps"))
    }

    @Test
    fun testAssertScrubsPrfFromClientExtensionResults() = runTest {
        val res = plugin().execute("PASSKEY_ASSERT", buildJsonObject {
            put("optionsJson", """{"rpId":"shop.superapp.com"}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.isSuccess)
        val serialized = res.getOrNull().toString()
        assertFalse("PRF master key leaked to the WebView", serialized.contains(PRF_MASTER_KEY))
        assertFalse(serialized.contains("\"prf\""))
    }

    @Test
    fun testSanitizeStripsEveryPrfAliasButKeepsOtherFields() {
        val raw = Json.parseToJsonElement(
            """{"id":"x","clientExtensionResults":{"prf":{"a":1},"hmacGetSecret":{"b":2},"credProps":{"rk":true},"appid":true}}"""
        ).jsonObject
        val out = plugin().sanitize(raw)
        val ext = out["clientExtensionResults"]!!.jsonObject
        assertFalse(ext.containsKey("prf"))
        assertFalse(ext.containsKey("hmacGetSecret"))
        assertTrue(ext.containsKey("credProps"))
        assertTrue(ext.containsKey("appid"))
        assertEquals("x", out["id"]?.jsonPrimitive?.content)
    }

    // ---- RP ID gate ----

    @Test
    fun testRejectsRpIdNotDeclaredInManifest() = runTest {
        val res = plugin().execute("PASSKEY_ASSERT", buildJsonObject {
            put("optionsJson", """{"rpId":"evil.com"}""")
            put("rpId", "evil.com")
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.RP_ID_NOT_ALLOWED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testRejectsWhenManifestIsUnknown() = runTest {
        val res = plugin(manifest = null).execute("PASSKEY_REGISTER", buildJsonObject {
            put("optionsJson", """{"rp":{"id":"shop.superapp.com"}}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.RP_ID_NOT_ALLOWED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testRejectsWhenManifestDeclaresNoRpIds() = runTest {
        val res = plugin(manifest = manifestFor()).execute("PASSKEY_REGISTER", buildJsonObject {
            put("optionsJson", """{"rp":{"id":"shop.superapp.com"}}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.RP_ID_NOT_ALLOWED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testPayloadAppIdCannotOverrideTheContainerTenant() = runTest {
        // A malicious payload naming another tenant must not borrow that tenant's allowedRpIds.
        val res = plugin(appId = "com.attacker.app", manifest = manifestFor("shop.superapp.com"))
            .execute("PASSKEY_ASSERT", buildJsonObject {
                put("appId", "com.merchant.shop")
                put("optionsJson", """{"rpId":"shop.superapp.com"}""")
                put("rpId", "shop.superapp.com")
            })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.RP_ID_NOT_ALLOWED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testAcceptsRegistrableSubdomainSuffix() = runTest {
        val res = plugin(manifest = manifestFor("superapp.com")).execute("PASSKEY_ASSERT", buildJsonObject {
            put("optionsJson", """{"rpId":"login.superapp.com"}""")
            put("rpId", "login.superapp.com")
        })
        assertTrue(res.exceptionOrNull()?.message ?: "", res.isSuccess)
    }

    @Test
    fun testRejectsLookalikeDomainThatMerelySharesASuffixString() {
        val validator = RpIdValidator { manifestFor("shop.com") }
        assertFalse(validator.isRegistrableSuffix("evilshop.com", "shop.com"))
        assertTrue(validator.isRegistrableSuffix("login.shop.com", "shop.com"))
        assertFalse("a bare TLD must never be a registrable suffix", validator.isRegistrableSuffix("evil.com", "com"))
    }

    @Test
    fun testUserCancellationMapsToUserCancelled() = runTest {
        val engine = FakeEngine(failWith = PasskeyException(PasskeyErrorCode.USER_CANCELLED, "dismissed"))
        val res = plugin(engine = engine).execute("PASSKEY_ASSERT", buildJsonObject {
            put("optionsJson", """{"rpId":"shop.superapp.com"}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.USER_CANCELLED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testMissingOptionsJsonIsRejected() = runTest {
        val res = plugin().execute("PASSKEY_REGISTER", buildJsonObject { put("rpId", "shop.superapp.com") })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.INVALID_PARAMETERS, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testMalformedAuthenticatorJsonIsRejected() = runTest {
        val res = plugin(engine = FakeEngine(assertJson = "not json")).execute("PASSKEY_ASSERT", buildJsonObject {
            put("optionsJson", """{"rpId":"shop.superapp.com"}""")
            put("rpId", "shop.superapp.com")
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.INTERNAL_ERROR, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val res = plugin().execute("NOT_A_PASSKEY_ACTION", buildJsonObject { })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }

    // ---- Vault: real AES-256-GCM ----

    @Test
    fun testVaultRoundTripsThroughRealAesGcm() = runTest {
        val p = plugin()
        val enc = p.execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes")
            put("plaintext", "the launch codes")
        })
        assertTrue(enc.exceptionOrNull()?.message ?: "", enc.isSuccess)
        val envelope = enc.getOrNull()!!

        assertEquals("1", envelope["version"]?.jsonPrimitive?.content)
        assertEquals("hardware_keystore", envelope["vaultMode"]?.jsonPrimitive?.content)
        assertFalse(
            "plaintext must not be recoverable from the envelope",
            envelope.toString().contains("the launch codes")
        )

        val dec = p.execute("VAULT_DECRYPT", buildJsonObject {
            put("vaultId", "notes")
            put("envelope", envelope)
        })
        assertTrue(dec.exceptionOrNull()?.message ?: "", dec.isSuccess)
        assertEquals("the launch codes", dec.getOrNull()!!["plaintext"]?.jsonPrimitive?.content)
    }

    @Test
    fun testVaultProducesAFreshIvAndSaltEveryTime() = runTest {
        val p = plugin()
        val a = p.execute("VAULT_ENCRYPT", buildJsonObject { put("vaultId", "v"); put("plaintext", "same") })
            .getOrNull()!!
        val b = p.execute("VAULT_ENCRYPT", buildJsonObject { put("vaultId", "v"); put("plaintext", "same") })
            .getOrNull()!!
        assertFalse("IV reuse under AES-GCM is catastrophic", a["iv"] == b["iv"])
        assertFalse(a["salt"] == b["salt"])
        assertFalse(a["ciphertext"] == b["ciphertext"])
    }

    @Test
    fun testVaultRejectsATamperedCiphertext() = runTest {
        val p = plugin()
        val envelope = p.execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes"); put("plaintext", "secret")
        }).getOrNull()!!

        val tampered = buildJsonObject {
            envelope.forEach { (k, v) -> put(k, v) }
            put("ciphertext", "AAAA" + envelope["ciphertext"]!!.jsonPrimitive.content.drop(4))
        }
        val res = p.execute("VAULT_DECRYPT", buildJsonObject {
            put("vaultId", "notes"); put("envelope", tampered)
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testVaultOfOneTenantCannotBeOpenedByAnother() = runTest {
        val victim = plugin(appId = "com.merchant.shop")
        val envelope = victim.execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes"); put("plaintext", "tenant secret")
        }).getOrNull()!!

        val attacker = plugin(appId = "com.attacker.app", manifest = manifestFor("shop.superapp.com"))
        val res = attacker.execute("VAULT_DECRYPT", buildJsonObject {
            put("vaultId", "notes"); put("envelope", envelope)
        })
        assertTrue("another tenant must not decrypt this envelope", res.isFailure)
        assertEquals(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testVaultRejectsAnEnvelopeFromADifferentVaultId() = runTest {
        val p = plugin()
        val envelope = p.execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes"); put("plaintext", "x")
        }).getOrNull()!!
        val res = p.execute("VAULT_DECRYPT", buildJsonObject {
            put("vaultId", "other"); put("envelope", envelope)
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testVaultFailsClosedWhenTheKeyStoreIsUnavailable() = runTest {
        val res = plugin(secretSource = FailingSecretSource()).execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes"); put("plaintext", "secret")
        })
        assertTrue("a KeyStore failure must not downgrade to a software key", res.isFailure)
        assertEquals(PasskeyErrorCode.VAULT_UNAVAILABLE, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testVaultRejectsAnEnvelopeSealedUnderPrfWhenNoEvaluatorIsRegistered() = runTest {
        val p = plugin()
        val envelope = p.execute("VAULT_ENCRYPT", buildJsonObject {
            put("vaultId", "notes"); put("plaintext", "x")
        }).getOrNull()!!
        val claimsPrf = buildJsonObject {
            envelope.forEach { (k, v) -> put(k, v) }
            put("vaultMode", "webauthn_prf")
        }
        val res = p.execute("VAULT_DECRYPT", buildJsonObject {
            put("vaultId", "notes"); put("envelope", claimsPrf)
        })
        assertTrue(res.isFailure)
        assertEquals(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, (res.exceptionOrNull() as PasskeyException).code)
    }

    @Test
    fun testVaultRejectsMissingArguments() = runTest {
        val p = plugin()
        assertEquals(
            PasskeyErrorCode.INVALID_PARAMETERS,
            (p.execute("VAULT_ENCRYPT", buildJsonObject { put("vaultId", "v") })
                .exceptionOrNull() as PasskeyException).code
        )
        assertEquals(
            PasskeyErrorCode.INVALID_PARAMETERS,
            (p.execute("VAULT_DECRYPT", buildJsonObject { put("vaultId", "v") })
                .exceptionOrNull() as PasskeyException).code
        )
    }
}
