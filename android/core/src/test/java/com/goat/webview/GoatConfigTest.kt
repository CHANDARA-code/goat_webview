package com.goat.webview

import com.goat.webview.storage.GoatAccountScopedSandbox
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [GoatConfig] public host configuration API and lifecycle.
 */
class GoatConfigTest {

    @Before
    fun setUp() {
        GoatConfig.reset()
    }

    @After
    fun tearDown() {
        GoatConfig.reset()
    }

    @Test
    fun `test GoatConfig default state is null for all configurable properties`() {
        assertNull("accountProvider must be null by default", GoatConfig.accountProvider)
        assertNull("debugUrl must be null by default", GoatConfig.debugUrl)
        assertNull("GoatAccountScopedSandbox currentAccountId must be null", GoatAccountScopedSandbox.getCurrentAccountId())
    }

    @Test
    fun `test GoatConfig accountProvider sets and reads active account`() {
        GoatConfig.accountProvider = { "account_user_9988" }

        assertEquals("account_user_9988", GoatConfig.accountProvider?.invoke())
        assertEquals("account_user_9988", GoatAccountScopedSandbox.getCurrentAccountId())

        // Verify standard storage preferences name incorporates account
        val prefsName = GoatStorageManager.getPreferencesName("shop_app")
        assertEquals("goat_storage_shop_app_account_user_9988", prefsName)

        // Verify secure storage preferences name incorporates account
        val secPrefsName = GoatSecureStorageManager.getSecurePreferencesName("shop_app")
        assertEquals("goat_secure_storage_shop_app_account_user_9988", secPrefsName)

        // Verify KeyStore key alias incorporates account
        val keyAlias = GoatSecureStorageManager.getKeyAlias("shop_app")
        assertEquals("goat_sec_key_shop_app_account_user_9988", keyAlias)
    }

    @Test
    fun `test GoatConfig debugUrl property lifecycle`() {
        assertNull(GoatConfig.debugUrl)
        GoatConfig.debugUrl = "http://10.0.2.2:5173"
        assertEquals("http://10.0.2.2:5173", GoatConfig.debugUrl)
    }

    @Test
    fun `test GoatConfig reset clears accountProvider and debugUrl`() {
        GoatConfig.accountProvider = { "user_temp_456" }
        GoatConfig.debugUrl = "http://localhost:3000"

        assertEquals("user_temp_456", GoatAccountScopedSandbox.getCurrentAccountId())
        assertEquals("http://localhost:3000", GoatConfig.debugUrl)

        GoatConfig.reset()

        assertNull("accountProvider must be null after reset", GoatConfig.accountProvider)
        assertNull("debugUrl must be null after reset", GoatConfig.debugUrl)
        assertNull("GoatAccountScopedSandbox currentAccountId must be null after reset", GoatAccountScopedSandbox.getCurrentAccountId())
        assertEquals("goat_storage_test_app", GoatStorageManager.getPreferencesName("test_app"))
        assertEquals("goat_secure_storage_test_app", GoatSecureStorageManager.getSecurePreferencesName("test_app"))
        assertEquals("goat_sec_key_test_app", GoatSecureStorageManager.getKeyAlias("test_app"))
    }

    @Test
    fun `test GoatConfig accountProvider returning empty or whitespace falls back to null`() {
        GoatConfig.accountProvider = { "" }
        assertNull("Empty account ID must resolve to null", GoatAccountScopedSandbox.getCurrentAccountId())
        assertEquals("goat_storage_app_1", GoatStorageManager.getPreferencesName("app_1"))

        GoatConfig.accountProvider = { "   \t\n   " }
        assertNull("Whitespace account ID must resolve to null", GoatAccountScopedSandbox.getCurrentAccountId())
        assertEquals("goat_storage_app_1", GoatStorageManager.getPreferencesName("app_1"))
    }

    @Test
    fun `test GoatConfig accountProvider throwing exception safely resolves to null without crash`() {
        GoatConfig.accountProvider = {
            throw IllegalStateException("Host auth token expired")
        }

        assertNull("Exception in accountProvider must be safely caught and resolve to null", GoatAccountScopedSandbox.getCurrentAccountId())
        assertEquals("goat_storage_app_1", GoatStorageManager.getPreferencesName("app_1"))
        assertEquals("goat_secure_storage_app_1", GoatSecureStorageManager.getSecurePreferencesName("app_1"))
    }
}
