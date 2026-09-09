package com.goat.webview.feature.wallet.passes

import android.content.Context
import android.content.ContextWrapper
import com.goat.webview.feature.wallet.passes.generic.EncryptedPassVault
import com.goat.webview.feature.wallet.passes.generic.GenericPassStore
import com.goat.webview.feature.wallet.passes.google.GoogleWalletPassAdapter
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletJwtValidator
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletLauncher
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletSaveOutcome
import com.goat.webview.feature.wallet.passes.spi.PassBarcode
import com.goat.webview.feature.wallet.passes.spi.PassErrorCode
import com.goat.webview.feature.wallet.passes.spi.PassException
import com.goat.webview.feature.wallet.passes.spi.PassMetadata
import com.goat.webview.feature.wallet.passes.spi.PassProvider
import com.goat.webview.feature.wallet.passes.spi.PassState
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap

class GoatPassesPluginTest {

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    /** Stands in for the hardware vault; tenancy is what these tests care about. */
    private class InMemoryVault : EncryptedPassVault {
        private val store = ConcurrentHashMap<String, String>()
        private fun key(appId: String, passId: String) = "$appId::$passId"
        override fun put(appId: String, passId: String, plaintext: String) {
            store[key(appId, passId)] = plaintext
        }
        override fun get(appId: String, passId: String): String? = store[key(appId, passId)]
        override fun remove(appId: String, passId: String): Boolean = store.remove(key(appId, passId)) != null
        override fun listIds(appId: String): List<String> =
            store.keys.filter { it.startsWith("$appId::") }.map { it.removePrefix("$appId::") }.sorted()
    }

    private class FakeGoogleLauncher(
        var available: Boolean = true,
        var outcome: GoogleWalletSaveOutcome = GoogleWalletSaveOutcome.SAVED
    ) : GoogleWalletLauncher {
        var saveCalls = 0
        var lastJwt: String? = null
        override suspend fun isGoogleWalletAvailable() = available
        override suspend fun savePassesJwt(jwt: String): GoogleWalletSaveOutcome {
            saveCalls++
            lastJwt = jwt
            return outcome
        }
        override suspend fun openWallet(passId: String) = available
    }

    private companion object {
        // header.payload.signature, all Base64URL. Payload decodes to {"iss":"goat@example.com"}.
        const val VALID_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJnb2F0QGV4YW1wbGUuY29tIn0.c2lnbmF0dXJl"
    }

    private fun plugin(
        launcher: FakeGoogleLauncher = FakeGoogleLauncher(),
        vault: InMemoryVault? = InMemoryVault(),
        appId: String = "tenant-a"
    ) = GoatPassesPlugin(
        context = FakeTestContext(),
        adapters = listOf(GoogleWalletPassAdapter(launcher)),
        genericStore = vault?.let { GenericPassStore(it) },
        appIdProvider = { appId }
    )

    private fun metadataJson() = buildJsonObject {
        put("passTypeIdentifier", "pass.com.example.loyalty")
        put("serialNumber", "SN-1")
        put("description", "Coffee card")
    }

    // ---- Surface ----

    @Test
    fun testPluginIdentityAndActionSurface() {
        val p = plugin()
        assertEquals("wallet_passes", p.pluginId)
        assertEquals(5, p.supportedActions.size)
        listOf(
            "WALLET_SAVE_PASS", "WALLET_GET_PASS_STATE", "WALLET_OPEN_PASS",
            "WALLET_LIST_PASSES", "WALLET_DELETE_PASS"
        ).forEach { assertTrue("$it not handled", p.canHandle(it)) }
        assertFalse(p.canHandle("REQUEST_PAYMENT"))
    }

    @Test
    fun testDefaultsToAGoogleWalletAdapter() {
        val p = GoatPassesPlugin(FakeTestContext())
        assertEquals(setOf(PassProvider.GOOGLE_WALLET), p.registeredProviders())
    }

    // ---- JWT validation (PASS-G-06) ----

    @Test
    fun testValidJwtStructureIsAccepted() {
        GoogleWalletJwtValidator.validate(VALID_JWT)
        assertTrue(GoogleWalletJwtValidator.isValid(VALID_JWT))
        assertEquals("""{"iss":"goat@example.com"}""", GoogleWalletJwtValidator.decodePayload(VALID_JWT))
    }

    @Test
    fun testMalformedJwtIsRejectedBeforeReachingThePlatform() {
        val launcher = FakeGoogleLauncher()
        val p = plugin(launcher)

        val malformed = listOf(
            "" to "empty",
            "onlyonepart" to "one segment",
            "two.parts" to "two segments",
            "a.b.c.d" to "four segments",
            "..".let { "a..c" } to "empty middle segment",
            "a.b+c.d" to "non-Base64URL character"
        )
        for ((jwt, why) in malformed) {
            val res = runCatchingSave(p, jwt)
            assertTrue("$why should be rejected", res is PassException)
        }
        assertEquals("no malformed JWT may reach the platform SDK", 0, launcher.saveCalls)
    }

    private fun runCatchingSave(p: GoatPassesPlugin, jwt: String): Throwable? = kotlinx.coroutines.runBlocking {
        p.execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET")
            put("payload", jwt)
        }).exceptionOrNull()
    }

    // ---- Google Wallet save ----

    @Test
    fun testSavingAPassReportsAddedAndForwardsTheJwt() = runTest {
        val launcher = FakeGoogleLauncher()
        val res = plugin(launcher).execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET")
            put("payload", VALID_JWT)
            put("metadata", metadataJson())
        })
        assertTrue(res.exceptionOrNull()?.message ?: "", res.isSuccess)
        val data = res.getOrThrow()
        assertEquals("ADDED", data["state"]?.jsonPrimitive?.content)
        assertEquals("false", data["alreadyAdded"]?.jsonPrimitive?.content)
        assertEquals("pass.com.example.loyalty:SN-1", data["passId"]?.jsonPrimitive?.content)
        assertEquals(VALID_JWT, launcher.lastJwt)
    }

    @Test
    fun testAnAlreadyAddedPassIsReportedAsSuchNotAsAnError() = runTest {
        val launcher = FakeGoogleLauncher(outcome = GoogleWalletSaveOutcome.ALREADY_ADDED)
        val data = plugin(launcher).execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET")
            put("payload", VALID_JWT)
            put("metadata", metadataJson())
        }).getOrThrow()
        assertEquals("ADDED", data["state"]?.jsonPrimitive?.content)
        assertEquals("true", data["alreadyAdded"]?.jsonPrimitive?.content)
    }

    @Test
    fun testUserCancellationMapsToUserCancelled() = runTest {
        val launcher = FakeGoogleLauncher(outcome = GoogleWalletSaveOutcome.CANCELLED)
        val res = plugin(launcher).execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET"); put("payload", VALID_JWT)
        })
        assertEquals(PassErrorCode.USER_CANCELLED, (res.exceptionOrNull() as PassException).code)
    }

    @Test
    fun testAnUnavailableWalletIsRefusedBeforeSaving() = runTest {
        val launcher = FakeGoogleLauncher(available = false)
        val res = plugin(launcher).execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET"); put("payload", VALID_JWT)
        })
        assertEquals(
            PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
            (res.exceptionOrNull() as PassException).code
        )
        assertEquals(0, launcher.saveCalls)
    }

    @Test
    fun testAnUnlinkedHostFailsClosedRatherThanPretendingToSave() = runTest {
        val p = GoatPassesPlugin(FakeTestContext())
        val res = p.execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET"); put("payload", VALID_JWT)
        })
        assertTrue(res.isFailure)
        assertEquals(
            PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
            (res.exceptionOrNull() as PassException).code
        )
    }

    // ---- Pass state ----

    @Test
    fun testUnobservedGoogleStateIsUnknownNotNotAdded() = runTest {
        // Google exposes no "does the user hold this pass" query. Reporting NOT_ADDED would have a
        // caller issue a duplicate pass.
        val data = plugin().execute("WALLET_GET_PASS_STATE", buildJsonObject {
            put("provider", "GOOGLE_WALLET")
            put("passId", "pass.com.example.loyalty:SN-999")
        }).getOrThrow()
        assertEquals("UNKNOWN", data["state"]?.jsonPrimitive?.content)
    }

    @Test
    fun testStateBecomesAddedAfterAnObservedSave() = runTest {
        val p = plugin()
        p.execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GOOGLE_WALLET"); put("payload", VALID_JWT); put("metadata", metadataJson())
        })
        val data = p.execute("WALLET_GET_PASS_STATE", buildJsonObject {
            put("provider", "GOOGLE_WALLET"); put("passId", "pass.com.example.loyalty:SN-1")
        }).getOrThrow()
        assertEquals("ADDED", data["state"]?.jsonPrimitive?.content)
    }

    @Test
    fun testStateIsUnsupportedWhenNoWalletExists() = runTest {
        val data = plugin(FakeGoogleLauncher(available = false)).execute(
            "WALLET_GET_PASS_STATE",
            buildJsonObject { put("provider", "GOOGLE_WALLET"); put("passId", "x:y") }
        ).getOrThrow()
        assertEquals("UNSUPPORTED", data["state"]?.jsonPrimitive?.content)
    }

    // ---- Generic passes and tenancy ----

    @Test
    fun testGenericPassRoundTripsThroughTheStore() = runTest {
        val p = plugin()
        val saved = p.execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GENERIC"); put("payload", "raw-pass-bytes"); put("metadata", metadataJson())
        }).getOrThrow()
        assertEquals("ADDED", saved["state"]?.jsonPrimitive?.content)

        val state = p.execute("WALLET_GET_PASS_STATE", buildJsonObject {
            put("provider", "GENERIC"); put("passId", "pass.com.example.loyalty:SN-1")
        }).getOrThrow()
        assertEquals("ADDED", state["state"]?.jsonPrimitive?.content)

        val listed = p.execute("WALLET_LIST_PASSES", buildJsonObject { }).getOrThrow()
        assertEquals("1", listed["count"]?.jsonPrimitive?.content)

        val deleted = p.execute("WALLET_DELETE_PASS", buildJsonObject {
            put("passId", "pass.com.example.loyalty:SN-1")
        }).getOrThrow()
        assertEquals("true", deleted["deleted"]?.jsonPrimitive?.content)
    }

    @Test
    fun testOneTenantCannotSeeOrDeleteAnothersPasses() = runTest {
        val vault = InMemoryVault()
        val a = GoatPassesPlugin(FakeTestContext(), genericStore = GenericPassStore(vault), appIdProvider = { "tenant-a" })
        val b = GoatPassesPlugin(FakeTestContext(), genericStore = GenericPassStore(vault), appIdProvider = { "tenant-b" })

        a.execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GENERIC"); put("payload", "secret-barcode"); put("metadata", metadataJson())
        })

        assertEquals("1", a.execute("WALLET_LIST_PASSES", buildJsonObject { }).getOrThrow()["count"]?.jsonPrimitive?.content)
        assertEquals(
            "a pass is a bearer token; another tenant must not see it",
            "0",
            b.execute("WALLET_LIST_PASSES", buildJsonObject { }).getOrThrow()["count"]?.jsonPrimitive?.content
        )
        assertEquals(
            "NOT_ADDED",
            b.execute("WALLET_GET_PASS_STATE", buildJsonObject {
                put("provider", "GENERIC"); put("passId", "pass.com.example.loyalty:SN-1")
            }).getOrThrow()["state"]?.jsonPrimitive?.content
        )
        assertEquals(
            "false",
            b.execute("WALLET_DELETE_PASS", buildJsonObject {
                put("passId", "pass.com.example.loyalty:SN-1")
            }).getOrThrow()["deleted"]?.jsonPrimitive?.content
        )
    }

    @Test
    fun testGenericPassRequiresIdentifiers() = runTest {
        val res = plugin().execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "GENERIC"); put("payload", "bytes")
        })
        assertEquals(PassErrorCode.INVALID_PARAMETERS, (res.exceptionOrNull() as PassException).code)
    }

    @Test
    fun testUnsupportedBarcodeFormatIsRejected() {
        val store = GenericPassStore(InMemoryVault())
        val e = runCatching {
            store.storePass(
                "tenant-a",
                PassMetadata(
                    passTypeIdentifier = "t", serialNumber = "s", provider = PassProvider.GENERIC,
                    barcode = PassBarcode(format = "MORSE", message = "hi")
                ),
                "payload"
            )
        }.exceptionOrNull()
        assertTrue(e is PassException)
        assertEquals(PassErrorCode.PASS_INVALID, (e as PassException).code)
    }

    @Test
    fun testRefreshDoesNotResurrectADeletedPass() {
        val store = GenericPassStore(InMemoryVault())
        val meta = PassMetadata("t", "s", PassProvider.GENERIC)
        store.storePass("tenant-a", meta, "v1")
        assertTrue(store.refreshPass("tenant-a", meta.passId, "v2"))
        assertEquals("v2", store.exportPass("tenant-a", meta.passId))

        store.deletePass("tenant-a", meta.passId)
        assertFalse(
            "a webhook refresh must not recreate a pass the user deleted",
            store.refreshPass("tenant-a", meta.passId, "v3")
        )
    }

    @Test
    fun testExportingAnAbsentPassIsRejected() {
        val store = GenericPassStore(InMemoryVault())
        val e = runCatching { store.exportPass("tenant-a", "nope:1") }.exceptionOrNull()
        assertEquals(PassErrorCode.PASS_NOT_FOUND, (e as PassException).code)
    }

    @Test
    fun testBarcodeRenderingIsNullWithoutAHostRenderer() {
        val store = GenericPassStore(InMemoryVault())
        assertNull(store.renderBarcode(PassBarcode("QR", "hello")))
    }

    @Test
    fun testUnknownProviderIsRejected() = runTest {
        val res = plugin().execute("WALLET_SAVE_PASS", buildJsonObject {
            put("provider", "MY_WALLET"); put("payload", VALID_JWT)
        })
        assertEquals(PassErrorCode.INVALID_PARAMETERS, (res.exceptionOrNull() as PassException).code)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val res = plugin().execute("NOT_A_PASS_ACTION", buildJsonObject { })
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }
}
