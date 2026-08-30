package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.ConcurrentHashMap

class GoatSecureStorageManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var tempDir: File
    private lateinit var secureStorageManager: GoatSecureStorageManager

    private class FakeSharedPreferences : SharedPreferences {
        val data = ConcurrentHashMap<String, Any>()

        override fun getAll(): MutableMap<String, *> = HashMap(data)
        override fun getString(key: String?, defValue: String?): String? = (data[key] as? String) ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = (data[key] as? Int) ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = (data[key] as? Long) ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = (data[key] as? Float) ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = (data[key] as? Boolean) ?: defValue
        override fun contains(key: String?): Boolean = data.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor(this)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        class FakeEditor(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
            private val temp = HashMap<String, Any?>()
            private var clearAll = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor {
                if (key != null) {
                    if (value != null) temp[key] = value else temp[key] = null
                }
                return this
            }

            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun remove(key: String?): SharedPreferences.Editor {
                if (key != null) temp[key] = null
                return this
            }
            override fun clear(): SharedPreferences.Editor {
                clearAll = true
                return this
            }
            override fun commit(): Boolean {
                apply()
                return true
            }
            override fun apply() {
                if (clearAll) {
                    prefs.data.clear()
                }
                for ((k, v) in temp) {
                    if (v == null) {
                        prefs.data.remove(k)
                    } else {
                        prefs.data[k] = v
                    }
                }
            }
        }
    }

    private class FakeTestContext(private val baseFilesDir: File) : ContextWrapper(null) {
        val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()

        override fun getFilesDir(): File = baseFilesDir

        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
            val safeName = name ?: "default"
            return prefsMap.computeIfAbsent(safeName) { FakeSharedPreferences() }
        }

        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_sec_test_${System.currentTimeMillis()}").apply { mkdirs() }
        fakeContext = FakeTestContext(tempDir)
        secureStorageManager = GoatSecureStorageManager(fakeContext)
        GoatConfig.reset()
    }

    @After
    fun tearDown() {
        GoatConfig.reset()
        tempDir.deleteRecursively()
    }

    @Test
    fun `test AES-256-GCM encryption at rest on raw storage partition`() = runTest {
        val appId = "tenant_crypto_1"
        val key = "auth_token"
        val sensitiveValue = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_secret_payload_12345"

        // 1. Write secure value
        val saved = secureStorageManager.setSecureValue(appId, key, sensitiveValue)
        assertTrue("Writing secure value should succeed", saved)

        // 2. Direct inspection of raw SharedPreferences on disk / storage layer
        val rawPrefs = secureStorageManager.getSecurePreferences(appId)
        val rawCiphertext = rawPrefs.getString(key, null)

        assertNotNull("Raw ciphertext must exist in SharedPreferences", rawCiphertext)
        assertNotEquals("Plaintext must NEVER be stored directly", sensitiveValue, rawCiphertext)
        assertFalse("Ciphertext must not contain sensitive string", rawCiphertext!!.contains("super_secret_payload"))
        assertTrue("Storage at rest must be certified as encrypted", secureStorageManager.isEncryptedAtRest(appId, key))

        // 3. Read back decrypted value
        val decrypted = secureStorageManager.getSecureValue(appId, key)
        assertEquals("Decrypted value must match original plaintext exactly", sensitiveValue, decrypted)
    }

    @Test
    fun `test multi-tenant isolation across secure partitions`() = runTest {
        val tenantA = "tenant_alpha"
        val tenantB = "tenant_beta"
        val key = "api_secret"

        secureStorageManager.setSecureValue(tenantA, key, "ALPHA_SECRET_KEY_9988")
        secureStorageManager.setSecureValue(tenantB, key, "BETA_SECRET_KEY_7744")

        // Assert tenant A cannot read tenant B's keys
        val valA = secureStorageManager.getSecureValue(tenantA, key)
        val valB = secureStorageManager.getSecureValue(tenantB, key)

        assertEquals("ALPHA_SECRET_KEY_9988", valA)
        assertEquals("BETA_SECRET_KEY_7744", valB)

        // Removing key in Tenant A should not affect Tenant B
        secureStorageManager.removeSecureValue(tenantA, key)
        assertNull("Tenant A key should be removed", secureStorageManager.getSecureValue(tenantA, key))
        assertEquals("Tenant B key should remain intact", "BETA_SECRET_KEY_7744", secureStorageManager.getSecureValue(tenantB, key))
    }

    @Test
    fun `test multi-account secure storage partitioning and switching`() = runTest {
        val appId = "banking_app"
        val key = "jwt_token"

        // 1. Account Alice
        GoatConfig.accountProvider = { "user_alice" }
        secureStorageManager.setSecureValue(appId, key, "ALICE_SECRET_11")
        assertEquals("ALICE_SECRET_11", secureStorageManager.getSecureValue(appId, key))

        // 2. Switch to Account Bob
        GoatConfig.accountProvider = { "user_bob" }
        assertNull("Bob must not be able to read Alice's secure storage", secureStorageManager.getSecureValue(appId, key))

        secureStorageManager.setSecureValue(appId, key, "BOB_SECRET_22")
        assertEquals("BOB_SECRET_22", secureStorageManager.getSecureValue(appId, key))

        // 3. Switch back to Account Alice
        GoatConfig.accountProvider = { "user_alice" }
        assertEquals("Alice's secure token must remain preserved", "ALICE_SECRET_11", secureStorageManager.getSecureValue(appId, key))

        // 4. Switch to fallback unconfigured account
        GoatConfig.reset()
        assertNull("Unconfigured account must not read Alice or Bob secure storage", secureStorageManager.getSecureValue(appId, key))
        secureStorageManager.setSecureValue(appId, key, "FALLBACK_GLOBAL_00")
        assertEquals("FALLBACK_GLOBAL_00", secureStorageManager.getSecureValue(appId, key))

        // 5. Re-verify all accounts retain separate partitions
        GoatConfig.accountProvider = { "user_alice" }
        assertEquals("ALICE_SECRET_11", secureStorageManager.getSecureValue(appId, key))

        GoatConfig.accountProvider = { "user_bob" }
        assertEquals("BOB_SECRET_22", secureStorageManager.getSecureValue(appId, key))

        GoatConfig.reset()
        assertEquals("FALLBACK_GLOBAL_00", secureStorageManager.getSecureValue(appId, key))
    }

    @Test
    fun `test secure storage clear and getAllKeys`() = runTest {
        val appId = "tenant_batch"

        secureStorageManager.setSecureValue(appId, "k1", "v1")
        secureStorageManager.setSecureValue(appId, "k2", "v2")
        secureStorageManager.setSecureValue(appId, "k3", "v3")

        val keys = secureStorageManager.getAllSecureKeys(appId)
        assertEquals(3, keys.size)
        assertTrue(keys.containsAll(listOf("k1", "k2", "k3")))

        val cleared = secureStorageManager.clearSecureValues(appId)
        assertTrue(cleared)
        assertEquals(0, secureStorageManager.getAllSecureKeys(appId).size)
        assertNull(secureStorageManager.getSecureValue(appId, "k1"))

        val reencrypted = secureStorageManager.setSecureValue(appId, "k1", "v1_after_clear")
        assertTrue(reencrypted)
        assertEquals("v1_after_clear", secureStorageManager.getSecureValue(appId, "k1"))
    }

    @Test
    fun `test corrupted ciphertext envelope returns null safely`() = runTest {
        val appId = "tenant_corrupt"
        val key = "corrupted_key"

        val rawPrefs = secureStorageManager.getSecurePreferences(appId)
        // Store an invalid / corrupted payload in the secure preference table
        rawPrefs.edit().putString(key, "dGhpcyBpcyBub3QgYSB2YWxpZCBnY20gZW52ZWxvcGU=").commit()

        val result = secureStorageManager.getSecureValue(appId, key)
        assertNull("Decryption of corrupted payload must safely return null without throwing", result)
    }

    @Test
    fun `test non-existent key returns null`() = runTest {
        val appId = "tenant_empty"
        val result = secureStorageManager.getSecureValue(appId, "missing_key")
        assertNull(result)
    }
}
