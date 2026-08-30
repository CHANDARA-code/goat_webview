package com.goat.webview.feature.biometrics

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Automated test suite for GoatBiometricsPlugin (Task 10103 / Task 10152).
 * Verifies capability checking, fail-closed security, and refusal of mock bypasses.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatBiometricsPluginTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var plugin: GoatBiometricsPlugin

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
        override fun getSystemServiceName(serviceClass: Class<*>): String? = null
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        plugin = GoatBiometricsPlugin(fakeContext)
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        assertEquals("biometrics", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("CHECK_BIOMETRIC_SUPPORT"))
        assertTrue(plugin.supportedActions.contains("BIOMETRIC_AUTH"))
    }

    @Test
    fun testCheckBiometricSupportReturnsStructuredResponse() = runTest {
        val result = plugin.execute("CHECK_BIOMETRIC_SUPPORT", buildJsonObject {})
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertTrue(data?.containsKey("supported") == true)
        assertTrue(data?.containsKey("biometryType") == true)
    }

    @Test
    fun testBiometricAuthFailsClosedWhenActivityUnavailable() = runTest {
        val payload = buildJsonObject {
            put("title", "Authenticate")
            put("subtitle", "Confirm identity")
        }
        val result = plugin.execute("BIOMETRIC_AUTH", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("false", data?.get("authenticated")?.jsonPrimitive?.content)
    }

    @Test
    fun testUnsupportedActionReturnsFailure() = runTest {
        val result = plugin.execute("UNSUPPORTED_ACTION", buildJsonObject {})
        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }
}
