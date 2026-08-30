package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit test suite for GoatApiRegistry (Task 10102).
 */
class GoatApiRegistryTest {

    private lateinit var apiRegistry: GoatApiRegistry

    @Before
    fun setUp() {
        apiRegistry = GoatApiRegistry()
    }

    @Test
    fun `test canIUse returns true for supported bridge actions`() {
        assertTrue(apiRegistry.canIUse("CLIPBOARD_SET"))
        assertTrue(apiRegistry.canIUse("CREATE_BINARY_PORT"))
        assertTrue(apiRegistry.canIUse("NAV_PUSH"))
        assertTrue(apiRegistry.canIUse("GESTURE_SCROLL_UPDATE"))
        assertTrue(apiRegistry.canIUse("LOAD_SUBPACKAGE"))
        assertTrue(apiRegistry.canIUse("EMBED_NATIVE_VIEW"))
        assertTrue(apiRegistry.canIUse("FS_WRITE_FILE"))
        assertTrue(apiRegistry.canIUse("GET_APM_SUMMARY"))
        assertTrue(apiRegistry.canIUse("API_REQUEST"))
        assertTrue(apiRegistry.canIUse("STORAGE_SET"))
        assertTrue(apiRegistry.canIUse("START_GEOFENCE"))

        assertFalse(apiRegistry.canIUse("NON_EXISTENT_ACTION_123"))
    }

    @Test
    fun `test all supported actions are registered in api registry`() {
        for (action in GoatBridgeActionHandler.SUPPORTED_ACTIONS) {
            assertTrue("Action '$action' should be supported in GoatApiRegistry", apiRegistry.canIUse(action))
        }
    }

    @Test
    fun `test getCapabilities returns category filtered list`() = runTest {
        val securityApis = apiRegistry.getCapabilities(category = "SECURITY")
        assertTrue(securityApis.isNotEmpty())
        assertTrue(securityApis.all { it.category == "SECURITY" })

        val allApis = apiRegistry.getCapabilities()
        assertEquals(GoatBridgeActionHandler.SUPPORTED_ACTIONS.size, allApis.size)
    }

    @Test
    fun `test dynamic registration of custom capability`() = runTest {
        apiRegistry.registerCapability(
            ApiCapability(
                actionName = "CUSTOM_PAYMENT_GATEWAY",
                category = "PAYMENTS",
                isSupported = true
            )
        )

        assertTrue(apiRegistry.canIUse("CUSTOM_PAYMENT_GATEWAY"))
    }
}
