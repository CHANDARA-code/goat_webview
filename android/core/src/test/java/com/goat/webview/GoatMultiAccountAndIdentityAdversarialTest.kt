package com.goat.webview

import android.content.Context
import com.goat.webview.storage.GoatAccountScopedSandbox
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Empirical Adversarial Challenge Suite for Task 10203:
 * Multi-Account Storage Partitioning & Install-Scoped Anonymous GUID.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatMultiAccountAndIdentityAdversarialTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var storageManager: GoatStorageManager
    private lateinit var secureStorageManager: GoatSecureStorageManager
    private lateinit var handler: GoatBridgeActionHandler

    // Strict RFC 4122 UUID v4 regex:
    // 8 hex - 4 hex - '4' + 3 hex - [89abAB] + 3 hex - 12 hex
    private val uuidV4StrictRegex = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

    @Before
    fun setUp() {
        GoatConfig.reset()
        fakeContext = FakeTestContext()
        storageManager = GoatStorageManager(fakeContext, Dispatchers.Unconfined)
        secureStorageManager = GoatSecureStorageManager(fakeContext, Dispatchers.Unconfined)
        handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "adversarial_app",
            storageManager = storageManager,
            secureStorageManager = secureStorageManager
        )
    }

    @After
    fun tearDown() {
        GoatConfig.reset()
    }

    // =========================================================================
    // 1. RAPID CONCURRENT ACCOUNT SWITCHING & DATA LEAKAGE PREVENTION
    // =========================================================================

    @Test
    fun `ADV-1_1 Rapid alternating account switching prevents cross-account KV and secure data leakage`() = runTest {
        val appId = "fintech_wallet"
        val accounts = listOf("user_alpha_101", "user_beta_202", "user_gamma_303", "user_delta_404")

        // 1. Write unique KV and secure values for each account
        for ((idx, account) in accounts.withIndex()) {
            GoatConfig.accountProvider = { account }
            
            // Standard storage
            val setKv = handler.executeAction("STORAGE_SET", buildJsonObject {
                put("key", "secret_balance")
                put("value", "balance_$idx for $account")
            })
            assertTrue("Setting KV for $account must succeed", setKv.isSuccess)

            // Secure storage
            val setSec = handler.executeAction("SECURE_STORAGE_SET", buildJsonObject {
                put("key", "auth_token")
                put("value", "token_xyz_$idx#$account")
            })
            assertTrue("Setting Secure KV for $account must succeed", setSec.isSuccess)
        }

        // 2. Perform 200 rapid alternating switch-and-verify cycles
        for (i in 0 until 200) {
            val accountIndex = i % accounts.size
            val targetAccount = accounts[accountIndex]
            val expectedValue = "balance_$accountIndex for $targetAccount"
            val expectedToken = "token_xyz_$accountIndex#$targetAccount"

            GoatConfig.accountProvider = { targetAccount }

            // Read Standard storage
            val getKv = handler.executeAction("STORAGE_GET", buildJsonObject {
                put("key", "secret_balance")
            })
            assertTrue(getKv.isSuccess)
            val kvVal = getKv.getOrNull()?.get("value")?.jsonPrimitive?.content
            assertEquals("Account $targetAccount must read its own KV balance on iteration $i", expectedValue, kvVal)

            // Read Secure storage
            val getSec = handler.executeAction("SECURE_STORAGE_GET", buildJsonObject {
                put("key", "auth_token")
            })
            assertTrue(getSec.isSuccess)
            val secVal = getSec.getOrNull()?.get("value")?.jsonPrimitive?.content
            assertEquals("Account $targetAccount must read its own Secure token on iteration $i", expectedToken, secVal)
        }
    }

    @Test
    fun `ADV-1_2 Highly concurrent multi-account read-write stress test ensures isolated keyspaces`() = runTest {
        val writeCount = 50
        val accounts = listOf("tenant_usr_A", "tenant_usr_B", "tenant_usr_C")
        val errors = AtomicInteger(0)

        // Pre-populate accounts
        for (acc in accounts) {
            GoatConfig.accountProvider = { acc }
            for (k in 0 until writeCount) {
                storageManager.setValue("app_stress", "key_$k", "val_${acc}_$k")
                secureStorageManager.setSecureValue("app_stress", "sec_key_$k", "sec_val_${acc}_$k")
            }
        }

        // Concurrent reads verifying strict isolation
        val jobs = (0 until 100).map { jobIdx ->
            async(Dispatchers.Default) {
                val acc = accounts[jobIdx % accounts.size]
                val customStorage = GoatStorageManager(fakeContext, Dispatchers.Default)
                val customSecure = GoatSecureStorageManager(fakeContext, Dispatchers.Default)

                // Explicit scoped queries
                val prefsName = GoatAccountScopedSandbox.getScopedPreferencesName("app_stress")
                assertNotNull(prefsName)

                for (k in 0 until writeCount) {
                    val expectedKv = "val_${acc}_$k"
                    val expectedSec = "sec_val_${acc}_$k"
                    
                    val scopedPrefs = fakeContext.getSharedPreferences("goat_storage_app_stress_$acc", Context.MODE_PRIVATE)
                    val readKv = scopedPrefs.getString("key_$k", null)
                    if (readKv != expectedKv) {
                        errors.incrementAndGet()
                    }

                    val scopedSecPrefs = fakeContext.getSharedPreferences("goat_secure_storage_app_stress_$acc", Context.MODE_PRIVATE)
                    val readSec = scopedSecPrefs.getString("sec_key_$k", null)
                    if (readSec == null) {
                        errors.incrementAndGet()
                    }
                }
            }
        }

        jobs.awaitAll()
        assertEquals("Zero isolation violations or race corruptions under concurrency", 0, errors.get())
    }

    // =========================================================================
    // 2. ACCOUNT ID SANITIZATION, PATH TRAVERSAL & SPECIAL CHARACTERS
    // =========================================================================

    @Test
    fun `ADV-2_1 Path traversal sequences in account ID are strictly rejected`() {
        val maliciousAccountIds = listOf(
            "../escaped_user",
            "..\\windows_escaped",
            "../../../../etc/passwd",
            "account/with/forward/slashes",
            "account\\with\\backslashes",
            "..",
            "/",
            "\\"
        )

        for (malicious in maliciousAccountIds) {
            GoatConfig.accountProvider = { malicious }
            try {
                GoatAccountScopedSandbox.getScopedPreferencesName("shop")
                fail("Expected SecurityException for path traversal account ID: '$malicious'")
            } catch (e: SecurityException) {
                assertTrue("Exception message must indicate path traversal", e.message?.contains("Path traversal sequence") == true)
            }

            try {
                GoatAccountScopedSandbox.getScopedSecurePreferencesName("shop")
                fail("Expected SecurityException for secure preferences with path traversal: '$malicious'")
            } catch (e: SecurityException) {
                assertTrue(e.message?.contains("Path traversal sequence") == true)
            }

            try {
                GoatAccountScopedSandbox.getScopedKeyAlias("shop")
                fail("Expected SecurityException for key alias with path traversal: '$malicious'")
            } catch (e: SecurityException) {
                assertTrue(e.message?.contains("Path traversal sequence") == true)
            }

            try {
                GoatAccountScopedSandbox.getScopedDataDirectory(fakeContext.filesDir, "shop")
                fail("Expected SecurityException for data directory with path traversal: '$malicious'")
            } catch (e: SecurityException) {
                assertTrue(e.message?.contains("Path traversal sequence") == true)
            }
        }
    }

    @Test
    fun `ADV-2_2 Special characters and unicode in account ID are safely sanitized`() {
        val specialAccounts = mapOf(
            "user@company.com" to "user_company.com",
            "user#123\$456" to "user_123_456",
            "user:alpha;beta" to "user_alpha_beta",
            "user[1]+2" to "user_1__2",
            "user!test?yes" to "user_test_yes",
            "user_valid-account.123" to "user_valid-account.123"
        )

        for ((raw, sanitized) in specialAccounts) {
            GoatConfig.accountProvider = { raw }
            val prefsName = GoatAccountScopedSandbox.getScopedPreferencesName("app_portal")
            assertEquals("goat_storage_app_portal_$sanitized", prefsName)

            val secName = GoatAccountScopedSandbox.getScopedSecurePreferencesName("app_portal")
            assertEquals("goat_secure_storage_app_portal_$sanitized", secName)

            val keyAlias = GoatAccountScopedSandbox.getScopedKeyAlias("app_portal")
            assertEquals("goat_sec_key_app_portal_$sanitized", keyAlias)

            val dataDir = GoatAccountScopedSandbox.getScopedDataDirectory(fakeContext.filesDir, "app_portal")
            assertTrue("Directory path must contain sanitized account name", dataDir.absolutePath.contains(sanitized))
        }
    }

    // =========================================================================
    // 3. INSTALL GUID UUID V4 COMPLIANCE & PERSISTENCE STABILITY
    // =========================================================================

    @Test
    fun `ADV-3_1 installGuid complies strictly with RFC 4122 UUID v4 specifications`() {
        for (i in 0 until 100) {
            val freshContext = FakeTestContext()
            val guid = GoatAccountScopedSandbox.getInstallGuid(freshContext)
            
            assertNotNull(guid)
            assertTrue("Length must be 36 characters", guid.length == 36)
            assertTrue("Must match strict UUID v4 regex: $guid", guid.matches(uuidV4StrictRegex))
            
            // Check version nibble at index 14
            assertEquals("UUID version must be 4", '4', guid[14])
            // Check variant nibble at index 19
            val variantChar = guid[19].lowercaseChar()
            assertTrue("UUID variant must be 8, 9, a, or b (got $variantChar)", variantChar in listOf('8', '9', 'a', 'b'))
        }
    }

    @Test
    fun `ADV-3_2 installGuid remains invariant across 1000 sequential and concurrent invocations`() = runTest {
        val initialGuid = GoatAccountScopedSandbox.getInstallGuid(fakeContext)
        val observedGuids = ConcurrentHashMap.newKeySet<String>()

        val jobs = (0 until 1000).map {
            async(Dispatchers.Default) {
                val g = GoatAccountScopedSandbox.getInstallGuid(fakeContext)
                observedGuids.add(g)
            }
        }
        jobs.awaitAll()

        assertEquals("Exactly one distinct installGuid must exist across all concurrent calls", 1, observedGuids.size)
        assertEquals("Observed GUID must equal initial GUID", initialGuid, observedGuids.first())
    }

    @Test
    fun `ADV-3_3 installGuid remains unchanged across account switching and resets`() {
        val originalGuid = GoatAccountScopedSandbox.getInstallGuid(fakeContext)

        GoatConfig.accountProvider = { "user_first" }
        assertEquals(originalGuid, GoatAccountScopedSandbox.getInstallGuid(fakeContext))

        GoatConfig.accountProvider = { "user_second" }
        assertEquals(originalGuid, GoatAccountScopedSandbox.getInstallGuid(fakeContext))

        GoatConfig.reset()
        assertEquals(originalGuid, GoatAccountScopedSandbox.getInstallGuid(fakeContext))
    }

    // =========================================================================
    // 4. BACKWARD COMPATIBILITY & NULL / EMPTY / EXCEPTION HANDLING
    // =========================================================================

    @Test
    fun `ADV-4_1 Backward compatibility - null, empty, whitespace, and failing accountProvider gracefully fallback`() {
        val testCases = listOf<Pair<(() -> String?)?, String>>(
            null to "null provider",
            { null } to "provider returning null",
            { "" } to "provider returning empty string",
            { "   " } to "provider returning spaces",
            { "\t\r\n  " } to "provider returning whitespace/newlines",
            { throw RuntimeException("Simulated host auth failure") } to "provider throwing exception"
        )

        for ((provider, description) in testCases) {
            GoatConfig.accountProvider = provider
            
            assertNull("Account ID must resolve to null for $description", GoatAccountScopedSandbox.getCurrentAccountId())
            
            val prefsName = GoatAccountScopedSandbox.getScopedPreferencesName("legacy_app")
            assertEquals("Standard prefs must resolve to un-scoped {appId} for $description", "goat_storage_legacy_app", prefsName)

            val secName = GoatAccountScopedSandbox.getScopedSecurePreferencesName("legacy_app")
            assertEquals("Secure prefs must resolve to un-scoped {appId} for $description", "goat_secure_storage_legacy_app", secName)

            val keyAlias = GoatAccountScopedSandbox.getScopedKeyAlias("legacy_app")
            assertEquals("Key alias must resolve to un-scoped {appId} for $description", "goat_sec_key_legacy_app", keyAlias)

            val dataDir = GoatAccountScopedSandbox.getScopedDataDirectory(fakeContext.filesDir, "legacy_app")
            assertEquals("Data directory must resolve to un-scoped miniapps/{appId}/data for $description", 
                File(File(fakeContext.filesDir, "miniapps"), "legacy_app/data").canonicalPath,
                dataDir.canonicalPath
            )
        }
    }

    @Test
    fun `ADV-4_2 Switching from un-scoped to scoped and back preserves data in each partition`() = runTest {
        val appId = "transition_app"

        // 1. Write in un-scoped legacy mode
        GoatConfig.reset()
        storageManager.setValue(appId, "config_mode", "UNSCOPED_DEFAULT")
        assertEquals("UNSCOPED_DEFAULT", storageManager.getValue(appId, "config_mode"))

        // 2. Enable account scoping
        GoatConfig.accountProvider = { "user_migrated_1" }
        assertNull("Scoped user should not see legacy un-scoped data", storageManager.getValue(appId, "config_mode"))
        storageManager.setValue(appId, "config_mode", "SCOPED_USER_1")
        assertEquals("SCOPED_USER_1", storageManager.getValue(appId, "config_mode"))

        // 3. Switch back to un-scoped legacy mode
        GoatConfig.reset()
        assertEquals("UNSCOPED_DEFAULT", storageManager.getValue(appId, "config_mode"))

        // 4. Switch back to scoped user
        GoatConfig.accountProvider = { "user_migrated_1" }
        assertEquals("SCOPED_USER_1", storageManager.getValue(appId, "config_mode"))
    }
}
